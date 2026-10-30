// OTLP wire payloads, channel dispatch and delivery behavior without sockets.
load(NATTRMON_HOME + "/config/objects/nOutput_OpenTelemetry.js")

var __otelOutput = function(options) {
	var o = new nOutput_OpenTelemetry(merge({ endpoint: "http://localhost:4318" }, options || {}))
	o.messages = []
	o.requests = []
	o.clock = 1767225600123
	o._now = () => o.clock
	o._sleep = ms => { o.clock += ms }
	o._diagnostic = message => { o.messages.push(message) }
	o._request = (signal, body, timeout) => {
		o.requests.push({ signal: signal, body: JSON.parse(body), raw: body, timeout: timeout })
		return { status: 200, body: "{}", headers: {} }
	}
	return o
}

var __otelAttrs = function(attrs) {
	var ret = {}
	attrs.forEach(a => { ret[a.key] = a.value })
	return ret
}

ow.test.test("nOutput_OpenTelemetry::validates configuration without contacting a receiver", () => {
	[ {}, { endpoint: "grpc://localhost:4317" }, { endpoint: "http://user:pass@localhost" },
		{ endpoint: "http://localhost?token=secret" }, { endpoint: "http://localhost/#fragment" },
		{ timeoutMs: 0 }, { maxRetries: -1 }, { maxBatchSize: 0.5 }, { maxPayloadBytes: Infinity },
		{ include: ["["] }, { exclude: "secret" }, { includeWarns: "true" }, { headers: { Authorization: "bad\r\nheader" } },
		{ labelFields: ["nattrmon.array.index.0"] }, { resourceAttributes: { bad: null } },
		{ metricOverrides: { metric: { name: "!invalid" } } }, { metricOverrides: { metric: { type: "counter" } } }
	].forEach((options, i) => {
		var failed = false
		try { new nOutput_OpenTelemetry(i < 5 ? options : merge({ endpoint: "https://localhost" }, options)) } catch(e) { failed = true }
		ow.test.assert(failed, true, "invalid configuration " + i + " is rejected")
	})
	var p = { endpoint: "https://localhost:4318/base/", resourceAttributes: { "service.instance.id": "one", enabled: true, count: 2, tags: ["a"], nested: { zone: "b" } } }
	var o = new nOutput_OpenTelemetry(p)
	ow.test.assert(o.endpoint, "https://localhost:4318/base", "base path is retained")
	ow.test.assert(p.resourceAttributes["service.name"], undefined, "caller configuration is not mutated")
	var resource = __otelAttrs(o.resource.attributes)
	ow.test.assert(resource["service.name"], { stringValue: "nattrmon" }, "default service identity")
	ow.test.assert(resource.enabled, { boolValue: true }, "typed boolean")
	ow.test.assert(resource.count, { doubleValue: 2 }, "typed number")
	ow.test.assert(resource.tags, { arrayValue: { values: [{ stringValue: "a" }] } }, "typed array")
	ow.test.assert(resource.nested.kvlistValue.values[0].value, { stringValue: "b" }, "typed map")
})

ow.test.test("nOutput_OpenTelemetry::numeric leaves and booleans become named gauges with exact times", () => {
	var o = __otelOutput({ metricOverrides: { nattrmon_Service_Memory_bytes: { name: "nattrmon.memory.bytes", unit: "By", description: "Used memory" } } })
	var values = [{ name: "Service/Memory", date: "2026-01-01T00:00:00.123Z", val: {
		bytes: 1024, available: true, absent: null, text: "42", invalid: NaN, infinity: Infinity,
		when: new Date(), nested: { ready: false, load: 1.25 }
	} }]
	var records = o._metrics(values, o.clock)
	ow.test.assert(records.length, 4, "only numeric/boolean leaves are exported")
	var payload = o._envelope("metrics", records)
	var metrics = payload.resourceMetrics[0].scopeMetrics[0].metrics
	var memory = metrics.filter(m => m.name == "nattrmon.memory.bytes")[0]
	ow.test.assert(memory.unit, "By", "unit override")
	ow.test.assert(memory.description, "Used memory", "description override")
	ow.test.assert(memory.gauge.dataPoints[0].asDouble, 1024, "numeric value")
	ow.test.assert(memory.gauge.dataPoints[0].timeUnixNano, "1767225600123000000", "nanoseconds remain exact")
	ow.test.assert(records.filter(r => r.name == "nattrmon_Service_Memory_available")[0].point.asDouble, 1, "true becomes one")
	ow.test.assert(records.filter(r => r.name == "nattrmon_Service_Memory_nested_ready")[0].point.asDouble, 0, "false becomes zero")
	ow.test.assert(payload.resourceMetrics[0].scopeMetrics[0].scope.name, "nattrmon.output.opentelemetry", "instrumentation scope")
	;[undefined, null, false, [], "bad", -1, "9999-01-01T00:00:00Z"].forEach(date => {
		ow.test.assert(o._time(date, o.clock), "1767225600123000000", "invalid or out-of-range date falls back")
	})
})

ow.test.test("nOutput_OpenTelemetry::arrays retain indices and opt-in labels with nested row overrides", () => {
	var o = __otelOutput({ labelFields: ["host"] })
	var records = o._metrics([{ name: "Rows", val: [
		{ host: "a", ignored: "secret", value: 1, inner: [{ host: "child", value: 2 }] },
		{ host: "b", value: 3 }
	] }], o.clock)
	var base = records.filter(r => r.name == "nattrmon_Rows_value")
	ow.test.assert(base.length, 2, "rows share a gauge")
	ow.test.assert(__otelAttrs(base[0].point.attributes), { host: { stringValue: "a" }, "nattrmon.array.index.0": { stringValue: "0" } }, "explicit row label and stable index")
	var nested = __otelAttrs(records.filter(r => r.name == "nattrmon_Rows_inner_value")[0].point.attributes)
	ow.test.assert(nested.host, { stringValue: "child" }, "inner label overrides outer label")
	ow.test.assert(nested["nattrmon.array.index.1"], { stringValue: "0" }, "nested index")
	var noLabels = __otelOutput()._metrics([{ name: "Rows", val: [{ host: "a", value: 1 }] }], o.clock)
	ow.test.assert(noLabels[0].point.attributes.length, 1, "strings are not labels by default")
	var primitive = o._metrics([{ name: "Numbers", val: [1, 2] }], o.clock)
	ow.test.assert(o._envelope("metrics", primitive).resourceMetrics[0].scopeMetrics[0].metrics[0].gauge.dataPoints.length, 2, "primitive arrays group points")
})

ow.test.test("nOutput_OpenTelemetry::filters exclude first and name collisions reject before sending", () => {
	var o = __otelOutput({ include: ["^Service/"], exclude: ["secret"] })
	ow.test.assert(o._metrics([{ name: "Service/secret", val: 1 }, { name: "Service/ok", val: 2 }, { name: "Other", val: 3 }], o.clock).map(r => r.name), ["nattrmon_Service_ok"], "exclude wins")
	;[ [{ name: "a-b", val: 1 }, { name: "a_b", val: 2 }],
		[{ name: "a", val: { "b.c": 1, b: { c: 2 } } }],
		[{ name: "same", val: 1 }, { name: "same", val: 2 }]
	].forEach(values => {
		var output = __otelOutput(), failed = false
		try { output.output({}, { ch: "nattrmon::cvals", op: "setall", v: values }) } catch(e) { failed = true }
		ow.test.assert(failed, true, "conflicting names or points rejected")
		ow.test.assert(output.requests.length, 0, "no partial export on collision")
	})
	var renamed = __otelOutput({ metricOverrides: { nattrmon_a: { name: "same" }, nattrmon_b: { name: "same" } } }), failed = false
	try { renamed._metrics([{ name: "a", val: 1 }, { name: "b", val: 2 }], renamed.clock) } catch(e) { failed = true }
	ow.test.assert(failed, true, "override collisions rejected")
})

ow.test.test("nOutput_OpenTelemetry::warning levels, closure, event times and bookkeeping boundaries", () => {
	var o = __otelOutput()
	var logs = o._logs(["High", "Medium", "Low", "Info", "Closed", "Other"].map(level => ({
		title: "Service/Alert", description: "Details", level: level, category: ["Service"],
		createdate: "2025-12-31T00:00:00Z", lastupdate: "2026-01-01T00:00:00Z", notified: { token: "secret" }
	})), o.clock)
	ow.test.assert(logs.map(r => r.severityNumber), [17, 13, 13, 9, 9, 0], "all severity mappings")
	ow.test.assert(logs[4].severityText, "Closed", "closure retained")
	ow.test.assert(logs[0].timeUnixNano, "1767225600000000000", "event timestamp")
	ow.test.assert(logs[0].observedTimeUnixNano, "1767225600123000000", "observed timestamp")
	ow.test.assert(logs[0].body, { stringValue: "Details" }, "description body")
	ow.test.assert(__otelAttrs(logs[0].attributes)["nattrmon.warning.createdate"], { stringValue: "1767139200000000000" }, "creation date")
	ow.test.assert(JSON.stringify(logs).indexOf("secret"), -1, "notification bookkeeping excluded")
	var minimal = o._logs([{ title: "Minimal" }], o.clock)[0]
	ow.test.assert(minimal.body.stringValue, "Minimal", "missing description uses title")
	ow.test.assert(minimal.timeUnixNano, minimal.observedTimeUnixNano, "missing event time uses observed time")
})

ow.test.test("nOutput_OpenTelemetry::channel dispatch supports set/setall, buffers and independent signal switches", () => {
	var o = __otelOutput()
	o.output({}, { ch: "nattrmon::cvals", op: "set", v: { name: "a", val: 1 } })
	o.output({}, { ch: "nattrmon::cvals::buffer", op: "setall", v: [{ name: "b", val: 2 }] })
	o.output({}, { ch: "nattrmon::warnings", op: "set", v: { title: "warn", level: "High" } })
	o.output({}, { ch: "nattrmon::warnings::buffer", op: "setall", v: [{ title: "warn", level: "Closed" }] })
	;["unset", "unsetall", "get"].forEach(op => o.output({}, { ch: "nattrmon::warnings", op: op, v: { title: "ignored" } }))
	o.output({}, { ch: "nattrmon::lvals", op: "set", v: { name: "ignored", val: 3 } })
	o.output({}, { ch: "nattrmon::cvals", op: "setall", v: [] })
	ow.test.assert(o.requests.map(r => r.signal), ["metrics", "metrics", "logs", "logs"], "only selected channels/operations send")
	var disabled = __otelOutput({ includeValues: false, includeWarns: false })
	disabled.output({}, { ch: "nattrmon::cvals", op: "set", v: { name: "a", val: 1 } })
	disabled.output({}, { ch: "nattrmon::warnings", op: "set", v: { title: "a" } })
	ow.test.assert(disabled.requests.length, 0, "both signals can be disabled")
})

ow.test.test("nOutput_OpenTelemetry::batches honor point counts and actual UTF-8 envelope sizes", () => {
	var o = __otelOutput({ maxBatchSize: 2 })
	var records = o._logs([1, 2, 3, 4, 5].map(i => ({ title: "Warning " + i, description: "é漢字" })), o.clock)
	ow.test.assert(o._export("logs", records), { sent: 5, dropped: 0 }, "all records accepted")
	ow.test.assert(o.requests.map(r => r.body.resourceLogs[0].scopeLogs[0].logRecords.length), [2, 2, 1], "record limit")
	var limited = __otelOutput()
	limited.maxPayloadBytes = limited._bytes(JSON.stringify(limited._envelope("logs", [records[0]])))
	ow.test.assert(limited._export("logs", records), { sent: 5, dropped: 0 }, "single-record batches fit byte limit")
	ow.test.assert(limited.requests.length, 5, "byte limit splits batches")
	ow.test.assert(limited.requests.every(r => limited._bytes(r.raw) <= limited.maxPayloadBytes), true, "all envelopes fit")
	var oversized = clone(records[0]); oversized.body.stringValue = "x".repeat(10000)
	ow.test.assert(limited._export("logs", [oversized]), { sent: 0, dropped: 1 }, "oversized record dropped")
	ow.test.assert(limited.requests.length, 5, "oversized record sends no request")
	var metrics = __otelOutput({ maxBatchSize: 1 })
	ow.test.assert(metrics._export("metrics", metrics._metrics([{ name: "rows", val: [1, 2] }], metrics.clock)), { sent: 2, dropped: 0 }, "metric point count controls batching")
	ow.test.assert(metrics.requests.length, 2, "two points split even when sharing a metric")
})

ow.test.test("nOutput_OpenTelemetry::retryable statuses and connection errors retry identical payloads", () => {
	[0, 429, 502, 503, 504].forEach(status => {
		var o = __otelOutput(), calls = [], started = o.clock
		o._request = (signal, body, timeout) => {
			calls.push(body)
			if (calls.length == 1) {
				if (status == 0) throw new Error("sensitive transport detail")
				return { status: status, headers: { "Retry-After": "1" } }
			}
			return { status: 200, body: "{}" }
		}
		ow.test.assert(o._send("metrics", "payload", 2), 2, "retry eventually accepts status " + status)
		ow.test.assert(calls, ["payload", "payload"], "payload replayed exactly")
		ow.test.assert(o.clock > started, true, "retry sleeps")
		ow.test.assert(o.messages.length, 0, "recovered retries do not report drops")
	})
})

ow.test.test("nOutput_OpenTelemetry::permanent errors, partial success and malformed acknowledgements never retry", () => {
	[400, 401, 403, 404, 413, 500, 501, 302].forEach(status => {
		var o = __otelOutput(), calls = 0
		o._request = () => { calls++; return { status: status, body: "secret server text", headers: {} } }
		ow.test.assert(o._send("logs", "secret payload", 3), 0, "failure has no confirmed records")
		ow.test.assert(calls, 1, "permanent status never retried")
		ow.test.assert(o.messages.join(" ").indexOf("secret"), -1, "remote text and payload omitted")
	})
	;[ ["metrics", { partialSuccess: { rejectedDataPoints: "1", errorMessage: "secret" } }, 2],
		["logs", { partialSuccess: { rejectedLogRecords: "2" } }, 1],
		["logs", { partialSuccess: { errorMessage: "secret" } }, 3],
		["logs", { partialSuccess: { rejectedLogRecords: "9999999999999999999999" } }, 0]
	].forEach(test => {
		var o = __otelOutput(), calls = 0
		o._request = () => { calls++; return { status: 200, body: JSON.stringify(test[1]) } }
		ow.test.assert(o._send(test[0], "payload", 3), test[2], "partial success counts accepted records")
		ow.test.assert(calls, 1, "partial success is never retried")
		ow.test.assert(o.messages.join(" ").indexOf("secret"), -1, "remote warning text is omitted")
	})
	;["bad json", "null", "[]"].forEach(body => {
		var o = __otelOutput(), calls = 0
		o._request = () => { calls++; return { status: 200, body: body } }
		ow.test.assert(o._send("logs", "payload", 1), 0, "malformed response is unconfirmed")
		ow.test.assert(calls, 1, "ambiguous acceptance is not replayed")
	})
	var emptyPartial = __otelOutput()
	emptyPartial._request = () => ({ status: 200, body: '{"partialSuccess":{}}' })
	ow.test.assert(emptyPartial._send("metrics", "payload", 1), 1, "empty default partialSuccess accepts data")
	ow.test.assert(emptyPartial.messages.length, 0, "default partialSuccess does not warn on every export")
})

ow.test.test("nOutput_OpenTelemetry::real engine subscriptions forward channel updates through the output wrapper", () => {
	var nm = harness.newEngine({}, { name: "otel-subscriptions" })
	var o = __otelOutput()
	try {
		nm.addOutput({ name: "OTLP test", chSubscribe: ["nattrmon::cvals", "nattrmon::warnings"], waitForFinish: false }, o, {})
		nm.execPlugs(nm.PLUGOUTPUTS)
		var plug = $from(nm.plugs[nm.PLUGOUTPUTS]).equals("aName", "OTLP test").at(0)
		$ch("nattrmon::cvals").set({ name: "Service/value" }, { name: "Service/value", val: 42, date: new Date() })
		var until = Date.now() + 3000
		while (plug.numberOfExecs.get() < 1 && Date.now() < until) sleep(20, true)
		$ch("nattrmon::warnings").set({ title: "Service/warning" }, { title: "Service/warning", description: "Test", level: "Closed", lastupdate: new Date(), createdate: new Date() })
		until = Date.now() + 3000
		while (plug.numberOfExecs.get() < 2 && Date.now() < until) sleep(20, true)
		ow.test.assert(o.requests.map(r => r.signal).sort(), ["logs", "metrics"], "engine delivers both subscriptions")
		ow.test.assert(o.count, 2, "nOutput wrapper records both invocations")
	} finally { harness.stopEngine(nm) }
})

ow.test.test("nOutput_OpenTelemetry::concurrent signal exports do not share response state", () => {
	var original = ow.obj.http, clients = new java.util.concurrent.ConcurrentLinkedQueue()
	var entered = new java.util.concurrent.CountDownLatch(2), overlap = new java.util.concurrent.atomic.AtomicBoolean(true)
	ow.obj.http = function() {
		var instance = { closed: false, signal: undefined }
		clients.add(instance)
		this.setThrowExceptions = () => {}
		this.exec = (url, method, body) => {
			instance.signal = url.endsWith("/metrics") ? "metrics" : "logs"
			entered.countDown()
			if (!entered.await(3, java.util.concurrent.TimeUnit.SECONDS)) overlap.set(false)
			return { responseCode: instance.signal == "metrics" ? 200 : 400, response: "{}" }
		}
		this.responseHeaders = () => ({})
		this.close = () => { instance.closed = true }
	}
	try {
		var o = new nOutput_OpenTelemetry({ endpoint: "http://localhost:4318", maxRetries: 0 })
		o._diagnostic = () => {}
		var results = pForEach(["metrics", "logs"], signal => ({ signal: signal, accepted: o._send(signal, "{}", 1) }), e => { throw e })
		ow.test.assert(overlap.get(), true, "requests overlap")
		ow.test.assert(results.filter(r => r.signal == "metrics")[0].accepted, 1, "metrics response accepted independently")
		ow.test.assert(results.filter(r => r.signal == "logs")[0].accepted, 0, "logs rejection remains independent")
		ow.test.assert(clients.size(), 2, "two HTTP instances")
		var iterator = clients.iterator(), closed = 0
		while (iterator.hasNext()) if (iterator.next().closed) closed++
		ow.test.assert(closed, 2, "both concurrent clients released")
	} finally { ow.obj.http = original }
})

ow.test.test("nOutput_OpenTelemetry::retry count, Retry-After and total time bound attempts", () => {
	var o = __otelOutput({ timeoutMs: 30000 }), calls = 0
	o._request = (signal, body, timeout) => { calls++; ow.test.assert(timeout, 20000, "attempt capped by budget"); o.clock += timeout; throw "timeout" }
	ow.test.assert(o._send("metrics", "payload", 1), 0, "budget exhaustion drops records")
	ow.test.assert(calls, 1, "budget exhaustion prevents another attempt")
	var longWait = __otelOutput(), waits = 0
	longWait._sleep = () => { waits++ }
	longWait._request = () => ({ status: 429, headers: { "retry-after": "21" } })
	ow.test.assert(longWait._send("logs", "payload", 1), 0, "delay outside budget stops retries")
	ow.test.assert(waits, 0, "does not sleep beyond budget")
	var exhausted = __otelOutput({ maxRetries: 2 }), attempts = 0
	exhausted._request = () => { attempts++; return { status: 503, headers: { "Retry-After": "0" } } }
	exhausted._send("logs", "payload", 1)
	ow.test.assert(attempts, 3, "maxRetries counts additional attempts")
	ow.test.assert(exhausted._retryAfter({ "Retry-After": "Thu, 01 Jan 2026 00:00:02 GMT" }, 1767225600000), 2000, "HTTP-date supported")
	ow.test.assert(exhausted._retryAfter({ "retry-after": "invalid" }, exhausted.clock), undefined, "invalid header uses backoff")
})

ow.test.test("nOutput_OpenTelemetry::HTTP client paths, forced content headers and cleanup use isolated instances", () => {
	var original = ow.obj.http, clients = [], calls = []
	ow.obj.http = function(url, method, body, headers, bytes, timeout, stream, options) {
		var instance = { closed: false }
		clients.push(instance)
		this.setThrowExceptions = v => { instance.throws = v }
		this.exec = (url, method, body, headers) => {
			calls.push({ url: url, method: method, body: body, headers: headers, options: options })
			if (body == "throw") throw "sensitive error"
			return { responseCode: 200, response: "{}" }
		}
		this.responseHeaders = () => ({ "retry-after": "1" })
		this.close = () => { instance.closed = true }
	}
	try {
		var o = new nOutput_OpenTelemetry({ endpoint: "https://localhost:4318/base/", headers: { Authorization: "Bearer secret", "content-type": "wrong", ACCEPT: "wrong" } })
		o._request("metrics", "{}", 1000)
		o._request("logs", "{}", 2000)
		try { o._request("logs", "throw", 1000) } catch(e) {}
		ow.test.assert(clients.length, 3, "separate clients per attempt")
		ow.test.assert(clients.every(c => c.closed && c.throws === false), true, "all clients close, including thrown requests")
		ow.test.assert(calls[0].url, "https://localhost:4318/base/v1/metrics", "metrics URL")
		ow.test.assert(calls[1].url, "https://localhost:4318/base/v1/logs", "logs URL")
		ow.test.assert(calls[0].method, "POST", "POST transport")
		ow.test.assert(calls[0].headers, { Authorization: "Bearer secret", "Content-Type": "application/json", Accept: "application/json" }, "content headers forced without removing authentication")
		ow.test.assert(calls[0].options.callTimeout, 1000, "total request timeout")
		ow.test.assert(calls[0].options.followRedirects, false, "credentials do not follow redirects")
	} finally { ow.obj.http = original }
})

ow.test.test("nOutput_OpenTelemetry::AWS validates configuration and loads dependency only when selected", () => {
	var loader = nOutput_OpenTelemetry.prototype._loadAWS, loads = 0
	nOutput_OpenTelemetry.prototype._loadAWS = name => { loads++; throw new Error("provider-secret") }
	try {
		new nOutput_OpenTelemetry({ endpoint: "http://localhost:4318" })
		ow.test.assert(loads, 0, "collector needs no AWS dependency")
		var caught
		try { new nOutput_OpenTelemetry({ aws: { region: "eu-west-1", logGroup: "/test", logStream: "one" } }) } catch(e) { caught = String(e) }
		ow.test.assert(/AWS oPack/.test(caught) && !/provider-secret/.test(caught), true, "missing dependency sanitized")
		nOutput_OpenTelemetry.prototype._loadAWS = () => { loads++; return function() {} }
		caught = undefined
		try { new nOutput_OpenTelemetry({ aws: { region: "eu-west-1" }, includeWarns: false }) } catch(e) { caught = String(e) }
		ow.test.assert(/upgrade AWS/.test(caught), true, "old dependency clear error")
		;[{ aws: {} }, { aws: "bad" }, { aws: { region: "cn-north-1" } },
			{ aws: { region: "us-gov-west-1" } }, { aws: { region: "eu-west-1" } },
			{ endpoint: "http://localhost", aws: { region: "eu-west-1" } },
			{ aws: { region: "eu-west-1", logGroup: "bad\nheader", logStream: "one" } },
			{ aws: { region: "eu-west-1", accessKey: "bad" }, includeWarns: false }
		].forEach(p => {
			var failed = false, before = loads
			try { new nOutput_OpenTelemetry(p) } catch(e) { failed = true }
			ow.test.assert(failed, true, "invalid AWS configuration")
			ow.test.assert(loads, before, "invalid configuration rejected before loading")
		})
		;["Authorization", "HOST", "x-amz-date", "x-amz-security-token", "x-amz-content-sha256", "x-aws-log-group", "x-aws-log-stream", "Proxy-Authorization"].forEach(k => {
			var headers = {}; headers[k] = "bad"
			var failed = false
			try { new nOutput_OpenTelemetry({ aws: { region: "eu-west-1" }, includeWarns: false, headers: headers }) } catch(e) { failed = true }
			ow.test.assert(failed, true, "reserved header " + k)
		})
	} finally { nOutput_OpenTelemetry.prototype._loadAWS = loader }
})

ow.test.test("nOutput_OpenTelemetry::AWS signs exact payload per attempt and accounts for acquisition time", () => {
	var loader = nOutput_OpenTelemetry.prototype._loadAWS, http = ow.obj.http
	var signatures = [], requests = [], clock = 100000, used = 100, fail = false, status = 200
	nOutput_OpenTelemetry.prototype._loadAWS = () => {
		var MockAWS = function() {}
		MockAWS.prototype.signRequest = () => {}
		MockAWS.forSigning = region => ({ signRequest: options => {
			signatures.push(clone(options)); clock += used
			if (fail) throw new Error("provider-secret")
			return merge(options.headers, { Authorization: "signature-" + signatures.length })
		} })
		return MockAWS
	}
	ow.obj.http = function(url, method, body, headers, bytes, timeout, stream, options) {
		this.setThrowExceptions = () => {}
		this.exec = (url, method, body, headers) => {
			requests.push({ url: url, body: body, headers: headers, timeout: timeout, options: options })
			return { responseCode: status, response: "{}" }
		}
		this.responseHeaders = () => ({ "Retry-After": "0" })
		this.close = () => {}
	}
	try {
		var o = new nOutput_OpenTelemetry({ aws: { region: "eu-west-1", logGroup: "/test", logStream: "one" }, timeoutMs: 1000, maxRetries: 1 })
		o._now = () => clock; o._sleep = ms => { clock += ms }
		var messages = []; o._diagnostic = m => messages.push(m)
		var body = '{"unicode":"olá 世界"}'
		o._request("metrics", body, 1000); o._request("logs", body, 1000)
		ow.test.assert(signatures.map(s => s.service), ["monitoring", "logs"], "signing services")
		ow.test.assert(signatures.map(s => s.url), ["https://monitoring.eu-west-1.amazonaws.com/v1/metrics", "https://logs.eu-west-1.amazonaws.com/v1/logs"], "regional endpoints")
		ow.test.assert(signatures[0].headers["x-aws-log-group"], undefined, "metrics has no log routing")
		ow.test.assert(signatures[1].headers["x-aws-log-group"], "/test", "log group routing")
		ow.test.assert(signatures[1].headers["x-aws-log-stream"], "one", "log stream routing")
		ow.test.assert(requests.every((r, i) => r.body === body && signatures[i].body === r.body && r.url === signatures[i].url), true, "signed body is exact sent string")
		ow.test.assert(requests[0].timeout, 900, "credential time deducted")
		ow.test.assert(requests[0].options.followRedirects, false, "redirects disabled")
		status = 503; var before = signatures.length
		o._send("logs", body, 1)
		ow.test.assert(signatures.length - before, 2, "retry signed again")
		ow.test.assert(requests[2].headers.Authorization != requests[3].headers.Authorization, true, "fresh signature per retry")
		before = requests.length; fail = true
		o._send("logs", body, 1)
		ow.test.assert(requests.length, before, "no unsigned fallback")
		ow.test.assert(messages.some(m => /AWS signing failed/.test(m)), true, "signing failure diagnosed")
		ow.test.assert(messages.some(m => /provider-secret/.test(m)), false, "provider error hidden")
		fail = false; used = 20000; o._send("metrics", body, 1)
		ow.test.assert(requests.length, before, "no HTTP after deadline")
	} finally { nOutput_OpenTelemetry.prototype._loadAWS = loader; ow.obj.http = http }
})

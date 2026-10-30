// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_OpenTelemetry(aMap)</key>
 * Pushes current attribute values as OTLP/HTTP JSON gauges and warning updates
 * as logs. See docs/OPENTELEMETRY.md for configuration and delivery semantics.
 * </odoc>
 */
var nOutput_OpenTelemetry = function(aMap) {
	var p = isMap(aMap) ? clone(aMap) : {}
	var fail = message => { throw new Error("nOutput_OpenTelemetry: " + message) }
	this.aws = p.aws
	if (isDef(this.aws)) {
		if (!isMap(this.aws) || Object.keys(this.aws).some(k => ["region", "logGroup", "logStream"].indexOf(k) < 0)) fail("aws must contain only region, logGroup and logStream")
		if (isDef(p.endpoint)) fail("aws and endpoint are mutually exclusive")
		if (!isString(this.aws.region) || !/^(us|eu|ap|sa|ca|me|af|il|mx)-(?!gov-)[a-z]+-\d+$/.test(this.aws.region)) fail("aws.region must be a commercial AWS region")
		;["logGroup", "logStream"].forEach(k => {
			if ((p.includeWarns !== false || isDef(this.aws[k])) &&
				(!isString(this.aws[k]) || !this.aws[k].trim().length || /[\r\n]/.test(this.aws[k]) || this.aws[k] != this.aws[k].trim())) fail("aws." + k + " is required for warnings and must be a nonempty header value")
		})
	} else {
		if (!isString(p.endpoint)) fail("endpoint is required")
		try {
			var uri = new java.net.URI(p.endpoint)
			if (!/^(http|https)$/.test(String(uri.getScheme())) || isNull(uri.getHost()) ||
				!isNull(uri.getUserInfo()) || !isNull(uri.getQuery()) || !isNull(uri.getFragment())) fail("invalid endpoint")
		} catch(e) { fail("endpoint must be an HTTP(S) base URL without credentials, query or fragment") }
		this.endpoint = p.endpoint.replace(/\/+$/, "")
	}
	this.headers = isUnDef(p.headers) ? {} : p.headers
	if (!isMap(this.headers)) fail("headers must be a map")
	var headerNames = Object.create(null)
	Object.keys(this.headers).forEach(k => {
		var name = k.toLowerCase()
		if (isDef(this.aws) && (headerNames[name] || /^(authorization|proxy-authorization|host|x-amz-.*|x-aws-log-group|x-aws-log-stream|content-length|transfer-encoding|connection)$/.test(name))) fail("reserved or duplicate AWS header")
		headerNames[name] = true
		if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k) || !isString(this.headers[k]) || /[\r\n]/.test(this.headers[k])) fail("invalid header")
	})
	;["includeValues", "includeWarns"].forEach(k => {
		if (isDef(p[k]) && !isBoolean(p[k])) fail(k + " must be boolean")
		this[k] = isUnDef(p[k]) ? true : p[k]
	})
	;["include", "exclude", "labelFields"].forEach(k => {
		if (isDef(p[k]) && (!isArray(p[k]) || p[k].some(v => !isString(v)))) fail(k + " must be an array of strings")
	})
	try {
		this.include = isDef(p.include) ? p.include.map(v => new RegExp(v)) : undefined
		this.exclude = (p.exclude || []).map(v => new RegExp(v))
	} catch(e) { fail("include/exclude contain an invalid regular expression") }
	this.labelFields = p.labelFields || []
	if (this.labelFields.some(k => k.indexOf("nattrmon.") == 0)) fail("labelFields cannot use the reserved nattrmon. prefix")
	this.metricPrefix = isUnDef(p.metricPrefix) ? "nattrmon" : p.metricPrefix
	if (!isString(this.metricPrefix)) fail("metricPrefix must be a string")
	this.metricOverrides = isUnDef(p.metricOverrides) ? {} : p.metricOverrides
	if (!isMap(this.metricOverrides)) fail("metricOverrides must be a map")
	Object.keys(this.metricOverrides).forEach(k => {
		var o = this.metricOverrides[k]
		if (!isMap(o) || Object.keys(o).some(f => ["name", "unit", "description"].indexOf(f) < 0 || !isString(o[f]))) fail("invalid metricOverrides entry")
		if (isDef(o.name) && !this._validName(o.name)) fail("invalid metric override name")
	})
	;[ ["timeoutMs", 5000, 1], ["maxRetries", 2, 0], ["maxBatchSize", 500, 1], ["maxPayloadBytes", 1048576, 1] ].forEach(v => {
		var n = isUnDef(p[v[0]]) ? v[1] : p[v[0]]
		if (typeof n != "number" || !isFinite(n) || Math.floor(n) != n || n < v[2]) fail(v[0] + " must be an integer >= " + v[2])
		this[v[0]] = n
	})
	var resource = isUnDef(p.resourceAttributes) ? {} : p.resourceAttributes
	if (!isMap(resource)) fail("resourceAttributes must be a map")
	resource = merge({ "service.name": "nattrmon" }, resource)
	this.resource = { attributes: this._attributes(resource) }
	ow.loadObj()
	if (isDef(this.aws)) {
		try { var awsType = this._loadAWS() } catch(e) { fail("AWS oPack with signRequest and forSigning is required") }
		if (!isDef(awsType) || !isFunction(awsType.prototype.signRequest) || !isFunction(awsType.forSigning)) fail("AWS oPack with signRequest and forSigning is required; upgrade AWS")
		this.awsClient = awsType.forSigning(this.aws.region)
	}
	nOutput.call(this, this.output)
}
inherit(nOutput_OpenTelemetry, nOutput)

nOutput_OpenTelemetry.prototype._loadAWS = function() {
	loadLib("aws_core.js")
	return typeof AWS == "undefined" ? undefined : AWS
}

nOutput_OpenTelemetry.prototype._validName = function(name) {
	return /^[A-Za-z][A-Za-z0-9_.\-/]{0,254}$/.test(name)
}

// These helpers keep wire types explicit; no OpenMetrics text round trip.
nOutput_OpenTelemetry.prototype._anyValue = function(v) {
	if (isString(v)) return { stringValue: v }
	if (isBoolean(v)) return { boolValue: v }
	if (isNumber(v) && isFinite(v)) return { doubleValue: v }
	if (isArray(v)) return { arrayValue: { values: v.map(x => this._anyValue(x)) } }
	if (isMap(v) && !isDate(v)) return { kvlistValue: { values: this._attributes(v) } }
	throw new Error("nOutput_OpenTelemetry: unsupported attribute value")
}

nOutput_OpenTelemetry.prototype._attributes = function(map) {
	return Object.keys(map).sort().map(k => ({ key: k, value: this._anyValue(map[k]) }))
}

nOutput_OpenTelemetry.prototype._time = function(value, fallback) {
	var ms = isDate(value) || isString(value) || typeof value == "number" ? new Date(value).getTime() : NaN
	if (!isFinite(ms) || ms < 0 || ms > 18446744073709) ms = fallback
	// All JavaScript Date milliseconds are exact integers. BigInteger avoids
	// losing precision when converting those milliseconds to uint64 nanoseconds.
	return String(new java.math.BigInteger(String(ms)).multiply(new java.math.BigInteger("1000000")))
}

nOutput_OpenTelemetry.prototype._selected = function(name) {
	return (isUnDef(this.include) || this.include.some(r => r.test(name))) && !this.exclude.some(r => r.test(name))
}

nOutput_OpenTelemetry.prototype._metrics = function(values, observed) {
	var records = [], identities = Object.create(null), points = Object.create(null)
	values.forEach(value => {
		if (!isMap(value) || !isString(value.name) || !this._selected(value.name)) return
		var time = this._time(value.date, observed)
		var walk = (v, path, labels, depth) => {
			if (typeof v == "number" && isFinite(v) || isBoolean(v)) {
				var generated = [this.metricPrefix, value.name].concat(path).filter(s => s.length > 0).join("_").replace(/[^A-Za-z0-9_]/g, "_")
				if (!/^[A-Za-z]/.test(generated)) generated = "n_" + generated
				var override = this.metricOverrides[generated] || {}
				var name = isDef(override.name) ? override.name : generated
				if (!this._validName(name)) throw new Error("nOutput_OpenTelemetry: generated metric name exceeds 255 characters")
				var identity = JSON.stringify([value.name, path])
				if (isDef(identities[name]) && identities[name] != identity) throw new Error("nOutput_OpenTelemetry: conflicting metric names; use distinct attribute/field names")
				identities[name] = identity
				var attrs = this._attributes(labels)
				var pointKey = JSON.stringify([name, attrs, time])
				if (isDef(points[pointKey])) throw new Error("nOutput_OpenTelemetry: duplicate metric point")
				points[pointKey] = true
				records.push({ name: name, unit: override.unit || "", description: override.description || "",
					point: { attributes: attrs, timeUnixNano: time, asDouble: isBoolean(v) ? (v ? 1 : 0) : v } })
			} else if (isArray(v)) {
				v.forEach((row, i) => {
					var rowLabels = clone(labels)
					rowLabels["nattrmon.array.index." + depth] = String(i)
					if (isMap(row)) this.labelFields.forEach(k => {
						if (isString(row[k])) rowLabels[k] = row[k]
					})
					walk(row, path, rowLabels, depth + 1)
				})
			} else if (isMap(v) && !isDate(v)) {
				Object.keys(v).sort().forEach(k => walk(v[k], path.concat([k]), labels, depth))
			}
		}
		walk(value.val, [], {}, 0)
	})
	return records
}

nOutput_OpenTelemetry.prototype._logs = function(values, observed) {
	var levels = { High: 17, Medium: 13, Low: 13, Info: 9, Closed: 9 }
	return values.filter(v => isMap(v) && isString(v.title) && this._selected(v.title)).map(v => {
		var attrs = { "nattrmon.warning.title": v.title }
		if (isString(v.level)) attrs["nattrmon.warning.level"] = v.level
		if (isDef(v.category)) attrs["nattrmon.warning.category"] = v.category
		if (isDef(v.createdate)) attrs["nattrmon.warning.createdate"] = this._time(v.createdate, observed)
		return { timeUnixNano: this._time(v.lastupdate, observed), observedTimeUnixNano: this._time(undefined, observed),
			severityNumber: Object.prototype.hasOwnProperty.call(levels, v.level) ? levels[v.level] : 0,
			severityText: isString(v.level) ? v.level : "Unspecified",
			body: { stringValue: isString(v.description) ? v.description : v.title }, attributes: this._attributes(attrs) }
	})
}

nOutput_OpenTelemetry.prototype._envelope = function(signal, records) {
	var scope = { name: "nattrmon.output.opentelemetry" }
	if (signal == "logs") return { resourceLogs: [{ resource: this.resource, scopeLogs: [{ scope: scope, logRecords: records }] }] }
	var metrics = [], byName = Object.create(null)
	records.forEach(r => {
		if (isUnDef(byName[r.name])) {
			byName[r.name] = { name: r.name, unit: r.unit, description: r.description, gauge: { dataPoints: [] } }
			metrics.push(byName[r.name])
		}
		byName[r.name].gauge.dataPoints.push(r.point)
	})
	return { resourceMetrics: [{ resource: this.resource, scopeMetrics: [{ scope: scope, metrics: metrics }] }] }
}

nOutput_OpenTelemetry.prototype._bytes = function(body) {
	return new java.lang.String(body).getBytes("UTF-8").length
}

// One client per attempt: response state is never shared by simultaneous output
// calls. Closing it also releases response bodies on errors and timeouts.
nOutput_OpenTelemetry.prototype._request = function(signal, body, timeout) {
	var deadline = this._now() + timeout, url = this.endpoint + "/v1/" + signal
	var headers = {}
	Object.keys(this.headers).forEach(k => { if (["content-type", "accept"].indexOf(k.toLowerCase()) < 0) headers[k] = this.headers[k] })
	headers["Content-Type"] = "application/json"
	headers.Accept = "application/json"
	if (isDef(this.aws)) {
		var service = signal == "metrics" ? "monitoring" : "logs"
		url = "https://" + service + "." + this.aws.region + ".amazonaws.com/v1/" + signal
		if (signal == "logs") {
			headers["x-aws-log-group"] = this.aws.logGroup
			headers["x-aws-log-stream"] = this.aws.logStream
		}
		try {
			headers = this.awsClient.signRequest({ method: "POST", url: url, region: this.aws.region,
				service: service, body: body, headers: headers, timeoutMs: timeout })
		} catch(e) { return { status: -1, headers: {} } }
		timeout = deadline - this._now()
		if (timeout <= 0) return { status: -1, headers: {} }
	}
	var h = new ow.obj.http(undefined, undefined, undefined, undefined, undefined, timeout, undefined,
		{ timeout: timeout, readTimeout: timeout, writeTimeout: timeout, callTimeout: timeout, followRedirects: false, followSslRedirects: false })
	try {
		h.setThrowExceptions(false)
		var result = h.exec(url, "POST", body, headers)
		return { status: result.responseCode, body: result.response, headers: h.responseHeaders() || {} }
	} finally { h.close() }
}

nOutput_OpenTelemetry.prototype._now = function() { return Date.now() }
nOutput_OpenTelemetry.prototype._sleep = function(ms) { sleep(ms, true) }
nOutput_OpenTelemetry.prototype._diagnostic = function(message) { logWarn("nOutput_OpenTelemetry: " + message) }

nOutput_OpenTelemetry.prototype._retryAfter = function(headers, nowMs) {
	var value
	Object.keys(headers).forEach(k => { if (k.toLowerCase() == "retry-after") value = headers[k] })
	if (isArray(value)) value = value[0]
	if (isUnDef(value)) return undefined
	if (/^\d+$/.test(String(value))) return Number(value) * 1000
	var parsed = Date.parse(String(value))
	return isFinite(parsed) ? Math.max(0, parsed - nowMs) : undefined
}

nOutput_OpenTelemetry.prototype._send = function(signal, body, count) {
	var deadline = this._now() + 20000
	for (var attempt = 0; attempt <= this.maxRetries; attempt++) {
		var remaining = deadline - this._now()
		if (remaining <= 0) break
		var response
		try { response = this._request(signal, body, Math.min(this.timeoutMs, remaining)) } catch(e) { response = { status: 0, headers: {} } }
		if (response.status == -1) {
			this._diagnostic(signal + ": AWS signing failed or deadline expired; dropped " + count + " records")
			return 0
		}
		if (response.status == 200) {
			var decoded
			try { decoded = JSON.parse(response.body) } catch(e) {
				this._diagnostic(signal + ": invalid success response; delivery unconfirmed for " + count + " records")
				return 0
			}
			if (!isMap(decoded)) {
				this._diagnostic(signal + ": invalid success response; delivery unconfirmed for " + count + " records")
				return 0
			}
			if (isDef(decoded.partialSuccess)) {
				var partial = decoded.partialSuccess
				var rejected = isMap(partial) ? partial[signal == "metrics" ? "rejectedDataPoints" : "rejectedLogRecords"] : undefined
				if (isMap(partial) && isUnDef(rejected)) rejected = 0
				// Never print remote errorMessage: a receiver may echo credentials or data.
				var safeCount = /^\d+$/.test(String(rejected)) && Number(rejected) <= count ? String(rejected) : "unspecified"
				// Some receivers serialize the default empty partialSuccess object.
				if (safeCount == "0" && !partial.errorMessage) return count
				this._diagnostic(signal + ": partial success; rejected=" + safeCount + "; request will not be retried")
				return safeCount == "unspecified" ? 0 : count - Number(safeCount)
			}
			return count
		}
		if ([0, 429, 502, 503, 504].indexOf(response.status) < 0) {
			this._diagnostic(signal + ": HTTP " + response.status + "; dropped " + count + " records")
			return 0
		}
		if (attempt == this.maxRetries) break
		var delay = this._retryAfter(response.headers || {}, this._now())
		if (isUnDef(delay)) delay = Math.min(5000, 500 * Math.pow(2, attempt)) * (0.5 + Math.random())
		if (delay >= deadline - this._now()) break
		this._sleep(Math.ceil(delay))
	}
	this._diagnostic(signal + ": retry budget exhausted; dropped " + count + " records (delivery may be ambiguous)")
	return 0
}

nOutput_OpenTelemetry.prototype._export = function(signal, records) {
	var batch = [], body, result = { sent: 0, dropped: 0 }
	var flush = () => {
		if (!batch.length) return
		var accepted = this._send(signal, body, batch.length)
		result.sent += accepted
		result.dropped += batch.length - accepted
		batch = []
	}
	records.forEach(record => {
		if (batch.length >= this.maxBatchSize) flush()
		var candidate = JSON.stringify(this._envelope(signal, batch.concat([record])))
		if (this._bytes(candidate) > this.maxPayloadBytes && batch.length) {
			flush()
			candidate = JSON.stringify(this._envelope(signal, [record]))
		}
		if (this._bytes(candidate) > this.maxPayloadBytes) {
			result.dropped++
			this._diagnostic(signal + ": dropped one oversized record")
		} else {
			batch.push(record)
			body = candidate
		}
	})
	flush()
	return result
}

nOutput_OpenTelemetry.prototype.output = function(scope, args) {
	if (isUnDef(args) || ["set", "setall"].indexOf(args.op) < 0) return
	var values = args.op == "set" ? [args.v] : args.v
	if (!isArray(values)) return
	var observed = this._now()
	if (this.includeValues && /^nattrmon::cvals(?:::buffer)?$/.test(args.ch)) return this._export("metrics", this._metrics(values, observed))
	if (this.includeWarns && /^nattrmon::warnings(?:::buffer)?$/.test(args.ch)) return this._export("logs", this._logs(values, observed))
}

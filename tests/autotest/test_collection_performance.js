// Behavioral equivalence and deterministic work counts for collection/export hot paths.
load(NATTRMON_HOME + "/config/objects/nOutput_OpenTelemetry.js")

var __remediationLegacyExport = function(output, signal, records) {
	var batch = [], body, result = { sent: 0, dropped: 0 }
	var flush = () => {
		if (!batch.length) return
		var accepted = output._send(signal, body, batch.length)
		result.sent += accepted; result.dropped += batch.length - accepted; batch = []
	}
	records.forEach(record => {
		if (batch.length >= output.maxBatchSize) flush()
		var candidate = JSON.stringify(output._envelope(signal, batch.concat([record])))
		if (output._bytes(candidate) > output.maxPayloadBytes && batch.length) {
			flush(); candidate = JSON.stringify(output._envelope(signal, [record]))
		}
		if (output._bytes(candidate) > output.maxPayloadBytes) {
			result.dropped++; output._diagnostic(signal + ": dropped one oversized record")
		} else { batch.push(record); body = candidate }
	})
	flush(); return result
}
var __remediationOTLP = function() {
	var out = new nOutput_OpenTelemetry({ endpoint: "http://localhost:4318", resourceAttributes: { label: "é漢字🚀\"\\\n" } })
	out.bodies = []; out.diagnostics = []
	out._send = (signal, body, count) => { out.bodies.push(body); return count }
	out._diagnostic = msg => out.diagnostics.push(msg)
	return out
}

ow.test.test("remediation::OTLP fragments exactly match legacy batching for Unicode and interleaved metrics", () => {
	var template = __remediationOTLP()
	var logs = template._logs([1, 2, 3, 4, 5].map(i => ({ title: "警告" + i, description: "é漢字🚀\"\\\n".repeat(i), lastupdate: 1700000000000 })), 1700000000000)
	var metrics = ["a", "b", "a", "c", "b", "a"].map((name, i) => ({ name: name, unit: i % 2 ? "By" : undefined, description: "é漢字🚀\"\\\n" + i, point: { asDouble: i, attributes: [{ key: "id", value: { stringValue: "é" + i } }] } }))
	;[{ signal: "logs", records: logs }, { signal: "metrics", records: metrics }].forEach(test => {
		var one = template._bytes(JSON.stringify(template._envelope(test.signal, [test.records[0]])))
		var two = template._bytes(JSON.stringify(template._envelope(test.signal, test.records.slice(0, 2))))
		;[1, 2, 4, 500].forEach(countLimit => {
			;[1, one - 1, one, one + 1, two - 1, two, two + 1, 100000].forEach(byteLimit => {
				var legacy = __remediationOTLP(), current = __remediationOTLP()
				legacy.maxBatchSize = current.maxBatchSize = countLimit
				legacy.maxPayloadBytes = current.maxPayloadBytes = byteLimit
				var before = __remediationLegacyExport(legacy, test.signal, test.records), after = current._export(test.signal, test.records)
				ow.test.assert(after, before, "record acceptance matches at count " + countLimit + " bytes " + byteLimit)
				ow.test.assert(current.bodies, legacy.bodies, "byte-identical bodies and first-occurrence grouping")
				ow.test.assert(current.diagnostics, legacy.diagnostics, "oversized diagnostics preserved")
			})
		})
	})
})

ow.test.test("remediation::OTLP byte-accounting work grows linearly with records", () => {
	var out = __remediationOTLP(), measured = [], original = out._bytes, visits = 0
	out.maxBatchSize = 10000
	out.maxPayloadBytes = 10000000
	out._bytes = body => { visits += body.length; return original(body) }
	;[200, 400].forEach(size => {
		visits = 0
		var records = []
		for (var i = 0; i < size; i++) records.push({ name: "same", unit: "By", description: "bytes", point: { asDouble: 1 } })
		out._export("metrics", records)
		measured.push(visits)
	})
	ow.test.assert(measured[1] <= measured[0] * 2, true, "doubling records at most doubles measured text")
	ow.test.assert(measured[0] < 30000, true, "no growing candidate bodies are measured")
})

ow.test.test("remediation::DB reads and clones only each requested last value at query time", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_DB.js")
	var oldNm = global.nattrmon, oldParallel = parallel4Array, oldTemplate = templify, reads = [], captured = [], queries = []
	var source = { first: { name: "first", val: { count: 1 }, date: new Date(1700000000000) }, second: { name: "second", val: { count: 2 }, date: new Date(1700000001000) } }
	try {
		var seq = (items, fn) => items.map(fn)
		var template = (tpl, data) => {
			if (tpl.indexOf("SELECT") == 0) {
				captured.push(clone(data.lastValue)); data.lastValue.val.count = 999
				return tpl
			}
			return oldTemplate(tpl, data)
		}
		global.nattrmon = { isObjectPool: () => true, useObject: (key, fn) => fn({ q: sql => { queries.push(sql); source.second.val.count = 3; return { results: [{ result: 7 }] } }, rollback: () => {} }) }
		var scope = { getAttributes: () => ({ getAttributeByName: () => ({}) }), getLastValues: full => {
			if (full !== true) throw "full-map reads are forbidden"
			return { get: key => { reads.push(key.name); return source[key.name] }, getAll: () => { throw "unrequested values were read" } }
		} }
		var Input = (new Function("parallel4Array", "templify", io.readFileString(NATTRMON_HOME + "/config/objects/nInput_DB.js") + "\nreturn nInput_DB"))(seq, template)
		var input = new Input({ key: "db", sqls: { first: "SELECT 1", second: "SELECT 2" } }), result = input.input(scope, {})
		ow.test.assert(reads, ["first", "second"], "exactly one key read per query")
		ow.test.assert(captured.map(r => r.val.count), [1, 3], "reads occur per query rather than once before all queries")
		ow.test.assert(captured[0].name, "first", "full entry shape including name is retained")
		ow.test.assert(source.first.val.count, 1, "templating cannot mutate channel entry")
		ow.test.assert(result, { first: 7, second: 7 }, "query output simplification remains intact")
	} finally { global.nattrmon = oldNm; global.parallel4Array = oldParallel; global.templify = oldTemplate }
})

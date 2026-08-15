// Phase 7 -- nOutput_Prometheus.js pure-logic coverage: metric-name
// sanitization, adaptive step-sizing, and query_range response parsing
// (scalar + wildcard map-reconstruction), fixture-driven with no live
// Prometheus. Only _queryRange's actual $rest() call is untested here --
// these methods are pure and touch neither $rest nor nattrmon, so they're
// tested directly against a bare prototype instance (same idiom as
// test_phase5_httpmetrics_filter.js).

var __newPromInstance = (overrides) => {
	load(NATTRMON_HOME + "/config/objects/nOutput_Prometheus.js")
	var o = Object.create(nOutput_Prometheus.prototype)
	o.metricPrefix = "nattrmon"
	o.step = 15
	o.maxPoints = 10000
	o.eventsLookbackSeconds = 86400
	Object.keys(overrides || {}).forEach(k => { o[k] = overrides[k] })
	return o
}

ow.test.test("nOutput_Prometheus::_metricName sanitizes non-alphanumerics like nOutput_HTTP_Metrics does", () => {
	var o = __newPromInstance()
	ow.test.assert(o._metricName("cpu.load"), "nattrmon_cpu_load", "dots should become underscores")
	ow.test.assert(o._metricName("disk/free space"), "nattrmon_disk_free_space", "slashes and spaces should become underscores")
	ow.test.assert(o._metricName("1abc"), "nattrmon_1abc", "only non-alphanumeric characters are substituted")
})

ow.test.test("nOutput_Prometheus::_adaptiveStep widens step to stay under maxPoints for wide windows", () => {
	var o = __newPromInstance({ step: 15, maxPoints: 100 })
	ow.test.assert(o._adaptiveStep(0, 60), 15, "a narrow window should keep the configured floor step")
	ow.test.assert(o._adaptiveStep(0, 10000), 100, "(10000-0)/100 = 100s step, wider than the 15s floor")
})

ow.test.test("nOutput_Prometheus::_parseRangeResponse returns [] on error status without throwing", () => {
	var o = __newPromInstance()
	ow.test.assert(o._parseRangeResponse({ status: "error", error: "boom" }, "num"), [], "error responses should not throw, just return []")
})

ow.test.test("nOutput_Prometheus::_parseRangeResponse returns [] on empty matrix (the normal 'not a scalar' signal)", () => {
	var o = __newPromInstance()
	var raw = { status: "success", data: { resultType: "matrix", result: [] } }
	ow.test.assert(o._parseRangeResponse(raw, "num"), [], "empty result should return [] without logging an error")
})

ow.test.test("nOutput_Prometheus::_parseRangeResponse parses a populated scalar matrix, newest first", () => {
	var o = __newPromInstance()
	var raw = { status: "success", data: { resultType: "matrix", result: [
		{ metric: { __name__: "nattrmon_cpu" }, values: [ [ 1000, "1" ], [ 1010, "2" ] ] }
	] } }
	var r = o._parseRangeResponse(raw, "num")
	ow.test.assert(r.length, 2, "both samples should be parsed")
	ow.test.assert(r[0].val, 2, "results should be sorted newest first")
	ow.test.assert(r[1].val, 1, "oldest sample should be last")
})

ow.test.test("nOutput_Prometheus::_parseRangeResponse coerces semaphore-typed values to boolean", () => {
	var o = __newPromInstance()
	var raw = { status: "success", data: { resultType: "matrix", result: [
		{ metric: { __name__: "nattrmon_sem" }, values: [ [ 1000, "1" ], [ 1010, "0" ] ] }
	] } }
	var r = o._parseRangeResponse(raw, nAttribute.TYPE_SEMAPHORE)
	ow.test.assert(r[0].val, false, "'0' should coerce to false for semaphore-typed attributes (newest sample is '0')")
	ow.test.assert(r[1].val, true, "'1' should coerce to true for semaphore-typed attributes")
})

ow.test.test("nOutput_Prometheus::_parseMapRangeResponse reconstructs a flat map from leaf series", () => {
	var o = __newPromInstance()
	var raw = { status: "success", data: { resultType: "matrix", result: [
		{ metric: { __name__: "nattrmon_cpu_load" }, values: [ [ 1000, "1" ] ] },
		{ metric: { __name__: "nattrmon_cpu_idle" }, values: [ [ 1000, "99" ] ] }
	] } }
	var r = o._parseMapRangeResponse(raw, "nattrmon_cpu", "num")
	ow.test.assert(r.length, 1, "one record per aligned timestamp")
	ow.test.assert(r[0].val, { load: 1, idle: 99 }, "leaf series should be reconstructed into a flat map keyed by their name suffix")
})

ow.test.test("nOutput_Prometheus::_parseMapRangeResponse returns [] when nothing matched the wildcard", () => {
	var o = __newPromInstance()
	var raw = { status: "success", data: { resultType: "matrix", result: [] } }
	ow.test.assert(o._parseMapRangeResponse(raw, "nattrmon_missing", "num"), [], "an attribute with no numeric leaves anywhere is simply not recoverable")
})

ow.test.test("nOutput_Prometheus::getValuesByEvents slices the N most recent samples", () => {
	var o = harness.stubNattrmon({ debug: function() {} })
	var pr = __newPromInstance({
		getValuesByTime: function(name, secs) {
			return [ { val: 3, date: "t3" }, { val: 2, date: "t2" }, { val: 1, date: "t1" } ]
		}
	})
	var r = pr.getValuesByEvents("attr", 2)
	ow.test.assert(r, [ { val: 3, date: "t3" }, { val: 2, date: "t2" } ], "should return the first N (most recent, since getValuesByTime is newest-first) samples")
})

ow.test.test("nOutput_Prometheus::getValuesByEvents returns fewer than N without throwing when the window is short", () => {
	harness.stubNattrmon({ debug: function() {} })
	var pr = __newPromInstance({ getValuesByTime: function() { return [ { val: 1, date: "t1" } ] } })
	var r = pr.getValuesByEvents("attr", 5)
	ow.test.assert(r.length, 1, "should return however many samples exist even if fewer than requested")
})

// Phase 6.1/6.3 -- descriptor schema validation and legacy-key compatibility map
// - legacy descriptor keys are normalized to canonical keys
// - strict mode can fail malformed descriptors early
// - HTTP outputs use shared core route/auth preprocess helpers

ow.test.test("nmain exposes descriptor schema + legacy key helpers", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")
	ow.test.assert(src.indexOf("normalizeDescriptorLegacyKeys") >= 0, true, "legacy-key normalization helper should exist")
	ow.test.assert(src.indexOf("validateDescriptorSchema") >= 0, true, "descriptor schema validation helper should exist")
	ow.test.assert(src.indexOf("__NAM_DESCRIPTOR_SCHEMA_STRICT") >= 0, true, "descriptor strict-mode flag should exist")
})

ow.test.test("nmain::normalizeDescriptorLegacyKeys maps legacy casing to canonical keys", () => {
	var nm = harness.newEngine({}, { name: "desc-legacy" })

	global.nInput_TestCtor_Legacy = function(aMap) {
		this.input = function(scope, args) { return {} }
		nInput.call(this, this.input)
	}
	inherit(nInput_TestCtor_Legacy, nInput)

	try {
		var y = nm.loadObject({
			name: "legacy-case",
			execfrom: "nInput_TestCtor_Legacy",
			timeinterval: 1000,
			waitforfinish: true,
			onlyonevent: false,
			killafterminutes: 5,
			execargs: {}
		}, "input")

		ow.test.assert(isDef(y.execFrom), true, "execfrom should be normalized to execFrom")
		ow.test.assert(y.execFrom, "nInput_TestCtor_Legacy", "normalized execFrom value should be preserved")
		ow.test.assert(y.timeInterval, 1000, "timeinterval should be normalized to timeInterval")
		ow.test.assert(y.waitForFinish, true, "waitforfinish should be normalized to waitForFinish")
		ow.test.assert(y.onlyOnEvent, false, "onlyonevent should be normalized to onlyOnEvent")
		ow.test.assert(y.killAfterMinutes, 5, "killafterminutes should be normalized to killAfterMinutes")
		ow.test.assert(isDef(y.execArgs), true, "execargs should be normalized to execArgs")
		ow.test.assert(isDef(y.exec), true, "normalized execFrom should still resolve constructor")
	} finally {
		try { delete global.nInput_TestCtor_Legacy } catch(e) {}
		harness.stopEngine(nm)
	}
})

ow.test.test("nmain::validateDescriptorSchema strict mode fails malformed descriptors", () => {
	var nm = harness.newEngine({
		__NAM_DESCRIPTOR_SCHEMA_STRICT: true,
		__NAM_DESCRIPTOR_SCHEMA_WARN: true
	}, { name: "desc-strict" })

	try {
		var failed = false
		try {
			nm.loadObject({ name: "bad-desc", waitForFinish: "yes" }, "input")
		} catch(e) {
			failed = true
		}
		ow.test.assert(failed, true, "strict descriptor mode should reject malformed descriptors")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("HTTP output plugins use shared core helpers for route/auth preprocessing", () => {
	var files = [
		"/config/objects/nOutput_HTTP.js",
		"/config/objects/nOutput_HTTP_JSON.js",
		"/config/objects/nOutput_HTTP_HealthZ.js",
		"/config/objects/nOutput_HTTP_Status.js",
		"/config/objects/nOutput_HTTP_Metrics.js"
	]

	files.forEach(f => {
		var src = io.readFileString(NATTRMON_HOME + f)
		ow.test.assert(src.indexOf("nattrmon.getHttpRouteHelpers(") >= 0, true, f + " should use getHttpRouteHelpers")
		ow.test.assert(src.indexOf("nattrmon.getHttpPreProcessFn(") >= 0, true, f + " should use getHttpPreProcessFn")
	})
})

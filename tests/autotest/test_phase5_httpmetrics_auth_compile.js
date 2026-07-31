// Phase 5.3/5.5 -- #26: nOutput_HTTP_Metrics.js's fnAuth compiled the
// custom-auth function with `new Function` on every request, same pattern as
// nOutput_HTTP.js (already covered end-to-end in test_phase5_http_close.js).
// Verified at the source level here to keep this file focused.

ow.test.test("nOutput_HTTP_Metrics::the custom-auth handler is compiled once, not per request", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Metrics.js")

	ow.test.assert(/var fnAuth = function[\s\S]{0,300}new Function/.test(src), false, "fnAuth's body must not contain a `new Function` call")
	ow.test.assert(/var fnCustomAuth\s*=[\s\S]{0,300}new Function/.test(src), true, "the custom-auth handler must be compiled once, outside fnAuth, into fnCustomAuth")
	ow.test.assert(/return fnCustomAuth\(u, p, s, r\)/.test(src), true, "fnAuth should invoke the precompiled fnCustomAuth")
})

var __assertCustomAuthPrecompiled = function(filePath, fnAuthName) {
	var src = io.readFileString(filePath)
	ow.test.assert(new RegExp("var " + fnAuthName + " = function[\\s\\S]{0,300}new Function").test(src), false, fnAuthName + " body must not contain a `new Function` call")
	ow.test.assert(/var fnCustomAuth\s*=[\s\S]{0,300}new Function/.test(src), true, "custom-auth handler must be compiled once into fnCustomAuth")
	ow.test.assert(/return fnCustomAuth\(u, p, s, r\)/.test(src), true, fnAuthName + " should invoke precompiled fnCustomAuth")
}

ow.test.test("nOutput_HTTP_JSON::the custom-auth handler is compiled once, not per request", () => {
	__assertCustomAuthPrecompiled(NATTRMON_HOME + "/config/objects/nOutput_HTTP_JSON.js", "fnAuth")
})

ow.test.test("nOutput_HTTP_HealthZ::the custom-auth handler is compiled once, not per request", () => {
	__assertCustomAuthPrecompiled(NATTRMON_HOME + "/config/objects/nOutput_HTTP_HealthZ.js", "fnAuth")
})

ow.test.test("nOutput_HTTP_Status::the custom-auth handler is compiled once, not per request", () => {
	__assertCustomAuthPrecompiled(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Status.js", "fnAuth")
})

ow.test.test("nInput_Channel::the custom-auth handler is compiled once, not per auth check", () => {
	__assertCustomAuthPrecompiled(NATTRMON_HOME + "/config/objects/nInput_Channel.js", "chAuth")
})

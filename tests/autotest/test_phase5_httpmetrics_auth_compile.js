// Phase 5.3/5.5 -- #26: nOutput_HTTP_Metrics.js's fnAuth compiled the
// custom-auth function with `new Function` on every request, same pattern as
// nOutput_HTTP.js (already covered end-to-end in test_phase5_http_close.js).
// Verified at the source level here to keep this file focused.

ow.test.test("nOutput_HTTP_Metrics::the custom-auth handler is compiled once, not per request", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Metrics.js")

	ow.test.assert(/var fnAuth = function[\s\S]{0,300}new Function/.test(src), false, "fnAuth's body must not contain a `new Function` call")
	ow.test.assert(
		src.indexOf("nattrmon.getPrecompiledAuthFn(") >= 0 || src.indexOf("nattrmon.getHttpPreProcessFn(") >= 0,
		true,
		"custom auth should be provided by getPrecompiledAuthFn directly or via the shared getHttpPreProcessFn helper"
	)
})

var __assertCustomAuthPrecompiled = function(filePath, fnAuthName) {
	var src = io.readFileString(filePath)
	ow.test.assert(new RegExp("var " + fnAuthName + " = function[\\s\\S]{0,300}new Function").test(src), false, fnAuthName + " body must not contain a `new Function` call")
	ow.test.assert(
		src.indexOf("nattrmon.getPrecompiledAuthFn(") >= 0 || src.indexOf("nattrmon.getHttpPreProcessFn(") >= 0,
		true,
		"custom auth should come from getPrecompiledAuthFn directly or from the shared getHttpPreProcessFn helper"
	)
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

ow.test.test("nmain::getPrecompiledAuthFn handles perms and custom-auth paths", () => {
	var nm = harness.newEngine({}, { name: "auth-helper" })

	var permReply = {}
	var permFn = nm.getPrecompiledAuthFn({
		adm: { p: "Password1", m: "rw" }
	})
	ow.test.assert(permFn("adm", "Password1", __, permReply), true, "perm auth should accept matching credentials")
	ow.test.assert(permFn("adm", "bad", __, {}), false, "perm auth should reject invalid credentials")
	ow.test.assert(permReply.channelPermission, "rw", "perm auth should set channelPermission from map")

	global.__namAuthHelperCount = 0
	var customFn = nm.getPrecompiledAuthFn(__, "global.__namAuthHelperCount++; return (u == 'u1' && p == 'p1');")
	ow.test.assert(customFn("u1", "p1", __, {}), true, "custom auth should accept matching credentials")
	ow.test.assert(customFn("u1", "bad", __, {}), false, "custom auth should reject non-matching credentials")
	ow.test.assert(global.__namAuthHelperCount, 2, "custom auth function should execute once per auth check")

	delete global.__namAuthHelperCount
	harness.stopEngine(nm)
})

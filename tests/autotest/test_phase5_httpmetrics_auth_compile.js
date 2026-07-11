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

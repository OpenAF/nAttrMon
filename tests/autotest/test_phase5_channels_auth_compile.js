// Phase 5.3 -- #26: nOutput_Channels.js's channel-auth handler (chAuth, wired
// into every exposed/peered channel: cvals, lvals, attrs, warns, wnots, plugs,
// ops, ps, ...) compiled the custom-auth function with `new Function` on
// every request. chAuth is a private closure (not exposed on `this`, and
// wired deep into ow.ch's expose/peer HTTP plumbing, which needs a fully
// working httpd to exercise end-to-end), so this is verified at the source
// level instead: `new Function` must now appear only once, at construction
// time (building fnCustomAuth), not inside chAuth's body.

ow.test.test("nOutput_Channels::the custom-auth handler is compiled once, not per request", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nOutput_Channels.js")

	ow.test.assert(/function chAuth[\s\S]{0,300}new Function/.test(src), false, "chAuth's body must not contain a `new Function` call")
	ow.test.assert(/var fnCustomAuth\s*=[\s\S]{0,300}new Function/.test(src), true, "the custom-auth handler must be compiled once, outside chAuth, into fnCustomAuth")
	ow.test.assert(/fnCustomAuth\(u, p, s, r\)/.test(src), true, "chAuth should invoke the precompiled fnCustomAuth")
})

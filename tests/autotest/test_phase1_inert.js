// Phase 1 -- inert fixes (findings #5, #8, #9, #10, #12, #28, #29)
// These fixes cannot change deployment behavior (dead code, implicit globals,
// missing guards, wrong log variables, leftover debug output).

// #5 -- __nam_getSec must not leak `aMap` as an implicit global
ow.test.test("nmain::__nam_getSec does not leak aMap as an implicit global", () => {
	delete globalThis.aMap
	try { __nam_getSec({ secKey: "bogus-test-key-" + genUUID() }) } catch (e) { /* bucket won't exist, that's fine */ }
	ow.test.assert(typeof globalThis.aMap, "undefined", "__nam_getSec should not create an implicit global 'aMap'")
})

// #10 -- __nam_getChExtraOptions must tolerate a missing options map
ow.test.test("nmain::__nam_getChExtraOptions tolerates a missing options map", () => {
	var res = __nam_getChExtraOptions({ type: "elasticsearch" }, "name")
	ow.test.assert(isDef(res.options), true, "options should be created when missing")
	ow.test.assert(res.options.idKey, "id", "idKey should default to 'id'")
	ow.test.assert(res.options.size, 10000, "size should default to 10000")
})

// #9 -- nValidation.closeWarning must return the closed warnings
ow.test.test("nvalidation::closeWarning returns the closed warnings array", () => {
	harness.stubNattrmon({
		warnings: { High: [ new nWarning(nWarning.LEVEL_HIGH, "t1", "desc") ] },
		setWarnings: function(w) { this.lastSetWarnings = w }
	})
	var v = new nValidation(function() {})
	var ret = v.closeWarning("t1")
	ow.test.assert(isDef(ret), true, "closeWarning should return the closed warnings array")
	ow.test.assert(isDef(ret) && ret.length, 1, "closeWarning should return exactly one closed warning")
	ow.test.assert(isDef(ret) && ret[0].getLevel(), nWarning.LEVEL_CLOSED, "the returned warning should be closed")
})

// #8 -- dead `== {}` / `!= {}` object-literal guards in nwarnings.js
ow.test.test("nwarnings::no dead object-literal comparisons remain", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nwarnings.js")
	ow.test.assert(/==\s*\{\}/.test(src), false, "nwarnings.js should not contain dead '== {}' comparisons")
	ow.test.assert(/!=\s*\{\}/.test(src), false, "nwarnings.js should not contain dead '!= {}' comparisons")
})

// #12 -- tests/nattrmonTester.js template helpers must match production ternary order
ow.test.test("tester::template helpers use the same isDef ternary order as ntmplhelpers.js", () => {
	var src = io.readFileString(NATTRMON_HOME + "/tests/nattrmonTester.js")
	ow.test.assert(/isDef\(res\)\s*\?\s*isN\s*:\s*res/.test(src), false, "attr/cval/lval/warn helpers should not use the inverted 'isDef(res) ? isN : res' ternary")
	ow.test.assert((src.match(/isDef\(res\)\s*\?\s*res\s*:\s*isN/g) || []).length, 4, "attr/cval/lval/warn helpers should each return res when defined, isN as fallback")
})

// #28 -- wrong catch-variable in logged errors
ow.test.test("nInput_OpenMetrics::per-key catch logs its own exception variable", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nInput_OpenMetrics.js")
	ow.test.assert(/catch\s*\(\s*e1\s*\)\s*\{[^}]*stringify\(e\)/.test(src), false, "the inner catch(e1) block should not log the outer/undefined 'e'")
})
ow.test.test("nOutput_Channels::clearAttribute not-found branch does not reference an unbound exception", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nOutput_Channels.js")
	ow.test.assert(/else\s*\{\s*logErr\("OPS \| Error: " \+ stringify\(e\)\)/.test(src), false, "the clearAttribute 'not found' branch should not reference the not-yet-bound catch variable 'e'")
})

// #29 -- leftover sprint(warns) debug dump in nOutput_Slack.js
ow.test.test("nOutput_Slack::no leftover sprint(warns) debug dump", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nOutput_Slack.js")
	ow.test.assert(/sprint\(warns\)/.test(src), false, "nOutput_Slack.js should not contain the sprint(warns) debug leftover")
})

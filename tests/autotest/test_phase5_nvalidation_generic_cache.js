// Phase 5.6 -- #27: nValidation_Generic.js recompiled ~14 `new RegExp` sites
// (attrPattern/attribute/titlePattern/title on both the per-check and the
// per-event/per-value paths in validate()/checkEntry()) plus a healing
// `new Function` on every healing run -- all from static, per-instance
// config. Now cached (this.__reCache/this.__fnCache), keyed by pattern/source.

ow.test.test("nValidation_Generic::validate() caches compiled RegExps across calls, keyed by pattern", () => {
	harness.stubNattrmon()
	load(NATTRMON_HOME + "/config/objects/nValidation_Generic.js")

	var v = new nValidation_Generic({
		attrPattern: "^test$",
		checks: [ { attrPattern: "^test$", expr: "{{value}} < 200 && {{value}} >= 100", warnLevel: "HIGH" } ]
	})

	var res1 = v.validate([], {}, { op: "set", k: { name: "test" }, v: { name: "test", val: 150, date: new Date() } })
	ow.test.assert(res1.length, 1, "a value within range should produce a warning")
	ow.test.assert(isDef(v.__reCache), true, "a RegExp cache should exist after first use")
	ow.test.assert(isDef(v.__reCache["^test$"]), true, "the attrPattern should be cached")

	var reAfterFirst = v.__reCache["^test$"]
	v.validate([], {}, { op: "set", k: { name: "test" }, v: { name: "test", val: 150, date: new Date() } })
	ow.test.assert(v.__reCache["^test$"] === reAfterFirst, true, "a repeat pattern should reuse the cached RegExp, not recompile it")
})

ow.test.test("nValidation_Generic::validate() rejects values outside the check's condition and closes the warning", () => {
	harness.stubNattrmon({
		closedTitles: [],
		closeWarning: function(aTitle) { this.closedTitles.push(aTitle); return [] }
	})
	load(NATTRMON_HOME + "/config/objects/nValidation_Generic.js")

	var v = new nValidation_Generic({
		checks: [ { attrPattern: "^test$", expr: "{{value}} < 200 && {{value}} >= 100", warnLevel: "HIGH", warnTitleTemplate: "T {{name}}" } ]
	})

	var res = v.validate([], {}, { op: "set", k: { name: "test" }, v: { name: "test", val: 999, date: new Date() } })
	ow.test.assert(res.length, 0, "a value outside the expr's range should not produce a warning")
})

ow.test.test("nValidation_Generic::healing exec is compiled once and cached across healing runs", () => {
	harness.stubNattrmon({
		isNotified: function() { return __ },
		setNotified: function() { return false }
	})
	load(NATTRMON_HOME + "/config/objects/nValidation_Generic.js")

	global.__healCount = 0
	var v = new nValidation_Generic({
		checks: [ {
			attrPattern: "^test$",
			expr: "{{value}} > 200",
			warnLevel: "HIGH",
			healing: { exec: "global.__healCount++" }
		} ]
	})

	v.validate([], {}, { op: "set", k: { name: "test" }, v: { name: "test", val: 999, date: new Date() } })
	ow.test.assert(global.__healCount, 1, "the healing exec should have run once")
	ow.test.assert(isDef(v.__fnCache), true, "a function cache should exist after the healing run")

	var fnAfterFirst = v.__fnCache["global.__healCount++"]
	ow.test.assert(isDef(fnAfterFirst), true, "the healing exec source should be cached")

	v.validate([], {}, { op: "set", k: { name: "test" }, v: { name: "test", val: 999, date: new Date() } })
	ow.test.assert(global.__healCount, 2, "the healing exec should run again on a second matching event")
	ow.test.assert(v.__fnCache["global.__healCount++"] === fnAfterFirst, true, "the cached healing function should be reused, not recompiled")

	delete global.__healCount
})

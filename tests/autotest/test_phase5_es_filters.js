// Phase 5.4 -- #25: nOutput_ES.js validated includeRE/excludeRE as arrays but
// passed them straight to `new RegExp(anArray)` -- an array coerces to a
// comma-joined string, so multi-element lists never worked, and each value
// recompiled the RegExp per run. Also: addToES() reused/mutated a single
// `obj` across a value array's elements then cloned it at the end, which
// could leak fields from one element into the next; now each element gets
// its own fresh object.

ow.test.test("nOutput_ES::includeRE/excludeRE are compiled once into a RegExp array in the constructor", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_ES.js")
	var o = new nOutput_ES({ url: "http://localhost:1/fake", index: "test-index", includeRE: ["^cpu", "^mem"] })
	ow.test.assert(isArray(o.includeRE), true, "includeRE should be compiled into an array")
	ow.test.assert(o.includeRE.length, 2, "both patterns should be compiled")
	ow.test.assert(o.includeRE[0] instanceof RegExp, true, "each compiled entry should be a RegExp instance")
})

ow.test.test("nOutput_ES::__selected() matches against every pattern in a multi-element includeRE/excludeRE", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_ES.js")
	var o = new nOutput_ES({ url: "http://localhost:1/fake", index: "test-index", includeRE: ["^cpu", "^mem"] })
	ow.test.assert(o.__selected("cpu.load"), true, "the first pattern in a multi-element includeRE should match")
	ow.test.assert(o.__selected("mem.free"), true, "the second pattern in a multi-element includeRE should match")
	ow.test.assert(o.__selected("disk.io"), false, "a name matching neither pattern should not be selected")

	var o2 = new nOutput_ES({ url: "http://localhost:1/fake", index: "test-index", excludeRE: ["^tmp", "^debug"] })
	ow.test.assert(o2.__selected("tmp.files"), false, "the first pattern in a multi-element excludeRE should exclude")
	ow.test.assert(o2.__selected("debug.info"), false, "the second pattern in a multi-element excludeRE should exclude")
	ow.test.assert(o2.__selected("cpu.load"), true, "a name matching no exclude pattern should be selected")
})

ow.test.test("nOutput_ES::__selected() with no include/includeRE selects everything not excluded", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_ES.js")
	var o = new nOutput_ES({ url: "http://localhost:1/fake", index: "test-index" })
	ow.test.assert(o.__selected("anything"), true, "with no filters configured, everything should be selected")
})

ow.test.test("nOutput_ES::addToES() builds an isolated object per array element, no cross-element field leakage", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_ES.js")
	var o = new nOutput_ES({ url: "http://localhost:1/fake", index: "test-index", dontUseStampMapTemplating: true })

	var captured
	var fakeCh = { setAll: function (keys, data) { captured = data; return {} } }

	o.addToES(fakeCh, { name: "metric", date: new Date(), val: [ { a: 1 }, { b: 2 } ] }, false)

	ow.test.assert(captured.length, 2, "both array elements should produce a document")
	ow.test.assert(isDef(captured[0].metric.a), true, "the first element's own field should be present")
	ow.test.assert(isDef(captured[0].metric.b), false, "the first element must not pick up the second element's field")
	ow.test.assert(isDef(captured[1].metric.b), true, "the second element's own field should be present")
	ow.test.assert(isDef(captured[1].metric.a), false, "the second element must not carry over the first element's field")
	ow.test.assert(captured[0].id !== captured[1].id, true, "each element should get its own id")
})

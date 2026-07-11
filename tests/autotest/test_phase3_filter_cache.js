// Phase 3 -- #15: nAttrMon.filter() must compile a string `select` at most
// once per distinct select string (cached on this.__filterFnCache), not with
// `new Function` on every call, and must bound that cache's size.

ow.test.test("nmain::filter caches compiled select functions and reuses them", () => {
	var nm = harness.newEngine({}, { name: "filtercache" })

	var r1 = nm.filter([{ v: 1 }, { v: 2 }], { select: "return elem.v * 2" }, true)
	ow.test.assert(r1, [2, 4], "filter should apply the compiled select function")
	ow.test.assert(isDef(nm.__filterFnCache), true, "a select-function cache should exist after first use")
	var fnAfterFirst = nm.__filterFnCache["return elem.v * 2"]
	ow.test.assert(isDef(fnAfterFirst), true, "the compiled function should be cached by select string")

	nm.filter([{ v: 3 }], { select: "return elem.v * 2" }, true)
	ow.test.assert(nm.__filterFnCache["return elem.v * 2"] === fnAfterFirst, true, "a repeat select string should reuse the cached compiled function")

	harness.stopEngine(nm)
})

ow.test.test("nmain::filter's select-function cache is bounded", () => {
	var nm = harness.newEngine({}, { name: "filtercachebound" })

	for (var i = 0; i < 130; i++) {
		nm.filter([{ v: 1 }], { select: "return elem.v + " + i }, true)
	}
	ow.test.assert(Object.keys(nm.__filterFnCache).length <= 128, true, "the select-function cache must not grow without bound")

	harness.stopEngine(nm)
})

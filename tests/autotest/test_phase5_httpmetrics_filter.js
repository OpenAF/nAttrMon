// Phase 5.5 -- #26: nOutput_HTTP_Metrics.js's _filter recompiled `new RegExp(f)`
// per key per scrape for every pattern in attrInclude/attrExclude. Extracted
// to nOutput_HTTP_Metrics.prototype.__filter, using include/exclude RegExps
// precompiled once (in the constructor, into __includeRE/__excludeRE).
//
// This preserves the EXISTING semantics, including a quirk: when both
// attrInclude and attrExclude are configured, attrExclude has no effect (it is
// applied against the original map, not the include-filtered result) -- that
// quirk isn't one of the verified findings this plan fixes, so the refactor
// only changes performance, not behavior. __filter only touches
// this.include/this.exclude/this.__includeRE/this.__excludeRE, so it's tested
// directly against a bare prototype instance (no httpd/server needed).

var __newFilterInstance = (include, exclude) => {
	load(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Metrics.js")
	var o = Object.create(nOutput_HTTP_Metrics.prototype)
	o.include = include
	o.exclude = exclude
	o.__includeRE = isDef(include) ? include.map(f => new RegExp(f)) : __
	o.__excludeRE = isDef(exclude) ? exclude.map(f => new RegExp(f)) : __
	return o
}

ow.test.test("nOutput_HTTP_Metrics::__filter with neither include nor exclude returns everything", () => {
	var o = __newFilterInstance(__, __)
	var m = { a: 1, b: 2 }
	ow.test.assert(o.__filter(m), m, "with no filters configured, the map should pass through unchanged")
})

ow.test.test("nOutput_HTTP_Metrics::__filter with only attrInclude keeps only matching keys", () => {
	var o = __newFilterInstance(["^cpu", "^mem"], __)
	var m = { "cpu.load": 1, "mem.free": 2, "disk.io": 3 }
	var r = o.__filter(m)
	ow.test.assert(Object.keys(r).sort(), ["cpu.load", "mem.free"], "only keys matching an include pattern should survive")
})

ow.test.test("nOutput_HTTP_Metrics::__filter with only attrExclude drops matching keys", () => {
	var o = __newFilterInstance(__, ["^tmp"])
	var m = { "cpu.load": 1, "tmp.files": 2 }
	var r = o.__filter(m)
	ow.test.assert(Object.keys(r).sort(), ["cpu.load"], "keys matching an exclude pattern should be dropped")
})

ow.test.test("nOutput_HTTP_Metrics::__filter with both include and exclude -- exclude has no effect (existing quirk, preserved)", () => {
	var o = __newFilterInstance(["^cpu", "^tmp"], ["^tmp"])
	var m = { "cpu.load": 1, "tmp.files": 2, "disk.io": 3 }
	var r = o.__filter(m)
	// tmp.files matches BOTH include and exclude -- current (pre-existing, unchanged)
	// behavior is that exclude is a no-op once include is set, so it survives
	ow.test.assert(Object.keys(r).sort(), ["cpu.load", "tmp.files"], "exclude must not remove a key that also matched include, matching current (unfixed) behavior")
})

// Phase 9.1 -- terminal metrics API (lib/nmetrics.js): discovery/selection/snapshot
// nMetrics is a thin read-only accessor over the existing attribute stores (lib/nattribute.js,
// lib/nattributes.js, lib/nattributevalue.js) -- these tests exercise it against a harness
// engine seeded the same way production plugs seed attributes/values.

loadLib(NATTRMON_HOME + "/lib/nmetrics.js")

// Seeds aNm with a small, representative set of attributes across all nAttribute types.
// ----------------------------------------
var __t9_seed = function(nm) {
	nm.setAttribute("Java/Memory/Used", "Heap used", nAttribute.TYPE_NUMBER)
	nm.setAttribute("Java/Memory/Free", "Heap free", nAttribute.TYPE_NUMBER)
	nm.setAttribute("Java/GC/Collections", "GC count", nAttribute.TYPE_NUMBER)
	nm.setAttribute("Database/Status", "DB status text", nAttribute.TYPE_STRING)
	nm.setAttribute("Database/Pools", "Pool table", nAttribute.TYPE_TABLE)
	nm.setAttribute("Database/Health", "Health status", nAttribute.TYPE_STATUS)
	nm.setAttribute("Database/NoValue", "Never received a value", nAttribute.TYPE_NUMBER)

	nm.currentValues.set({ name: "Java/Memory/Used" }, { name: "Java/Memory/Used", val: 1234, date: new Date() })
	nm.currentValues.set({ name: "Java/Memory/Free" }, { name: "Java/Memory/Free", val: 768, date: new Date() })
	nm.currentValues.set({ name: "Java/GC/Collections" }, { name: "Java/GC/Collections", val: 42, date: new Date() })
	nm.currentValues.set({ name: "Database/Status" }, { name: "Database/Status", val: "ok", date: new Date() })
	nm.currentValues.set({ name: "Database/Pools" }, { name: "Database/Pools", val: [ { id: 1 }, { id: 2 } ], date: new Date() })
	nm.currentValues.set({ name: "Database/Health" }, { name: "Database/Health", val: true, date: new Date() })
	// Database/NoValue intentionally left without a currentValues entry
}

ow.test.test("nMetrics::match with no pattern returns every known attribute, sorted", () => {
	var nm = harness.newEngine({}, { name: "metrics-match-all" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)
		var names = m.match()
		ow.test.assert(names.length, 7, "should resolve all 7 seeded attributes")
		ow.test.assert(names, names.slice().sort(), "result should already be sorted")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics::match exact name", () => {
	var nm = harness.newEngine({}, { name: "metrics-match-exact" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)
		ow.test.assert(m.match("Java/Memory/Used"), [ "Java/Memory/Used" ], "exact name should resolve to itself only")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics::match glob pattern (single * segment)", () => {
	var nm = harness.newEngine({}, { name: "metrics-match-glob" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)
		ow.test.assert(m.match("Java/Memory/*"), [ "Java/Memory/Free", "Java/Memory/Used" ], "glob should match both Memory attributes only")
		ow.test.assert(m.match("Java/*"), [ "Java/GC/Collections", "Java/Memory/Free", "Java/Memory/Used" ], "top-level glob should match all Java attributes")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics::match multiple selectors (union, de-duplicated)", () => {
	var nm = harness.newEngine({}, { name: "metrics-match-multi" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)
		var names = m.match([ "Java/Memory/Used", "Database/*" ])
		ow.test.assert(names, [ "Database/Health", "Database/NoValue", "Database/Pools", "Database/Status", "Java/Memory/Used" ], "union of both selectors, sorted")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics::match nonexistent selector resolves to an empty array (not an error)", () => {
	var nm = harness.newEngine({}, { name: "metrics-match-none" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)
		ow.test.assert(m.match("Nope/Does/Not/Exist"), [], "no match should just be empty")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics::get resolves value/type/category/date across all attribute types", () => {
	var nm = harness.newEngine({}, { name: "metrics-get-types" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)

		var num = m.get("Java/Memory/Used")
		ow.test.assert(num.value, 1234, "numeric value should round-trip")
		ow.test.assert(num.type, "num", "numeric type should round-trip")
		ow.test.assert(num.category, "Java/Memory", "category should be the joined folder path")
		ow.test.assert(isDef(num.date), true, "date should be set")
		ow.test.assert(isNumber(num.ageMs) && num.ageMs >= 0, true, "ageMs should be a non-negative number")

		var str = m.get("Database/Status")
		ow.test.assert(str.value, "ok", "string value should round-trip")

		var tab = m.get("Database/Pools")
		ow.test.assert(isArray(tab.value) && tab.value.length == 2, true, "table value should round-trip as an array")

		var sta = m.get("Database/Health")
		ow.test.assert(sta.value, true, "status value should round-trip")

		var missing = m.get("Database/NoValue")
		ow.test.assert(isUnDef(missing.value), true, "an attribute with no current value should report an undefined value, not throw")
		ow.test.assert(missing.type, "num", "attribute metadata (type) should still be reported even without a value")

		ow.test.assert(isUnDef(m.get("Totally/Unknown")), true, "an unknown attribute name should resolve to undefined")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics::list/snapshot resolve+get in one call and skip unknowns", () => {
	var nm = harness.newEngine({}, { name: "metrics-list" })
	try {
		__t9_seed(nm)
		var m = new nMetrics(nm)

		var rows = m.list("Java/*")
		ow.test.assert(rows.length, 3, "should resolve the 3 Java attributes")
		ow.test.assert(rows.every(r => isDef(r.name) && isDef(r.type)), true, "every row should carry name+type")

		ow.test.assert(m.snapshot("Java/Memory/Used").length, 1, "snapshot() is an alias of list()")
		ow.test.assert(m.list("Nope/*").length, 0, "no matches should return an empty array, not throw")
	} finally {
		harness.stopEngine(nm)
	}
})

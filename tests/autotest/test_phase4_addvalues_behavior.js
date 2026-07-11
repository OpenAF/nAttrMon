// Phase 4 -- #21: pin down addValues' observable behavior BEFORE the
// perf refactor (avoid allocating nAttributeValue wrappers just to read
// .val, single-pass merge instead of _.concat(_.reject(...))) so the
// refactor can be verified against a green baseline.

ow.test.test("nmain::addValues stores current + a synthesized last value on first sight", () => {
	var nm = harness.newEngine({}, { name: "addvalues1" })

	nm.addValues(false, { attributes: { a: 42 } }, {})

	var cur = nm.currentValues.get({ name: "a" })
	var last = nm.lastValues.get({ name: "a" })
	ow.test.assert(cur.val, 42, "current value should be set to the new value")
	ow.test.assert(isUnDef(last.val), true, "last value should be a synthesized (undefined) entry on first sight")

	harness.stopEngine(nm)
})

ow.test.test("nmain::addValues rotates current into last on subsequent calls", () => {
	var nm = harness.newEngine({}, { name: "addvalues2" })

	nm.addValues(false, { attributes: { a: 1 } }, {})
	nm.addValues(false, { attributes: { a: 2 } }, {})

	var cur = nm.currentValues.get({ name: "a" })
	var last = nm.lastValues.get({ name: "a" })
	ow.test.assert(cur.val, 2, "current value should be the latest value")
	ow.test.assert(last.val, 1, "last value should be the previous current value (rotation)")

	harness.stopEngine(nm)
})

ow.test.test("nmain::addValues onlyOnEvent suppresses both current and last updates when unchanged", () => {
	var nm = harness.newEngine({}, { name: "addvalues3" })

	nm.addValues(true, { attributes: { a: 1 } }, {})
	var curAfterFirst = nm.currentValues.get({ name: "a" })

	// Same value again -- onlyOnEvent should suppress the update entirely
	nm.addValues(true, { attributes: { a: 1 } }, {})
	var curAfterSecond = nm.currentValues.get({ name: "a" })
	var lastAfterSecond = nm.lastValues.get({ name: "a" })

	ow.test.assert(curAfterSecond.date.getTime(), curAfterFirst.date.getTime(), "current value's date should not change when the value did not change (onlyOnEvent)")
	ow.test.assert(isUnDef(lastAfterSecond.val), true, "last value should remain the synthesized first-sight entry -- no rotation happened because nothing changed")

	// A genuinely different value must go through
	nm.addValues(true, { attributes: { a: 2 } }, {})
	var curAfterThird = nm.currentValues.get({ name: "a" })
	var lastAfterThird = nm.lastValues.get({ name: "a" })
	ow.test.assert(curAfterThird.val, 2, "a real change should update the current value")
	ow.test.assert(lastAfterThird.val, 1, "a real change should rotate the previous current value into last")

	harness.stopEngine(nm)
})

ow.test.test("nmain::addValues mergeKeys dedups the previous array by the matcher before concatenating the new value", () => {
	var nm = harness.newEngine({}, { name: "addvalues4" })

	nm.addValues(false, { attributes: { a: [ { id: 1, v: "old1" }, { id: 2, v: "old2" } ] } }, {})
	nm.addValues(false, { attributes: { a: [ { id: 1, v: "new1" } ] } }, { mergeKeys: { a: { id: 1 } } })

	var cur = nm.currentValues.get({ name: "a" })
	ow.test.assert(cur.val.length, 2, "merge should keep the non-matching old entry plus the new entry")
	ow.test.assert($from(cur.val).equals("id", 2).at(0).v, "old2", "the entry not matching the merge predicate should survive unchanged")
	ow.test.assert($from(cur.val).equals("id", 1).at(0).v, "new1", "the entry matching the merge predicate should be replaced by the new value")

	harness.stopEngine(nm)
})

ow.test.test("nmain::addValues mergeKeys wraps a non-array new value into an array when merging", () => {
	var nm = harness.newEngine({}, { name: "addvalues5" })

	nm.addValues(false, { attributes: { a: [ { id: 1, v: "old1" } ] } }, {})
	nm.addValues(false, { attributes: { a: { id: 2, v: "new2" } } }, { mergeKeys: { a: { id: 2 } } })

	var cur = nm.currentValues.get({ name: "a" })
	ow.test.assert(isArray(cur.val), true, "a non-array new value should be wrapped into an array when mergeKeys applies")
	ow.test.assert(cur.val.length, 2, "the old entry (not matching the predicate) plus the new entry should both be present")

	harness.stopEngine(nm)
})

ow.test.test("nmain::addValues applies posAttrProcessing's stamp and toArray before storing", () => {
	var nm = harness.newEngine({}, { name: "addvalues6" })

	nm.addValues(false, { attributes: { a: { v: 1 }, b: { v: 2 } } }, {
		aStamp: { source: "test" },
		toArray: { attrName: "combined", key: "key" }
	})

	var combined = nm.currentValues.get({ name: "combined" })
	ow.test.assert(isDef(combined), true, "toArray should produce a single attribute named after attrName")
	ow.test.assert(isArray(combined.val), true, "toArray's value should be an array")
	ow.test.assert(combined.val.length, 2, "toArray should fold every original attribute into the array")
	ow.test.assert($from(combined.val).equals("key", "a").at(0).source, "test", "the stamp map should be merged into each value before toArray runs")

	harness.stopEngine(nm)
})

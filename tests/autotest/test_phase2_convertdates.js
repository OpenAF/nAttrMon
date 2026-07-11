// Phase 2 -- #6/#7: convertDates() subscribers must set the field they claim
// to (v.lastupdate/v.createdate, not v.date), use a real invalid-date check
// instead of the always-true `new Date(x) != null`, and push each changed
// value exactly once (no duplicate setAll writes).

ow.test.test("nwarning::convertDates sets lastupdate/createdate, not date, and writes once", () => {
	var ch = "test_nwarning_convertdates_" + genUUID()
	$ch(ch).create(1, "simple")

	var setAllCalls = 0
	$ch(ch).subscribe((aCh, aOp, aK, aV) => { if (aOp == "setall") setAllCalls++ }, true)

	var v = { title: "w1" } // missing both lastupdate and createdate
	;(new nWarning()).convertDates(ch, "set", { title: "w1" }, v)
	sleep(200, true)

	ow.test.assert(setAllCalls, 1, "a single missing-both-dates value should trigger exactly one setAll call")
	var stored = $ch(ch).get({ title: "w1" })
	ow.test.assert(isDef(stored.lastupdate), true, "lastupdate should have been set")
	ow.test.assert(isDef(stored.createdate), true, "createdate should have been set")
	ow.test.assert(isDef(stored.date), false, "the non-existent 'date' field should not have been set")

	$ch(ch).destroy()
})

ow.test.test("nwarning::convertDates on setall pushes each changed value once", () => {
	var ch = "test_nwarning_convertdates_setall_" + genUUID()
	$ch(ch).create(1, "simple")

	var setAllCalls = 0, lastChanges
	$ch(ch).subscribe((aCh, aOp, aK, aV) => { if (aOp == "setall") { setAllCalls++; lastChanges = aV } }, true)

	var vs = [ { title: "w1" }, { title: "w2", lastupdate: "2020-01-01T00:00:00.000Z" } ]
	;(new nWarning()).convertDates(ch, "setall", {}, vs)
	sleep(200, true)

	ow.test.assert(setAllCalls, 1, "setAll should be called exactly once for the whole batch")
	ow.test.assert(lastChanges.length, 2, "each of the two input values should appear exactly once in the changes array")

	$ch(ch).destroy()
})

ow.test.test("nattributevalue::convertDates sets a missing date exactly once", () => {
	var ch = "test_nattrvalue_convertdates_" + genUUID()
	$ch(ch).create(1, "simple")

	var setAllCalls = 0, lastChanges
	$ch(ch).subscribe((aCh, aOp, aK, aV) => { if (aOp == "setall") { setAllCalls++; lastChanges = aV } }, true)

	var v = { name: "a1" } // missing date entirely
	;(new nAttributeValue()).convertDates(ch, "set", { name: "a1" }, v)
	sleep(200, true)

	ow.test.assert(setAllCalls, 1, "a single missing-date value should trigger exactly one setAll call")
	ow.test.assert(lastChanges.length, 1, "the value should appear exactly once in the changes array")

	$ch(ch).destroy()
})

ow.test.test("nattributevalue::convertDates leaves an invalid date string untouched", () => {
	var ch = "test_nattrvalue_convertdates_invalid_" + genUUID()
	$ch(ch).create(1, "simple")

	var setAllCalls = 0
	$ch(ch).subscribe((aCh, aOp, aK, aV) => { if (aOp == "setall") setAllCalls++ }, true)

	var v = { name: "a1", date: "not-a-real-date" }
	;(new nAttributeValue()).convertDates(ch, "set", { name: "a1" }, v)
	sleep(200, true)

	ow.test.assert(setAllCalls, 0, "an invalid date string should not be forced through Date() and written")

	$ch(ch).destroy()
})

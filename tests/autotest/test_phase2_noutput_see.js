// Phase 2 -- #13: nOutput.see() must compare dates by value (getTime()), not
// by object reference. The reference compare defeats the onlyOnEvent dedup
// in H2/Oracle history outputs, inserting a history row every cycle even
// when the timestamp did not actually change.

ow.test.test("noutput::see returns false for the same timestamp value on separate Date instances", () => {
	var o = new nOutput(function() {})
	var d1 = new Date(2024, 0, 1, 10, 0, 0)
	var d2 = new Date(2024, 0, 1, 10, 0, 0) // same instant, different object

	o.see("k1", { date: d1 })
	var changed = o.see("k1", { date: d2 })

	ow.test.assert(changed, false, "an equal timestamp on a new Date instance should not be reported as a change")
})

ow.test.test("noutput::see returns true when the timestamp actually changes", () => {
	var o = new nOutput(function() {})
	var d1 = new Date(2024, 0, 1, 10, 0, 0)
	var d2 = new Date(2024, 0, 1, 10, 0, 1)

	o.see("k2", { date: d1 })
	var changed = o.see("k2", { date: d2 })

	ow.test.assert(changed, true, "a genuinely different timestamp should be reported as a change")
})

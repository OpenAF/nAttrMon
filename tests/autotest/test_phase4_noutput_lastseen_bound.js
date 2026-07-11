// Phase 4 -- #18: nOutput.lastSeen must be bounded (MAX_LASTSEEN_ENTRIES,
// 8192 by default) -- one entry per attribute name forever otherwise leaks
// memory for outputs that see an ever-growing set of attribute names. On
// overflow the oldest ~25% (by stored time) are evicted.

ow.test.test("noutput::lastSeen evicts the oldest ~25% once the cap is reached", () => {
	var o = new nOutput(function() {})
	o.MAX_LASTSEEN_ENTRIES = 100

	for (var i = 0; i < 100; i++) {
		o.see("k" + i, { date: new Date(2024, 0, 1, 0, 0, i) })
	}
	ow.test.assert(Object.keys(o.lastSeen).length, 100, "lastSeen should hold exactly the cap before overflow")

	// One more distinct key triggers eviction of the oldest ~25%
	o.see("k100", { date: new Date(2024, 0, 1, 0, 1, 40) })

	var remaining = Object.keys(o.lastSeen).length
	ow.test.assert(remaining <= 100, true, "lastSeen must not grow past the cap")
	ow.test.assert(remaining < 100, true, "an eviction should have freed space for the new key")

	// The oldest keys (k0, k1, ...) should be the ones evicted; the newest (k99, k100) must survive
	ow.test.assert(isUnDef(o.lastSeen["k0"]), true, "the oldest entry should have been evicted")
	ow.test.assert(isDef(o.lastSeen["k99"]), true, "the most recent original entry should survive eviction")
	ow.test.assert(isDef(o.lastSeen["k100"]), true, "the newly added key should be present")
})

ow.test.test("noutput::lastSeen re-seeing an evicted key behaves like first-seen", () => {
	var o = new nOutput(function() {})
	o.MAX_LASTSEEN_ENTRIES = 10

	for (var i = 0; i < 11; i++) {
		o.see("j" + i, { date: new Date(2024, 0, 1, 0, 0, i) })
	}
	ow.test.assert(isUnDef(o.lastSeen["j0"]), true, "j0 should have been evicted as the oldest entry")

	// Re-seeing the evicted key with any timestamp must not be reported as "changed"
	// (matches current first-time-seen behavior)
	var changed = o.see("j0", { date: new Date(2024, 0, 1, 0, 0, 0) })
	ow.test.assert(changed, false, "a key seen for the 'first time' (post-eviction) should not be reported as changed")
})

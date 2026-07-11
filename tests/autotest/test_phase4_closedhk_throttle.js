// Phase 4 -- #17: the closed-warning housekeeping scan (triggered on every
// warnings set/setall) must be throttled to at most once per
// __NAM_CLOSEDHK_HOWLONGAGOINMS window -- a closed warning only ever becomes
// eligible for removal after that window elapses, so scanning more often
// buys nothing.
//
// The set/setall subscriber fires asynchronously, so each step below sleeps
// long enough for it to have run (or not run) before asserting.

ow.test.test("nwarnings::closed-warning housekeeping scan is throttled to the configured window", () => {
	harness.resetGlobals()
	harness.resetChannels()
	harness.setGlobals({ __NAM_CLOSEDHK_HOWLONGAGOINMS: 100, __NAM_CLOSEDHK_ONSTARTUP: false })

	var w = new nWarnings()
	ow.test.assert(isDef(w.__closedHkLastScan), true, "a scan-gate atomic should exist")

	// Prevent the direct set() below (itself a channel "set" op) from tripping the
	// gate and scanning before the test scenario is set up
	w.__closedHkLastScan.set(now())

	// A closed warning old enough to be eligible for removal once scanned
	var closed = new nWarning(nWarning.LEVEL_CLOSED, "t1", "desc")
	closed.lastupdate = new Date(now() - 10000)
	w.getCh().set({ title: "t1" }, closed.getData())
	sleep(200, true)
	ow.test.assert(isDef(w.getCh().get({ title: "t1" })), true, "closed warning should be present right after being set (gate just primed)")

	// Simulate "just scanned" -- a set() within the throttle window must skip the scan
	w.__closedHkLastScan.set(now())
	w.setWarning({ level: nWarning.LEVEL_HIGH, title: "t2", description: "d2" })
	sleep(200, true)
	ow.test.assert(isDef(w.getCh().get({ title: "t1" })), true, "closed warning should survive a set() within the throttle window")

	// Move the gate back beyond the window -- the next set() must scan and remove it
	w.__closedHkLastScan.set(now() - 1000)
	w.setWarning({ level: nWarning.LEVEL_HIGH, title: "t3", description: "d3" })
	sleep(200, true)
	ow.test.assert(isDef(w.getCh().get({ title: "t1" })), false, "closed warning should be removed once the throttle window has elapsed")

	$ch(w.chWarnings).destroy()
	try { $cache("nattrmon::warnings::cache").destroy() } catch (e) {}
	harness.resetGlobals()
})

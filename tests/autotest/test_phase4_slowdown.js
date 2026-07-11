// Phase 4 -- #20: SLOWDOWN backpressure must be a single shared helper
// (__nam_slowdown), must skip the sleep entirely for plugs whose own average
// exec time is already under __NAM_SLOWDOWN_TIME (sleeping a fast plug just
// occupies the pool thread for no relief), and must cap the sleep at 5s.

ow.test.test("nmain::__nam_slowdown skips the sleep for a fast plug (avgExecTimeInMs below the threshold)", () => {
	harness.resetGlobals()
	harness.setGlobals({ __NAM_SLOWDOWN: true, __NAM_SLOWDOWN_TIME: 250, __NAM_SLOWDOWN_WARNS: false })
	harness.resetChannels()
	$ch("nattrmon::ps").create(1, "simple")
	for (var i = 0; i < 10; i++) $ch("nattrmon::ps").set({ name: "p" + i, uuid: "u" + i }, { name: "p" + i })

	var etry = { getName: () => "fastplug", avgExecTimeInMs: { get: () => 5 } }
	var start = now()
	__nam_slowdown(etry, "nattrmon::ps", 1)
	var elapsed = now() - start
	ow.test.assert(elapsed < 100, true, "a plug averaging well under __NAM_SLOWDOWN_TIME should not be slept at all")

	$ch("nattrmon::ps").destroy()
	harness.resetGlobals()
})

ow.test.test("nmain::__nam_slowdown sleeps a slow plug under backlog and caps the delay at 5s", () => {
	harness.resetGlobals()
	harness.setGlobals({ __NAM_SLOWDOWN: true, __NAM_SLOWDOWN_TIME: 10000, __NAM_SLOWDOWN_WARNS: false })
	harness.resetChannels()
	$ch("nattrmon::ps").create(1, "simple")
	// Backlog of 5 beyond cpucores=1 -> _cd = 4 -> uncapped would be 4*10000=40000ms
	for (var i = 0; i < 5; i++) $ch("nattrmon::ps").set({ name: "p" + i, uuid: "u" + i }, { name: "p" + i })

	var etry = { getName: () => "slowplug", avgExecTimeInMs: { get: () => 20000 } }
	var start = now()
	__nam_slowdown(etry, "nattrmon::ps", 1)
	var elapsed = now() - start
	ow.test.assert(elapsed >= 4900, true, "the sleep should still happen for a slow plug under backlog")
	ow.test.assert(elapsed <= 6000, true, "the sleep must be capped at 5s, not the uncapped 40s")

	$ch("nattrmon::ps").destroy()
	harness.resetGlobals()
})

ow.test.test("nmain::__nam_slowdown does nothing when __NAM_SLOWDOWN is disabled", () => {
	harness.resetGlobals()
	harness.setGlobals({ __NAM_SLOWDOWN: false })
	harness.resetChannels()
	$ch("nattrmon::ps").create(1, "simple")

	var etry = { getName: () => "anyplug", avgExecTimeInMs: { get: () => 999999 } }
	var start = now()
	__nam_slowdown(etry, "nattrmon::ps", 1)
	var elapsed = now() - start
	ow.test.assert(elapsed < 100, true, "disabled SLOWDOWN should never sleep")

	$ch("nattrmon::ps").destroy()
	harness.resetGlobals()
})

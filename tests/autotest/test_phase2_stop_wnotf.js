// Phase 2 -- #11: nAttrMon.stop() must destroy the notifications channel
// (nattrmon::wnotf) when a separate __NAM_CHANNEL_WNOTS channel was
// configured -- otherwise it's leaked across restarts within the same
// process/JVM.

ow.test.test("nmain::stop destroys the dedicated notifications channel when configured", () => {
	var nm = harness.newEngine({
		__NAM_CHANNEL_WNOTS: '{"type":"simple"}'
	}, { name: "wnotf" })

	ow.test.assert($ch().list().indexOf("nattrmon::wnotf") >= 0, true, "the notifications channel should exist while the engine is running")

	nm.stop()

	ow.test.assert($ch().list().indexOf("nattrmon::wnotf") >= 0, false, "the notifications channel should be destroyed on stop()")

	global.nattrmon = undefined
	harness.resetChannels()
})

// Phase 2 -- #3: array-form chSubscribe must subscribe to each channel in the
// array (entry.chSubscribe[i]), not to $ch(entry.chSubscribe) (the whole
// array coerced into one bogus channel name) N times.

ow.test.test("nmain::array chSubscribe fires once per channel, on the real channels", () => {
	var nm = harness.newEngine({}, { name: "chsub" })

	$ch("tchA").create(1, "simple")
	$ch("tchB").create(1, "simple")

	var execCount = 0
	nm.addInput({ name: "multisub", chSubscribe: ["tchA", "tchB"] }, new nInput(function(scope, args) {
		execCount++
		return {}
	}), {})
	nm.execPlugs(nm.PLUGINPUTS)

	$ch("tchA").set({ k: "1" }, { v: 1 })
	sleep(200, true)
	ow.test.assert(execCount, 1, "setting a value on the first subscribed channel should trigger exactly one execution")

	$ch("tchB").set({ k: "1" }, { v: 2 })
	sleep(200, true)
	ow.test.assert(execCount, 2, "setting a value on the second subscribed channel should trigger exactly one more execution")

	try { $ch("tchA").destroy() } catch (e) {}
	try { $ch("tchB").destroy() } catch (e) {}
	harness.stopEngine(nm)
})

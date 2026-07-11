// Phase 4 -- #19: the three scheduled-thread callbacks must no-op (return
// false), not throw, if their threadsSessions entry is ever missing. Plus
// nAttrMon.prototype.delSessionData(aKey), a generic session-data removal
// helper (used by Phase 5.3).
//
// IMPORTANT: addPlug's re-registration branch must keep swapping .entry IN
// PLACE, not delete/prune the session. Live reload (see nOutput_Channels.js's
// "reloadPlug" -> nattrmon.loadPlug() -> af.load(file), which re-executes the
// plug file and calls addInput/addOutput/addValidation again for the same
// name/category) never re-runs execPlugs(). The already-running scheduled
// thread/channel-subscriber keeps the original uuid and re-reads
// parent.threadsSessions[uuid].entry on every invocation -- that in-place
// swap is the ONLY mechanism that makes a reloaded plug's new config/behavior
// take effect. Deleting the session on re-registration would permanently kill
// the plug (the orphaned old thread would hit the "no-op" guard forever and
// nothing would ever reschedule a replacement).

ow.test.test("nmain::addPlug reload swaps .entry in place so the live session keeps serving the plug", () => {
	var nm = harness.newEngine({}, { name: "reload1" })
	$ch("tchR").create(1, "simple")

	var v1count = 0, v2count = 0
	nm.addInput({ name: "reloadtest", chSubscribe: "tchR" }, new nInput(function(scope, args) {
		v1count++
		return {}
	}), {})
	nm.execPlugs(nm.PLUGINPUTS)

	var idxKey = "uncategorized/reloadtest"
	var uuid = nm.indexPlugThread[idxKey]
	ow.test.assert(isDef(uuid), true, "a thread session should be indexed for the subscribed plug")

	$ch("tchR").set({ k: "1" }, { v: 1 })
	sleep(200, true)
	ow.test.assert(v1count, 1, "the original plug body should run on the first event")

	// Simulate a live reload: same name/category, re-registered without calling execPlugs again
	nm.addInput({ name: "reloadtest", chSubscribe: "tchR" }, new nInput(function(scope, args) {
		v2count++
		return {}
	}), {})

	ow.test.assert(nm.indexPlugThread[idxKey], uuid, "the same uuid/session must still serve the plug after reload")
	ow.test.assert(isDef(nm.threadsSessions[uuid]), true, "the session must not be deleted by a reload")

	$ch("tchR").set({ k: "2" }, { v: 2 })
	sleep(200, true)
	ow.test.assert(v2count, 1, "the still-running subscriber should now execute the NEW plug body after reload")
	ow.test.assert(v1count, 1, "the old plug body must not run again after reload")

	try { $ch("tchR").destroy() } catch (e) {}
	harness.stopEngine(nm)
})

ow.test.test("nmain::an orphaned chSubscribe session no-ops instead of throwing if its session ever goes missing", () => {
	var nm = harness.newEngine({}, { name: "prune1" })
	$ch("tchP").create(1, "simple")

	var execCount = 0
	nm.addInput({ name: "prunetest", chSubscribe: "tchP" }, new nInput(function(scope, args) {
		execCount++
		return {}
	}), {})
	nm.execPlugs(nm.PLUGINPUTS)

	var idxKey = "uncategorized/prunetest"
	var uuid = nm.indexPlugThread[idxKey]
	ow.test.assert(isDef(uuid), true, "a thread session should be indexed for the subscribed plug")
	ow.test.assert(isDef(nm.threadsSessions[uuid]), true, "the session entry should exist before the simulated loss")

	// Directly simulate the session entry going missing (defensive guard under test,
	// not a path any current code triggers)
	delete nm.threadsSessions[uuid]

	$ch("tchP").set({ k: "1" }, { v: 1 })
	sleep(200, true)

	ow.test.assert(execCount, 0, "a subscriber whose session entry is missing must no-op, not throw")

	try { $ch("tchP").destroy() } catch (e) {}
	harness.stopEngine(nm)
})

ow.test.test("nmain::delSessionData removes a stored session entry", () => {
	var nm = harness.newEngine({}, { name: "delsessiondata" })
	nm.setSessionData("k1", { some: "data" })
	ow.test.assert(nm.hasSessionData("k1"), true, "session data should exist after setSessionData")

	nm.delSessionData("k1")
	ow.test.assert(nm.hasSessionData("k1"), false, "session data should be gone after delSessionData")

	harness.stopEngine(nm)
})

// Phase 2 -- unified execution engine:
// - timed, cron and channel-subscriber trigger paths must all flow through
//   one shared internal executor
// - a shared execution context object should carry trigger metadata
// - addValues commit should remain centralized to preserve semantics

ow.test.test("nmain::phase2 unified executor wiring exists for all trigger sources", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")

	ow.test.assert(src.indexOf("const __nam_buildExecContext") >= 0, true, "shared execution-context builder should exist")
	ow.test.assert(src.indexOf("const __nam_execPlug") >= 0, true, "shared plug executor should exist")

	var _calls = (src.match(/__nam_execPlug\(parent, etry, execCtx, __cpucores\)/g) || []).length
	ow.test.assert(_calls, 3, "time, cron and subscribe trigger paths should each invoke the shared executor")

	ow.test.assert(src.indexOf('__nam_buildExecContext(uuid, "time"') >= 0, true, "time trigger should build a shared execution context")
	ow.test.assert(src.indexOf('__nam_buildExecContext(uuid, "cron"') >= 0, true, "cron trigger should build a shared execution context")
	ow.test.assert(src.indexOf('__nam_buildExecContext(aUUID, "subscribe"') >= 0, true, "subscribe trigger should build a shared execution context")
})

ow.test.test("nmain::phase2 addValues commit path is centralized in shared executor", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")
	var _hits = (src.match(/parent\.addValues\(etry\.onlyOnEvent, res,/g) || []).length
	ow.test.assert(_hits, 1, "addValues commit should be defined once inside the shared executor")
})

ow.test.test("nmain::phase2 shared prepare path keeps waitForFinish and subscriber timeout guards", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")

	ow.test.assert(src.indexOf("const __nam_preparePlugExec") >= 0, true, "shared prepare/guard function should exist")
	ow.test.assert(src.indexOf('.equals("uuid", execCtx.uuid)') >= 0, true, "waitForFinish guard should use the execution-context uuid")
	ow.test.assert(src.indexOf("_running = _running.where(r => ow.format.dateDiff.inMinutes(r.start) <= etry.killAfterMinutes)") >= 0, true, "subscriber waitForFinish should keep killAfterMinutes running-instance filtering")
	ow.test.assert(src.indexOf(".where(r => ow.format.dateDiff.inMinutes(r.start) > etry.killAfterMinutes)") >= 0, true, "subscriber stale cleanup by killAfterMinutes should be preserved")
})

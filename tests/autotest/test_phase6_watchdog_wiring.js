// Phase 6 -- watchdog wiring guard:
// keep startup override keys and warn-cooldown wiring present in nattrmon.js.

ow.test.test("nattrmon startup script includes watchdog override and warning cooldown wiring", () => {
	var src = io.readFileString(NATTRMON_HOME + "/nattrmon.js")
	ow.test.assert(src.indexOf("params.watchdogSleep") >= 0, true, "watchdogSleep startup override should remain wired")
	ow.test.assert(src.indexOf("params.watchdogStuckFactor") >= 0, true, "watchdogStuckFactor startup override should remain wired")
	ow.test.assert(src.indexOf("params.watchdogWarnCooldown") >= 0, true, "watchdogWarnCooldown startup override should remain wired")
	ow.test.assert(src.indexOf("__watchdogWarn") >= 0, true, "watchdog warning helper should remain defined")
	ow.test.assert(src.indexOf("__watchdogWarn(\"thread:\" + uuid") >= 0, true, "thread warning keying should remain per-thread")
	ow.test.assert(src.indexOf("__watchdogStats") >= 0, true, "watchdog stats map should remain defined")
	ow.test.assert(src.indexOf("setSessionData(\"watchdog.stats\"") >= 0, true, "watchdog stats should be exposed in runtime session data")
	ow.test.assert(src.indexOf("__watchdogBump(\"restarts\"") >= 0, true, "watchdog restart counter should be updated")
})

ow.test.test("nmain includes MAIN_WATCHDOG_WARN_COOLDOWN configuration wiring", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")
	ow.test.assert(src.indexOf("__NAM_MAIN_WATCHDOG_WARN_COOLDOWN") >= 0, true, "watchdog warn cooldown global should exist")
	ow.test.assert(src.indexOf("pms.MAIN_WATCHDOG_WARN_COOLDOWN") >= 0, true, "watchdog warn cooldown should be parsed from nattrmon.yaml/env")
})

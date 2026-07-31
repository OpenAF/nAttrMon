// Phase 5.3 -- operator diagnostics for degraded plugs:
// - core provides getDegradedPlugs() using error-rate + timeout/watchdog hit thresholds
// - timeout and watchdog events increment per-plug hit counters
// - HTTP metrics output exposes diagnostics route/type wiring

ow.test.test("nmain/nOutput_HTTP_Metrics include degraded diagnostics wiring", () => {
	var srcMain = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")
	var srcHttp = io.readFileString(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Metrics.js")
	ow.test.assert(srcMain.indexOf("getDegradedPlugs") >= 0, true, "core degraded diagnostics method should exist")
	ow.test.assert(srcMain.indexOf("plug-timeout") >= 0, true, "plug timeout diagnostics event should be tracked")
	ow.test.assert(srcHttp.indexOf("/diagnostics") >= 0, true, "HTTP diagnostics endpoint should be exposed")
	ow.test.assert(srcHttp.indexOf("case \"diagnostics\"") >= 0, true, "metrics route should expose diagnostics type")
	ow.test.assert(srcHttp.indexOf("nattrmon_diagnostics_plug_degraded") >= 0, true, "OpenMetrics diagnostics should include per-plug degradation lines")
})

ow.test.test("nmain::getDegradedPlugs flags plugs by error-rate/timeout/watchdog thresholds", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: true }, { name: "degraded-plugs" })

	try {
		var mkPlug = function(aType, aCat, aName, aExecs, aErrs, aAvg, aLast) {
			return {
				type: aType,
				getName: () => aName,
				getCategory: () => aCat,
				numberOfExecs: { get: () => aExecs },
				numberOfExecsInError: { get: () => aErrs },
				numberOfRunning: { get: () => 0 },
				avgExecTimeInMs: { get: () => aAvg },
				lastExecTimeInMs: { get: () => aLast }
			}
		}

		nm.plugs = {
			inputs: [ mkPlug("input", "catA", "plugA", 20, 10, 250, 300) ],
			outputs: [ mkPlug("output", "catB", "plugB", 4, 0, 15, 20) ],
			validations: []
		}

		nm.setSessionData("runtime.timeoutHitsByPlug", {
			"output::catB::plugB": 2
		})
		nm.setSessionData("runtime.watchdogHitsByPlug", {
			"input::catA::plugA": 1
		})

		var d = nm.getDegradedPlugs({
			errorRateThreshold: 0.4,
			minExecs: 5,
			timeoutHits: 2,
			watchdogHits: 1
		})

		ow.test.assert(d.total, 2, "plugA and plugB should both be degraded")

		var byName = {}
		d.degraded.forEach(r => { byName[r.name] = r })
		ow.test.assert(isDef(byName.plugA), true, "plugA should be flagged")
		ow.test.assert(isDef(byName.plugB), true, "plugB should be flagged")

		ow.test.assert($from(byName.plugA.reasons).equals("rule", "errorRate").any(), true, "plugA should include errorRate reason")
		ow.test.assert($from(byName.plugA.reasons).equals("rule", "watchdogHits").any(), true, "plugA should include watchdogHits reason")
		ow.test.assert($from(byName.plugB.reasons).equals("rule", "timeoutHits").any(), true, "plugB should include timeoutHits reason")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nmain::recordWatchdogEvent increments per-plug timeout/watchdog hit counters", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: true }, { name: "degraded-counters" })

	try {
		nm.recordWatchdogEvent("plug-timeout", {
			plugName: "plugC",
			plugCategory: "catC",
			plugType: "validation"
		})
		nm.recordWatchdogEvent("restart", {
			reason: "thread",
			name: "plugC",
			plugCategory: "catC",
			plugType: "validation"
		})

		var tm = nm.getSessionData("runtime.timeoutHitsByPlug")
		var wm = nm.getSessionData("runtime.watchdogHitsByPlug")
		ow.test.assert(tm["validation::catC::plugC"], 1, "timeout counter should be incremented")
		ow.test.assert(wm["validation::catC::plugC"], 1, "watchdog counter should be incremented")
	} finally {
		harness.stopEngine(nm)
	}
})

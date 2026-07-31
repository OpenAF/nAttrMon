// Phase 5.1/5.2 -- runtime metrics and optional ow.metrics collector wiring
// - runtime snapshots include plugs/scheduler/channels/watchdog summaries
// - snapshots are published to session + runtime metrics channel
// - watchdog events are emitted to a dedicated runtime events channel
// - optional ow.metrics collector can be registered with a custom name

ow.test.test("nmain exposes runtime metrics snapshot/publish/watchdog methods", () => {
	var src = io.readFileString(NATTRMON_HOME + "/lib/nmain.js")
	ow.test.assert(src.indexOf("getRuntimeMetricsSnapshot") >= 0, true, "runtime snapshot method should exist")
	ow.test.assert(src.indexOf("publishRuntimeMetrics") >= 0, true, "runtime publish method should exist")
	ow.test.assert(src.indexOf("recordWatchdogEvent") >= 0, true, "watchdog event method should exist")
	ow.test.assert(src.indexOf("initRuntimeMetricsCollector") >= 0, true, "ow.metrics collector init method should exist")
})

ow.test.test("nattrmon startup watchdog emits runtime event hooks", () => {
	var src = io.readFileString(NATTRMON_HOME + "/nattrmon.js")
	ow.test.assert(src.indexOf("recordWatchdogEvent(\"warning\"") >= 0, true, "watchdog warning events should be emitted")
	ow.test.assert(src.indexOf("recordWatchdogEvent(\"restart\"") >= 0, true, "watchdog restart events should be emitted")
})

ow.test.test("nmain::publishRuntimeMetrics stores snapshot in session and channel", () => {
	var nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_CH: "nattrmon::runtime::metrics:test",
		__NAM_RUNTIME_EVENTS_CH: "nattrmon::runtime::events:test",
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "runtime-metrics" })

	try {
		nm.publishRuntimeMetrics("test", { reason: "unit" })
		var s = nm.getSessionData("runtime.metrics")
		ow.test.assert(isMap(s), true, "runtime snapshot should be present in session data")
		ow.test.assert(isMap(s.plugs), true, "snapshot should include plugs summary")
		ow.test.assert(isMap(s.scheduler), true, "snapshot should include scheduler summary")
		ow.test.assert(isMap(s.channels), true, "snapshot should include channel sizes")
		ow.test.assert(isMap(s.watchdog), true, "snapshot should include watchdog map")
		ow.test.assert(isMap(s.event), true, "snapshot should include source event")
		ow.test.assert(s.event.source, "test", "event source should be preserved")
		ow.test.assert(s.event.reason, "unit", "extra event data should be merged")

		var c = $ch(nm.chRuntimeMetrics).get({ name: "runtime" })
		ow.test.assert(isDef(c) && isMap(c.metrics), true, "runtime metrics channel should receive snapshot payload")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nmain::recordWatchdogEvent writes runtime events", () => {
	var nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_CH: "nattrmon::runtime::metrics:test2",
		__NAM_RUNTIME_EVENTS_CH: "nattrmon::runtime::events:test2",
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "runtime-events" })

	try {
		nm.recordWatchdogEvent("warning", { key: "main", suppressed: false })
		ow.test.assert($ch(nm.chRuntimeEvents).size() > 0, true, "runtime events channel should contain watchdog events")
		var ev = nm.getSessionData("watchdog.lastEvent")
		ow.test.assert(isMap(ev), true, "last watchdog event should be available in session data")
		ow.test.assert(ev.type, "warning", "event type should be preserved")
		ow.test.assert(ev.key, "main", "event payload should be preserved")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nmain::initRuntimeMetricsCollector registers optional ow.metrics collector", () => {
	ow.loadMetrics()
	var mname = "nattrmon_runtime_test_" + now()
	var nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_OWMETRICS: true,
		__NAM_RUNTIME_OWMETRICS_NAME: mname,
		__NAM_RUNTIME_METRICS_CH: "nattrmon::runtime::metrics:test3",
		__NAM_RUNTIME_EVENTS_CH: "nattrmon::runtime::events:test3"
	}, { name: "runtime-owmetrics" })

	try {
		nm.initRuntimeMetricsCollector()
		var all = ow.metrics.getAll()
		ow.test.assert(isDef(all[mname]), true, "ow.metrics collector should be available with custom name")
		ow.test.assert(isMap(all[mname].scheduler), true, "collector payload should expose scheduler summary")
		ow.test.assert(isMap(all[mname].channels), true, "collector payload should expose channel sizes")
	} finally {
		harness.stopEngine(nm)
	}
})

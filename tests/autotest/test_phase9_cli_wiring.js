// Phase 9.6 -- terminal metrics/dashboard CLI wiring guard (nattrmon.js).
// nattrmon.js is a top-level bootstrap script (parses real process args, ends in exit()), so it
// can't be loadLib()'d and exercised in-process like a library -- mirrors the source-grep style
// already used by test_phase6_watchdog_wiring.js for the same reason.

ow.test.test("nattrmon.js wires --metrics=/--dashboard= as a one-shot path before ow.server.checkIn()", () => {
	var src = io.readFileString(NATTRMON_HOME + "/nattrmon.js")

	var idxMetricsBlock = src.indexOf("isDef(params.metrics) || isDef(params.dashboard)")
	var idxCheckIn = src.indexOf("ow.server.checkIn(")
	ow.test.assert(idxMetricsBlock >= 0, true, "the metrics/dashboard dispatch guard should exist")
	ow.test.assert(idxCheckIn >= 0, true, "ow.server.checkIn should still be wired for the daemon path")
	ow.test.assert(idxMetricsBlock < idxCheckIn, true, "metrics/dashboard dispatch must run BEFORE ow.server.checkIn() -- checkIn exit(-1)s when another instance already holds the pid file, which is the normal case for a kubectl-exec troubleshooting invocation")

	ow.test.assert(src.indexOf("__NAM_LOGCONSOLE = true") >= 0, true, "the metrics/dashboard path should force console-only logging, never writing into the live daemon's shared log directory")
	ow.test.assert(src.indexOf("nattrmon.start()") > src.indexOf("isDef(params.dashboard)"), true, ".start() must not be reachable from the metrics/dashboard one-shot path (would run a second copy of every input/output/validation plug)")

	ow.test.assert(src.indexOf('case "list":') >= 0, true, "--metrics=list should be wired")
	ow.test.assert(src.indexOf('case "snapshot":') >= 0, true, "--metrics=snapshot should be wired")
	ow.test.assert(src.indexOf('case "watch":') >= 0, true, "--metrics=watch should be wired")
	ow.test.assert(src.indexOf("nDashboards.build(") >= 0, true, "--dashboard= should be wired to nDashboards.build")
	ow.test.assert(src.indexOf("addOnOpenAFShutdown(() => __nam_watchSession.stop())") >= 0, true, "watch sessions must be stopped on shutdown/Ctrl-C")
	ow.test.assert(src.indexOf("addOnOpenAFShutdown(() => __nam_dash.stop())") >= 0, true, "dashboard sessions must be stopped on shutdown/Ctrl-C")

	var idxDashFormat = src.indexOf('__nam_format == "json" || __nam_format == "yaml"')
	var idxDashRunLive = src.indexOf("nMetricsView.renderDashboardFrame")
	ow.test.assert(idxDashFormat >= 0, true, "--dashboard= should honor --format=json|yaml as a one-shot structured dump")
	ow.test.assert(idxDashFormat < idxDashRunLive, true, "--format=json|yaml must be handled BEFORE the live runLive() call, so `--dashboard=runtime --format=json` (e.g. a non-interactive kubectl exec) never renders a bordered ANSI dashboard instead")
})

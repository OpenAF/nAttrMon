// Phase 9.4 -- dashboard definitions (lib/ndashboards.js): the built-in "runtime" dashboard and
// ad-hoc dashboards built from metric selectors. Panels are pure { title, type, pull() }
// descriptors (see lib/nmetricsview.js#renderDashboardFrame) -- these tests call pull() directly
// rather than rendering, so they stay independent of terminal-rendering concerns.

loadLib(NATTRMON_HOME + "/lib/nmetrics.js")
loadLib(NATTRMON_HOME + "/lib/nmetricsview.js")
loadLib(NATTRMON_HOME + "/lib/ndashboards.js")

ow.test.test("nDashboards.build(runtime)::has the expected panels and never throws when runtime metrics are disabled", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "dash-runtime-disabled" })
	try {
		var m = new nMetrics(nm)
		var dash = nDashboards.build("runtime", m, {})

		var titles = dash.panels.map(p => p.title)
		ow.test.assert(titles, [ "Overview", "Plug errors (history)", "Plugs", "Degraded plugs" ], "runtime dashboard should have exactly these 4 panels, in this order")

		dash.panels.forEach(p => {
			var data = p.pull() // must never throw, even with runtime metrics fully disabled
			if (p.type == "chart") ow.test.assert(isArray(data.values), true, p.title + " chart panel should return { values: [] }")
			else ow.test.assert(isArray(data.rows), true, p.title + " table panel should return { rows: [] }")
		})

		dash.stop() // must be a harmless no-op for the runtime dashboard (starts no sampling of its own)
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nDashboards.build(runtime)::Overview/plug-error history reflect published runtime metrics", () => {
	var nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_PERSIST: true,
		__NAM_RUNTIME_METRICS_HISTORY_SIZE: 10,
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "dash-runtime-live" })

	try {
		for (var i = 0; i < 3; i++) { nm.publishRuntimeMetrics("periodic"); sleep(5, true) }

		var m = new nMetrics(nm)
		var dash = nDashboards.build("runtime", m, {})

		var overview = dash.panels[0].pull()
		ow.test.assert(overview.rows.some(r => r.FIELD == "Source" && String(r.VALUE).indexOf("restored") >= 0), true, "Overview should report source=restored (this instance never called .start())")

		var errHistory = dash.panels[1].pull()
		ow.test.assert(errHistory.values.length, 3, "plug-error history chart should have one point per published periodic snapshot")

		dash.stop()
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nDashboards.build(<selectors>)::one panel per resolved metric, numeric -> chart, non-numeric -> table", () => {
	var nm = harness.newEngine({}, { name: "dash-adhoc" })
	try {
		nm.setAttribute("Java/Memory/Used", "Heap used", nAttribute.TYPE_NUMBER)
		nm.setAttribute("Java/Memory/Free", "Heap free", nAttribute.TYPE_NUMBER)
		nm.setAttribute("Database/Status", "DB status", nAttribute.TYPE_STRING)
		nm.currentValues.set({ name: "Java/Memory/Used" }, { name: "Java/Memory/Used", val: 100, date: new Date() })
		nm.currentValues.set({ name: "Java/Memory/Free" }, { name: "Java/Memory/Free", val: 50, date: new Date() })
		nm.currentValues.set({ name: "Database/Status" }, { name: "Database/Status", val: "ok", date: new Date() })

		var m = new nMetrics(nm)
		var dash = nDashboards.build([ "Java/Memory/*", "Database/Status" ], m, { samples: 10, periodMs: 60000 })
		try {
			ow.test.assert(dash.panels.length, 3, "should build one panel per resolved metric across both selectors")

			var byTitle = {}
			dash.panels.forEach(p => { byTitle[p.title] = p })

			ow.test.assert(byTitle["Java/Memory/Used"].type, "chart", "a numeric metric should become a chart panel")
			ow.test.assert(byTitle["Database/Status"].type, "table", "a non-numeric metric should become a table panel")

			var chartData = byTitle["Java/Memory/Used"].pull()
			ow.test.assert(isArray(chartData.values) && chartData.values.indexOf(100) >= 0, true, "chart panel pull() should include the seeded value")

			var tableData = byTitle["Database/Status"].pull()
			ow.test.assert(tableData.rows[0].VALUE, "ok", "table panel pull() should include the seeded string value")
		} finally {
			dash.stop()
		}
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nDashboards.build(<selector resolving to nothing>)::returns an empty, safely-stoppable dashboard", () => {
	var nm = harness.newEngine({}, { name: "dash-adhoc-empty" })
	try {
		var m = new nMetrics(nm)
		var dash = nDashboards.build([ "Totally/Unknown/*" ], m, {})
		ow.test.assert(dash.panels.length, 0, "no matches should produce zero panels, not an error")
		dash.stop() // must not throw
	} finally {
		harness.stopEngine(nm)
	}
})

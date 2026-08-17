// nAttrMon dashboard definitions
// Copyright 2026 Nuno Aguiar and other nAttrMon authors
//
// A dashboard definition is deliberately tiny -- see spec: "avoid over-engineering this into
// a large abstraction". nDashboards.build() turns either the built-in name "runtime" or a list
// of metric selectors into an array of panels ready for lib/nmetricsview.js#renderDashboardFrame
// (each panel: { title, type: "chart"|"table", pull() }). No rendering logic lives here, and the
// "runtime" dashboard introduces no new instrumentation -- its panels only reshape data already
// produced by nMetrics.runtimeSnapshot()/runtimeHistory() (lib/nmetrics.js), which themselves
// only wrap nAttrMon.prototype.getRuntimeMetricsSnapshot()/getDegradedPlugs()/
// getRuntimeMetricsHistory() (lib/nmain.js).

var nDashboards = {}

// ---- runtime dashboard -------------------------------------------------

// Normalizes nMetrics.runtimeSnapshot()'s two possible snapshot shapes (a full live
// getRuntimeMetricsSnapshot() when the wrapped instance actually .start()-ed itself, or the
// compact persisted history point otherwise -- see nMetrics.runtimeSnapshot()'s odoc) into a
// single set of fields the panels below can read without caring which shape they got.
// ----------------------------------------
var __nDashRuntimeFields = function(aRuntimeSnapshot) {
	var _rs = aRuntimeSnapshot
	var _snap = _rs.snapshot || {}
	var _liveDegraded = isMap(_rs.degraded) ? _rs.degraded : __

	return {
		source: _rs.source,
		daemonRunning: _rs.daemonRunning,
		ts: _rs.ts,
		channels: _$(_snap.channels).isMap().default({}),
		scheduler: _$(_snap.scheduler).isMap().default({}),
		plugs: _$(_snap.plugs).isMap().default({}),
		plugRows: isDef(_liveDegraded) ? _$(_snap.plugs).isMap().default({}).rows : __, // only present on a real live snapshot
		degradedCount: isDef(_liveDegraded) ? _liveDegraded.total : _$(_snap.degradedTotal).isNumber().default(__),
		degradedNames: isDef(_liveDegraded) ? _liveDegraded.degraded.map(d => d.key) : _$(_snap.degradedNames).isArray().default([]),
		degradedReasons: isDef(_liveDegraded) ? _liveDegraded.degraded : __, // only present on a real live snapshot
		restarts: isDef(_snap.restart) ? _snap.restart.count : _$(_snap.restarts).isNumber().default(__),
		watchdog: _$(_rs.watchdog).isMap().default(__)
	}
}

var __nDashKV = function(aLabel, aValue) {
	return { FIELD: aLabel, VALUE: isUnDef(aValue) || isNull(aValue) ? "n/a" : String(aValue) }
}

nDashboards.__runtimePanels = function(aNMetrics) {
	return [
		{
			title: "Overview",
			type: "table",
			pull: function() {
				var _rs = aNMetrics.runtimeSnapshot()
				if (!_rs.available) return { rows: [ __nDashKV("Runtime metrics", "not enabled (__NAM_RUNTIME_METRICS)") ] }
				if (_rs.source == "unavailable") {
					return { rows: [
						__nDashKV("Daemon running", _rs.daemonRunning),
						__nDashKV("Runtime metrics", "no persisted history yet -- daemon may predate __NAM_RUNTIME_METRICS_PERSIST, or hasn't published a periodic tick yet")
					] }
				}

				var _f = __nDashRuntimeFields(_rs)
				return { rows: [
					__nDashKV("Source", _f.source + (_f.daemonRunning ? " (daemon running)" : " (daemon NOT running)")),
					__nDashKV("As of", isDef(_f.ts) ? ow.format.timeago(new Date(_f.ts), true) : "n/a"),
					__nDashKV("Threads (total/stale)", _$(_f.scheduler.threadsTotal).default("n/a") + " / " + _$(_f.scheduler.staleThreads).default("n/a")),
					__nDashKV("Plugs (total/running)", _$(_f.plugs.total).default("n/a") + " / " + _$(_f.plugs.running).default("n/a")),
					__nDashKV("Executions (total/errors)", _$(_f.plugs.totalExecutions).default("n/a") + " / " + _$(_f.plugs.totalErrors).default("n/a")),
					__nDashKV("Avg exec time (ms)", _f.plugs.avgExecTimeInMs),
					__nDashKV("Degraded plugs", _f.degradedCount),
					__nDashKV("Watchdog restarts", _f.restarts)
				] }
			}
		},
		{
			title: "Plug errors (history)",
			type: "chart",
			pull: function() {
				var _hist = aNMetrics.runtimeHistory()
				return { values: _hist.map(h => _$(h.plugs).isMap().default({}).totalErrors).filter(isNumber) }
			}
		},
		{
			title: "Plugs",
			type: "table",
			pull: function() {
				var _rs = aNMetrics.runtimeSnapshot()
				var _f = __nDashRuntimeFields(_rs)
				if (!isArray(_f.plugRows)) {
					return { rows: [ __nDashKV("Plugs", "per-plug detail needs a live/in-process view (not persisted, to keep history bounded)") ] }
				}
				return { rows: $from(_f.plugRows).sort("-errorRate").limit(20).select(r => ({
					PLUG: r.category + "/" + r.name,
					TYPE: r.type,
					EXECS: r.numberOfExecs,
					ERRORS: r.numberOfExecsInError,
					"ERR%": isNumber(r.errorRate) ? (r.errorRate * 100).toFixed(1) : "n/a",
					"AVG(ms)": r.avgExecTimeInMs
				})) }
			}
		},
		{
			title: "Degraded plugs",
			type: "table",
			pull: function() {
				var _rs = aNMetrics.runtimeSnapshot()
				var _f = __nDashRuntimeFields(_rs)
				if (isArray(_f.degradedReasons)) {
					if (_f.degradedReasons.length == 0) return { rows: [ __nDashKV("Degraded plugs", "none") ] }
					return { rows: _f.degradedReasons.map(d => ({
						PLUG: d.key,
						"ERR%": isNumber(d.errorRate) ? (d.errorRate * 100).toFixed(1) : "n/a",
						REASONS: d.reasons.map(r => r.rule).join(",")
					})) }
				}
				if (isArray(_f.degradedNames) && _f.degradedNames.length > 0) {
					return { rows: _f.degradedNames.map(n => ({ PLUG: n, REASONS: "(reasons not persisted; see a live/in-process view)" })) }
				}
				return { rows: [ __nDashKV("Degraded plugs", "none") ] }
			}
		}
	]
}

// ---- ad-hoc dashboard (from metric selectors) -------------------------------

// One chart-or-table panel per resolved metric, classified by nAttribute.type
// (num => chart via a shared watchSession sampler; everything else => a small value table).
// ----------------------------------------
nDashboards.__adHocPanels = function(aNMetrics, aPatterns, aWatchOptions) {
	var _names = aNMetrics.match(aPatterns)
	if (_names.length == 0) return { panels: [], stop: function() {} }

	var _session = aNMetrics.watchSession(_names, aWatchOptions)

	var _panels = _names.map(name => {
		var _first = aNMetrics.get(name)
		var _numeric = isDef(_first) && _first.type == "num"

		if (_numeric) {
			return {
				title: name,
				type: "chart",
				pull: function() {
					var _buffers = _session.tick()
					var _pts = _buffers[name] || []
					return { values: _pts.filter(p => isNumber(p.value)).map(p => p.value) }
				}
			}
		}

		return {
			title: name,
			type: "table",
			pull: function() {
				var _buffers = _session.tick()
				var _pts = _buffers[name] || []
				var _last = _pts.length > 0 ? _pts[_pts.length - 1].value : __
				return { rows: [ __nDashKV("Value", nMetricsView.formatValue(_last, _first ? _first.type : __)) ] }
			}
		}
	})

	return { panels: _panels, stop: function() { _session.stop() } }
}

/**
 * <odoc>
 * <key>nattrmon.nDashboards.build(aName, aNMetrics, aOptions) : Map</key>
 * Builds a dashboard as { panels, stop() } (panels: see lib/nmetricsview.js#renderDashboardFrame).
 * aName "runtime" resolves to the built-in runtime-health dashboard (Overview/plug-error
 * history/Plugs/Degraded plugs); anything else is treated as one or more metric selectors (see
 * nMetrics.match()) and resolves to an ad-hoc dashboard, one panel per matching metric. aOptions
 * is forwarded to nMetrics.watchSession() for ad-hoc dashboards (samples/periodMs).
 * \
 * Callers MUST call the returned stop() exactly once when the dashboard session ends (Ctrl-C/
 * shutdown) -- a no-op for "runtime" (it starts no sampling of its own), but required for an
 * ad-hoc dashboard to release its shared watchSession's scheduled thread.
 * </odoc>
 */
nDashboards.build = function(aName, aNMetrics, aOptions) {
	if (aName == "runtime") return { panels: nDashboards.__runtimePanels(aNMetrics), stop: function() {} }
	return nDashboards.__adHocPanels(aNMetrics, aName, aOptions)
}

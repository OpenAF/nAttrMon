// nAttrMon terminal rendering for the metrics/dashboard CLI
// Copyright 2026 Nuno Aguiar and other nAttrMon authors
//
// Renders lib/nmetrics.js (and lib/ndashboards.js) results to the terminal by
// composing OpenAF-core's own printing/formatting globals -- printTable,
// ow.format.string.lineChart, ow.format.term.*, ow.format.printSparkline,
// ow.format.printDashboard, ow.format.viz.live -- see
// ../openaf/docs/llm-tui-guide.md. No chart/table/live-refresh logic is
// reimplemented here.
//
// The richer tier (ow.format.term.getCapabilities/printSparkline/
// printDashboard/ow.format.viz) landed in OpenAF core on 2026-04-22, after
// nAttrMon's current minimum OpenAF version. Everything here feature-detects
// that tier and falls back to a manual cls()+redraw loop and plain
// ow.format.string.lineChart rendering (both available well before nAttrMon's
// floor) so a slightly older OpenAF still gets a working, if plainer,
// terminal experience instead of a hard version-refusal mid-incident.

ow.loadFormat()

var nMetricsView = {}

// ---- capability / feature detection ---------------------------------------

nMetricsView.hasModernTerm = function() { return isDef(ow.format.term) && isFunction(ow.format.term.getCapabilities) }
nMetricsView.hasDashboard  = function() { return isFunction(ow.format.printDashboard) }
nMetricsView.hasLive       = function() { return isDef(ow.format.viz) && isFunction(ow.format.viz.live) }
nMetricsView.hasSparkline  = function() { return isFunction(ow.format.printSparkline) }

/**
 * <odoc>
 * <key>nattrmon.nMetricsView.getCaps(aOptions) : Map</key>
 * Returns { isTTY, ansi, width, height, unicode, colorDepth, colorMode }. Delegates to
 * ow.format.term.getCapabilities() when available; otherwise a minimal, dependency-free
 * fallback (java.lang.System.console(), COLUMNS/LINES env vars, defaulting to 80x24) so
 * callers never need their own TTY-detection branch.
 * </odoc>
 */
nMetricsView.getCaps = function(aOptions) {
	if (nMetricsView.hasModernTerm()) return ow.format.term.getCapabilities(aOptions)

	var _isTTY = (java.lang.System.console() != null)
	var _cols = Number(getEnv("COLUMNS"))
	var _lines = Number(getEnv("LINES"))
	return {
		isTTY: _isTTY,
		ansi: _isTTY,
		width: (!isNaN(_cols) && _cols > 0) ? _cols : 80,
		height: (!isNaN(_lines) && _lines > 0) ? _lines : 24,
		unicode: true,
		colorDepth: _isTTY ? 16 : 0,
		colorMode: _isTTY ? "16" : "none"
	}
}

// ---- value formatting -------------------------------------------------

/**
 * <odoc>
 * <key>nattrmon.nMetricsView.formatValue(aValue, aType) : String</key>
 * Renders a single metric value for display. Per spec, never infers units from the metric
 * name/type -- only nAttribute.TYPE_TABLE (or an already-array/map value) gets a structural
 * summary ("N rows"/"N keys"); everything else is shown as its raw String() value.
 * </odoc>
 */
nMetricsView.formatValue = function(aValue, aType) {
	if (isUnDef(aValue) || isNull(aValue)) return "(null)"
	if (aType == "tab" || isArray(aValue) || isMap(aValue)) {
		return "(" + (isArray(aValue) ? aValue.length + " rows" : Object.keys(aValue).length + " keys") + ")"
	}
	return String(aValue)
}

// ---- list / snapshot (non-interactive) -------------------------------------

/**
 * <odoc>
 * <key>nattrmon.nMetricsView.output(aRows, aOptions) : String</key>
 * Renders the array of resolved metrics aRows (see nMetrics.list()/.snapshot()) for
 * "nattrmon metrics list"/"nattrmon metrics snapshot". aOptions.format: "table" (default),
 * "json" or "yaml" (both reuse OpenAF's own stringify()/af.toYAML(), no ANSI emitted).
 * </odoc>
 */
nMetricsView.output = function(aRows, aOptions) {
	aOptions = _$(aOptions, "aOptions").isMap().default({})
	aRows = _$(aRows, "aRows").isArray().default([])
	var _fmt = _$(aOptions.format).isString().default("table")

	if (_fmt == "json") return stringify(aRows, __, "  ")
	if (_fmt == "yaml") return af.toYAML(aRows)

	if (aRows.length == 0) return "(no metrics matched)"

	var _caps = aOptions.caps || nMetricsView.getCaps()
	var _table = aRows.map(r => ({
		METRIC : r.name,
		VALUE  : nMetricsView.formatValue(r.value, r.type),
		TYPE   : r.type,
		UPDATED: isDef(r.date) ? ow.format.timeago(r.date, true) : "n/a"
	}))

	return printTable(_table, _caps.width, __, _caps.ansi, _caps.ansi ? "utf" : "plain")
}

// ---- watch (single/multiple live metrics) ----------------------------------

/**
 * <odoc>
 * <key>nattrmon.nMetricsView.renderWatchFrame(aSession, aOptions) : String</key>
 * Renders one frame for a nMetrics.watchSession() (see lib/nmetrics.js): a chart (current/
 * min/max/avg header + ow.format.string.lineChart) for metrics whose samples so far are all
 * numeric, or a small value table otherwise (non-numeric metrics fall back gracefully, per
 * spec -- they never error out the whole watch session).
 * </odoc>
 */
nMetricsView.renderWatchFrame = function(aSession, aOptions) {
	aOptions = _$(aOptions, "aOptions").isMap().default({})
	var _caps = aOptions.caps || nMetricsView.getCaps()
	var _buffers = aSession.tick()
	var _blocks = []

	aSession.names.forEach(name => {
		var _pts = _buffers[name] || []
		if (_pts.length == 0) {
			_blocks.push(name + "\n(no samples yet)")
			return
		}

		var _last = _pts[_pts.length - 1].value
		var _numeric = _pts.every(p => isNumber(p.value))

		if (_numeric && _pts.length > 1) {
			var _vals = _pts.map(p => p.value)
			var _min = Math.min.apply(null, _vals)
			var _max = Math.max.apply(null, _vals)
			var _avg = _vals.reduce((a, b) => a + b, 0) / _vals.length

			var _header = name +
				"\nCurrent: " + _last +
				"   Min: " + _min +
				"   Max: " + _max +
				"   Avg: " + _avg.toFixed(2) +
				"   (" + _vals.length + " samples)"

			var _chart = ow.format.string.lineChart(_vals, {
				width: Math.max(10, Math.min(_caps.width - 2, 120)),
				height: 8
			})
			_blocks.push(_header + "\n" + _chart)
		} else {
			_blocks.push(name + "\n" + printTable(
				[ { VALUE: nMetricsView.formatValue(_last, __), SAMPLES: _pts.length } ],
				_caps.width, __, _caps.ansi, _caps.ansi ? "utf" : "plain"
			))
		}
	})

	return _blocks.join("\n\n")
}

// ---- live driver (shared by watch and dashboard) ---------------------------

// ow.format.viz.live() takes a target frame rate (fps), not a refresh interval, and itself
// converts it back with Math.round(1000/fps) -- accepting fractional fps < 1 correctly (0.2 for
// a 5s interval). Extracted as its own function (rather than inlined in runLive) so the exact
// value handed to ow.format.viz.live can be asserted without driving runLive's blocking loop --
// an earlier version rounded/clamped this to a minimum of 1 fps, which silently redrew every
// --refresh > ~666ms 5x+ more often than requested.
// ----------------------------------------
nMetricsView.__refreshMsToFps = function(aRefreshMs) {
	return 1000 / aRefreshMs
}

/**
 * <odoc>
 * <key>nattrmon.nMetricsView.runLive(aRendererFn, aOptions)</key>
 * Runs aRendererFn(ctx) repeatedly and prints its result, blocking the caller until Ctrl-C/
 * shutdown (registers an addOnOpenAFShutdown hook), so callers (nattrmon.js) don't need their
 * own loop. aOptions.refreshMs (default 5000).
 * \
 * Non-TTY input (redirected/piped output, or no controlling terminal -- e.g. some non-
 * interactive kubectl exec invocations): renders exactly one frame and returns immediately,
 * per spec -- never emits terminal control sequences or starts a refresh loop when not a TTY.
 * \
 * TTY: uses ow.format.viz.live() (managed, diff-based, non-blocking java.util.Timer) when
 * available; otherwise falls back to a manual cls()+redraw+sleep loop for an older OpenAF
 * core. Either way, .stop() is invoked and the shutdown hook fires before the process exits,
 * so nothing is left running after Ctrl-C.
 * </odoc>
 */
nMetricsView.runLive = function(aRendererFn, aOptions) {
	aOptions = _$(aOptions, "aOptions").isMap().default({})
	var _caps = nMetricsView.getCaps()
	var _refreshMs = _$(aOptions.refreshMs).isNumber().default(5000)

	if (!_caps.isTTY) {
		print(aRendererFn({ size: { width: _caps.width, height: _caps.height }, caps: _caps }))
		print("\n(non-interactive output: single snapshot shown -- live refresh requires a TTY)")
		return
	}

	var _stopped = false

	if (nMetricsView.hasLive()) {
		// ow.format.viz.live's own ctx uses `capabilities`, not `caps`, and converts fps back to an
		// interval internally as Math.round(1000/fps) -- a fractional fps < 1 (e.g. 0.2 for a 5s
		// refresh) is valid and gives the correct interval; rounding/clamping fps here (as an
		// earlier version of this code did) would silently redraw far more often than --refresh asked.
		var _wrapped = ctx => aRendererFn({ size: ctx.size, caps: ctx.capabilities || _caps })
		var _handle = ow.format.viz.live(_wrapped, { fps: nMetricsView.__refreshMsToFps(_refreshMs) })
		addOnOpenAFShutdown(() => {
			_stopped = true
			try { _handle.stop() } catch(e) {}
		})
		while (!_stopped) sleep(250, true)
		return
	}

	// Fallback for an OpenAF core predating ow.format.viz (2026-04-22)
	addOnOpenAFShutdown(() => { _stopped = true })
	while (!_stopped) {
		cls()
		print(aRendererFn({ size: { width: _caps.width, height: _caps.height }, caps: _caps }))
		sleep(_refreshMs, true)
	}
}

// ---- dashboard (multi-panel) ------------------------------------------------

/**
 * <odoc>
 * <key>nattrmon.nMetricsView.renderDashboardFrame(aPanels, aOptions) : String</key>
 * Renders aPanels as a single frame. Each panel is { title, type: "chart"|"table", pull() },
 * where pull() is called once per frame and returns { values: [...] } for a "chart" panel
 * (plain numeric array, oldest-first) or { rows: [...] } for a "table" panel (already
 * display-ready row maps -- see lib/ndashboards.js, which shapes rows per panel since a
 * runtime-dashboard row and a plain metric row have different, panel-specific columns).
 * \
 * Uses ow.format.printDashboard() for a bordered grid layout when available; otherwise stacks
 * each panel's own table/chart rendering sequentially (still fully usable, just not grid-boxed)
 * -- graceful degradation per spec, never a hard failure just because the richer tier isn't
 * present.
 * </odoc>
 */
nMetricsView.renderDashboardFrame = function(aPanels, aOptions) {
	aOptions = _$(aOptions, "aOptions").isMap().default({})
	var _caps = aOptions.caps || nMetricsView.getCaps()

	var _resolved = aPanels.map(p => {
		var _data = {}
		try { _data = p.pull() } catch(e) { _data = { rows: [ { ERROR: String(e) } ] } }
		return { title: p.title, type: p.type, data: _data }
	})

	if (nMetricsView.hasDashboard()) {
		var _widgets = _resolved.map(r => {
			if (r.type == "chart") {
				var _vals = _$(r.data.values).isArray().default([])
				if (_vals.length > 1) return { type: "sparkline", title: r.title, data: _vals, options: { palette: "auto", showMinMax: true } }
				return { type: "table", title: r.title, data: [ { VALUE: _vals.length > 0 ? _vals[0] : "(no samples yet)" } ] }
			}
			return { type: "table", title: r.title, data: _$(r.data.rows).isArray().default([]) }
		})
		return ow.format.printDashboard(_widgets, { width: _caps.width, height: _caps.height - 2, border: true, borderStyle: "round", palette: "auto" })
	}

	// Fallback: stack each panel's own table/chart rendering sequentially
	return _resolved.map(r => {
		if (r.type == "chart") {
			var _vals = _$(r.data.values).isArray().default([])
			if (_vals.length <= 1) return "== " + r.title + " ==\n(not enough samples yet)"
			var _min = Math.min.apply(null, _vals), _max = Math.max.apply(null, _vals)
			var _avg = _vals.reduce((a, b) => a + b, 0) / _vals.length
			return "== " + r.title + " ==\nCurrent: " + _vals[_vals.length - 1] + "   Min: " + _min + "   Max: " + _max + "   Avg: " + _avg.toFixed(2) +
				"\n" + ow.format.string.lineChart(_vals, { width: Math.max(10, Math.min(_caps.width - 2, 120)), height: 8 })
		}
		var _rows = _$(r.data.rows).isArray().default([])
		if (_rows.length == 0) return "== " + r.title + " ==\n(no data)"
		return "== " + r.title + " ==\n" + printTable(_rows, _caps.width, __, _caps.ansi, _caps.ansi ? "utf" : "plain")
	}).join("\n\n")
}

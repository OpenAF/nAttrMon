// nAttrMon terminal metrics API
// Copyright 2026 Nuno Aguiar and other nAttrMon authors
//
// Small, renderer-agnostic accessor layer over nAttrMon's existing attribute
// and runtime-metric stores (lib/nattribute.js, lib/nattributes.js,
// lib/nattributevalue.js, nAttrMon.prototype.getRuntimeMetricsSnapshot/
// getDegradedPlugs in lib/nmain.js). It performs no collection of its own --
// it only reads whatever nAttrMon has already gathered.
//
// Consumed today by the terminal metrics/dashboard CLI (nattrmon.js
// --metrics=/--dashboard=) via lib/nmetricsview.js and lib/ndashboards.js.
// Kept intentionally small so it can later back HTTP/MCP/Configurator/GenAI
// consumers without duplicating selection logic.

// Translate a metrics CLI pattern (exact name, or glob with * and ?) into an
// anchored RegExp, matching the include/exclude convention already used by
// config/objects/nOutput_HTTP_Metrics.js (plain RegExp objects).
// ----------------------------------------
var nMetricsGlobToRegExp = function(aPattern) {
	var _p = String(aPattern)
	// Escape every regex metachar EXCEPT * and ? (left alone here so the next step can tell
	// a real glob wildcard apart from a literal char that happens to look like one).
	var _escaped = _p.replace(/[.+^${}()|[\]\\]/g, "\\$&")
	var _re = _escaped.replace(/\*/g, ".*").replace(/\?/g, ".")
	return new RegExp("^" + _re + "$")
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics(aNAttrMon, aPidFile) : nMetrics</key>
 * Thin read-only accessor over aNAttrMon's current attribute values and runtime
 * metrics, meant for terminal discovery/inspection (nattrmon.js --metrics=/--dashboard=).
 * aNAttrMon only needs to have been constructed (new nAttrMon(...)) -- it must
 * NOT have had .start() called, or plugs would execute a second time.
 * aPidFile (optional) is the daemon's pid file path, used only by daemonRunning().
 * </odoc>
 */
var nMetrics = function(aNAttrMon, aPidFile) {
	this.n = aNAttrMon
	this.pidFile = aPidFile
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.match(aPatterns) : Array</key>
 * Resolves aPatterns (a string or array of strings; each either an exact attribute
 * name or a glob using * and ?) against all known attribute names. An empty/undefined
 * aPatterns matches every known attribute. Returns a sorted array of matching names.
 * </odoc>
 */
nMetrics.prototype.match = function(aPatterns) {
	var _pats = isArray(aPatterns) ? aPatterns : (isUnDef(aPatterns) || aPatterns === "" ? [] : [aPatterns])
	var _names = this.n.listOfAttributes.getAttributes(true).map(a => a.name)

	if (_pats.length == 0) return _names.sort()

	var _res = _pats.map(nMetricsGlobToRegExp)
	var _out = {}
	_names.forEach(n => { if (_res.some(re => re.test(n))) _out[n] = true })
	return Object.keys(_out).sort()
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.get(aName) : Map</key>
 * Returns one resolved metric { name, value, type, category, tags, description, date, ageMs }
 * for the exact attribute aName, or __ if aName isn't a known attribute.
 * </odoc>
 */
nMetrics.prototype.get = function(aName) {
	var _attr = this.n.listOfAttributes.getAttributeByName(aName)
	if (isUnDef(_attr)) return __

	var _cv = this.n.currentValues.get({ name: aName })
	var _date = isDef(_cv) ? _cv.date : __
	var _now = now()

	return {
		name: aName,
		value: isDef(_cv) ? _cv.val : __,
		type: _attr.type,
		category: isArray(_attr.category) ? _attr.category.join("/") : "",
		tags: _$(_attr.tags).isArray().default([]),
		description: _attr.description,
		date: _date,
		ageMs: (isDef(_date) && !isNull(new Date(_date))) ? (_now - new Date(_date).getTime()) : __
	}
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.list(aPatterns) : Array</key>
 * Resolves aPatterns (see match()) and returns the resolved metric map (see get())
 * for each matching attribute, sorted by name.
 * </odoc>
 */
nMetrics.prototype.list = function(aPatterns) {
	var parent = this
	return this.match(aPatterns).map(n => parent.get(n)).filter(isDef)
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.snapshot(aPatterns) : Array</key>
 * Alias of list(aPatterns), kept as a distinct name for CLI/API readability
 * (a snapshot is a single point-in-time read, as opposed to a live watch).
 * </odoc>
 */
nMetrics.prototype.snapshot = function(aPatterns) {
	return this.list(aPatterns)
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.runtimeSnapshot() : Map</key>
 * Returns { available, source, daemonRunning, ts, snapshot, degraded, watchdog, history }.
 * \
 * IMPORTANT: nAttrMon.prototype.getRuntimeMetricsSnapshot()/getDegradedPlugs() read this.plugs/
 * this.threadsSessions/etc, which are only populated by .start() -> loadPlugs()/execPlugs().
 * The terminal metrics/dashboard CLI constructs its nAttrMon instance read-only and NEVER calls
 * .start() (see lib/nmain.js's constructor vs .start(), and nattrmon.js), so on that instance
 * those calls would silently return empty/zeroed data -- not an error, just wrong. This method
 * only calls them directly when this.n.alive is true (the wrapped instance really did .start()
 * itself, e.g. a future in-process consumer); otherwise ("restored", the normal CLI case) it
 * reports the newest point from the persisted runtime-history file instead (see
 * nAttrMon.prototype.getRuntimeMetricsHistory(), populated by nAttrMon.prototype.
 * publishRuntimeMetrics()'s periodic tick when __NAM_RUNTIME_METRICS_PERSIST is enabled).
 * available is false when runtime metrics were never enabled; source is "unavailable" when
 * enabled but no daemon has published+persisted a periodic snapshot yet (e.g. an older daemon
 * predating __NAM_RUNTIME_METRICS_PERSIST) -- callers should show that as an explicit message,
 * not an empty/misleading panel.
 * </odoc>
 */
nMetrics.prototype.runtimeSnapshot = function() {
	if (!this.n.runtimeMetricsEnabled) {
		return { available: false, source: __, daemonRunning: __, ts: __, snapshot: __, degraded: __, watchdog: __, history: [] }
	}

	var _history = this.n.getRuntimeMetricsHistory()

	if (this.n.alive) {
		var _snap = this.n.getRuntimeMetricsSnapshot()
		var _degraded = this.n.getDegradedPlugs({}, _snap)
		return {
			available: true,
			source: "live",
			daemonRunning: true,
			ts: _snap.ts,
			snapshot: _snap,
			degraded: _degraded,
			watchdog: _$(this.n.getSessionData("watchdog.stats")).isMap().default({}),
			history: _history
		}
	}

	if (_history.length == 0) {
		return { available: true, source: "unavailable", daemonRunning: this.daemonRunning(), ts: __, snapshot: __, degraded: __, watchdog: __, history: [] }
	}

	var _latest = _history[_history.length - 1]
	return {
		available: true,
		source: "restored",
		daemonRunning: this.daemonRunning(),
		ts: _latest.t,
		snapshot: _latest,
		degraded: __, // per-plug reasons aren't persisted (only degradedTotal/degradedNames, to keep history points cheap+bounded)
		watchdog: __,
		history: _history
	}
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.runtimeHistory() : Array</key>
 * Returns the bounded, persisted runtime-metrics history (oldest to newest; see
 * __NAM_RUNTIME_METRICS_PERSIST/__NAM_RUNTIME_METRICS_HISTORY_SIZE) as recorded by
 * nAttrMon.prototype.getRuntimeMetricsHistory(). Empty when runtime metrics/persistence
 * were never enabled, or no daemon has published a periodic snapshot yet.
 * </odoc>
 */
nMetrics.prototype.runtimeHistory = function() {
	if (!this.n.runtimeMetricsEnabled) return []
	return this.n.getRuntimeMetricsHistory()
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.daemonRunning() : boolean</key>
 * Best-effort, side-effect-free check for whether the nAttrMon daemon this metrics/
 * dashboard command targets appears to still be running, based on its pid file
 * (NATTRMON_SUBHOME/nattrmon.pid). Never claims/releases the pid lock itself --
 * unlike ow.server.checkIn()/pidCheckIn(), it only reads.
 * </odoc>
 */
nMetrics.prototype.daemonRunning = function() {
	// Cached for a couple seconds -- runtimeSnapshot() (and so this) is called once per redraw
	// by the runtime dashboard's live loop, and shelling out to `kill -0` every frame would be
	// wasteful, repeated-per-redraw work the terminal viewer is meant to avoid (see spec: avoid
	// expensive operations on every screen redraw).
	var _now = now()
	if (isDef(this.__daemonRunningCache) && (_now - this.__daemonRunningCache.ts) < 2000) {
		return this.__daemonRunningCache.val
	}

	var _val = false
	try {
		if (isDef(this.pidFile) && io.fileExists(this.pidFile)) {
			var _pid = String(ow.server.getPid(this.pidFile)).trim()
			if (/^\d+$/.test(_pid)) {
				if (java.lang.System.getProperty("os.name").match(/Windows/i)) {
					_val = true // best-effort: pid file present
				} else {
					af.sh("kill -0 " + _pid + " 2>/dev/null")
					_val = (__exitcode == 0)
				}
			}
		}
	} catch(e) { _val = false }

	this.__daemonRunningCache = { ts: _now, val: _val }
	return _val
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.pidFilePath() : String</key>
 * Returns the pid file path daemonRunning() checks against, for callers that want to
 * report it (e.g. in a "daemon not running" message).
 * </odoc>
 */
nMetrics.prototype.pidFilePath = function() {
	return this.pidFile
}

/**
 * <odoc>
 * <key>nattrmon.nMetrics.watchSession(aPatterns, aOptions) : Map</key>
 * Starts a bounded, local-only live sampling session for the metrics matching aPatterns
 * (see match()), for use by "nattrmon metrics watch"/ad-hoc "nattrmon dashboard".
 * aOptions: samples (default 60, max points kept per metric), periodMs (default 5000).
 * \
 * Reuses ow.metrics.add()/getSome() (OpenAF's own metric-getter registration, see
 * ../openaf/js/owrap.metrics.js) for the per-metric sampling function, scheduled via the same
 * Threads plugin nAttrMon.prototype.start() itself uses for periodic work (see
 * addScheduleThreadWithFixedDelay in nmain.js) -- but on a small, dedicated single-worker pool
 * owned by this session, NOT the wrapped nAttrMon instance's own this.n.thread: the Threads
 * plugin has no per-task cancel, only pool-wide .stop(), so sharing the instance's pool would
 * mean one session's stop() also kills any other session (or the instance's own work) still
 * using that pool. NOT ow.metrics.startCollecting() either, which unconditionally backs its
 * channel with an H2 MVStore file named "metrics.db" in the current directory regardless of the
 * channel name given to it; that's an unwanted, undocumented on-disk side effect for what must
 * stay a purely in-memory, per-invocation ring buffer (see spec: no temp files unless genuinely
 * necessary, bounded memory regardless of how long the session runs).
 * \
 * Returns { names, buffers, tick(), stop() }. buffers[name] is an array of up to `samples`
 * { t, value } points (oldest first), best-effort pre-seeded from any already-configured
 * history provider (getHistoryValuesByTime) when one exists. Call tick() once per UI refresh
 * to fold in the latest sample (idempotent between collector ticks); call stop() exactly once
 * when the session ends (Ctrl-C/shutdown) to stop the scheduled thread and deregister the
 * ow.metrics getters -- otherwise the Threads pool and ow.metrics.__m entries leak.
 * </odoc>
 */
nMetrics.prototype.watchSession = function(aPatterns, aOptions) {
	aOptions = _$(aOptions, "aOptions").isMap().default({})
	var _samples = _$(aOptions.samples).isNumber().default(60)
	var _periodMs = _$(aOptions.periodMs).isNumber().default(5000)
	var _names = this.match(aPatterns)
	var parent = this
	var _ns = "nattrmon::watch::" + genUUID() + "::"

	ow.loadMetrics()
	var _keys = _names.map(n => _ns + n)
	_names.forEach((n, i) => {
		ow.metrics.add(_keys[i], () => parent.get(n))
	})

	var _buffers = {}
	_names.forEach(n => {
		_buffers[n] = []
		try {
			var _windowSecs = Math.max(1, Math.ceil((_samples * _periodMs) / 1000))
			var _hist = parent.n.getHistoryValuesByTime(n, _windowSecs)
			if (isArray(_hist) && _hist.length > 0) {
				_buffers[n] = _hist.slice(-_samples).map(v => ({ t: isDef(v.date) ? new Date(v.date).getTime() : now(), value: v.val }))
			}
		} catch(e) { /* no history provider configured -- start empty, live sampling will fill it in */ }
	})

	var _foldIn = function() {
		var _t = now()
		var _got = ow.metrics.getSome(_keys)
		_names.forEach((n, i) => {
			var _m = _got[_keys[i]]
			if (isDef(_m) && _m != "error") {
				_buffers[n].push({ t: _t, value: _m.value })
				if (_buffers[n].length > _samples) _buffers[n] = _buffers[n].slice(-_samples)
			}
		})
	}

	// Prime one sample immediately so the first render isn't empty.
	_foldIn()

	// A dedicated, single-worker Threads pool per session -- NOT parent.n.thread (the wrapped
	// nAttrMon instance's own pool). The Threads plugin has no per-task cancel, only pool-wide
	// .stop(), so sharing the instance's pool would mean one session's stop() also kills any
	// other session (or the instance's own scheduled work, e.g. a future in-process caller)
	// still using that same pool.
	plugin("Threads")
	var _pool = new Threads()
	_pool.initScheduledThreadPool(1)
	_pool.addScheduleThreadWithFixedDelay(function() {
		try { _foldIn() } catch(e) {}
		return true
	}, _periodMs)

	return {
		names: _names,
		buffers: _buffers,
		tick: function() { return _buffers },
		stop: function() {
			try { _pool.stop(true) } catch(e) {}
			_keys.forEach(k => { try { delete ow.metrics.__m[k] } catch(e) {} })
		}
	}
}

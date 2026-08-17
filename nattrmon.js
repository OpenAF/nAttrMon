// nAttrMon startup script
// Copyright 2023 Nuno Aguiar

// check version
var __NATTRMON_MIN_OAF_VERSION = "20241117";
af.getVersion() >= __NATTRMON_MIN_OAF_VERSION || (print("Version " + af.getVersion() + ". You need OpenAF version " + __NATTRMON_MIN_OAF_VERSION + " to run.")) || exit(-1);

var params = processExpr();
var NATTRMON_HOME = getEnv("NATTRMON_HOME");
if (isUnDef(NATTRMON_HOME)) NATTRMON_HOME = getOPackPath("nAttrMon") || ".";
var NATTRMON_SUBHOME = getEnv("NATTRMON_DIR");
if (isUnDef(NATTRMON_SUBHOME)) NATTRMON_SUBHOME = params.withHome || NATTRMON_HOME;

loadLib(NATTRMON_HOME + "/lib/nmain.js");

// Terminal metrics/dashboard CLI (--metrics=/--dashboard=) is a read-only, one-shot inspection
// of a (possibly already running, e.g. kubectl exec'd into) nAttrMon -- it must never write into
// the live daemon's shared log directory/housekeeping (see lib/nmain.js constructor's
// ow.ch.utils.setLogToFile(), gated by __NAM_LOGCONSOLE). Force console-only logging for this
// path before nAttrMon is constructed below.
if (isDef(params.metrics) || isDef(params.dashboard)) __NAM_LOGCONSOLE = true;

// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var nattrmon;

if (isUnDef(params.withDirectory)) {
	nattrmon = new nAttrMon(NATTRMON_SUBHOME + "/config", params.__NAM_DEBUG || __NAM_DEBUG);
} else {
	nattrmon = new nAttrMon(params.withDirectory, params.__NAM_DEBUG || __NAM_DEBUG);
}

// ----------------------------------------------------------------------------------------------
// Terminal metrics/dashboard CLI -- one-shot, read-only inspection of nattrmon's own attribute/
// runtime metrics (see docs/TERMINAL-DASHBOARD.md). Deliberately placed BEFORE ow.server.checkIn()
// below: that call refuses to proceed (exit(-1)) whenever another nAttrMon instance already holds
// the pid file, which is exactly the common case here (kubectl exec into an already-running pod).
// Mirrors --status/--preflight's "construct, one-shot check, exit()" shape, but never calls
// nattrmon.start() -- only .start() executes input/output/validation plugs, and running a second
// copy of those against an already-running daemon would be exactly the "parallel metrics
// collection system" this feature must avoid.
// ----------------------------------------------------------------------------------------------
if (isDef(params.metrics) || isDef(params.dashboard)) {
	loadLib(NATTRMON_HOME + "/lib/nmetrics.js");
	loadLib(NATTRMON_HOME + "/lib/nmetricsview.js");
	loadLib(NATTRMON_HOME + "/lib/ndashboards.js");

	var __nam_parseDuration = function(aStr, aDefaultMs) {
		if (isUnDef(aStr)) return aDefaultMs;
		var _m = String(aStr).trim().match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/);
		if (!_m) return aDefaultMs;
		var _n = Number(_m[1]);
		if (_m[2] == "ms") return _n;
		if (_m[2] == "m") return _n * 60000;
		return _n * 1000;
	};

	var __nam_select = isDef(params.select) ? String(params.select).split(",").map(s => s.trim()).filter(s => s.length > 0) : [];
	var __nam_refreshMs = __nam_parseDuration(params.refresh, isNumber(nattrmon.runtimeMetricsPeriod) ? nattrmon.runtimeMetricsPeriod : 5000);
	var __nam_samples = isDef(params.samples) ? Number(params.samples) : 60;
	var __nam_format = _$(params.format).isString().default("table");

	var __nm = new nMetrics(nattrmon, NATTRMON_SUBHOME + "/nattrmon.pid");
	var __nam_caps = nMetricsView.getCaps();

	if (isDef(params.metrics)) {
		switch (String(params.metrics).toLowerCase()) {
		case "list":
			print(nMetricsView.output(__nm.list(__nam_select), { format: __nam_format, caps: __nam_caps }));
			exit(0);
			break;
		case "snapshot":
			print(nMetricsView.output(__nm.snapshot(__nam_select), { format: __nam_format, caps: __nam_caps }));
			exit(0);
			break;
		case "watch":
			if (__nam_select.length == 0) {
				printErr("--metrics=watch requires --select=<pattern>[,<pattern>...]");
				exit(2);
			}
			var __nam_resolved = __nm.match(__nam_select);
			if (__nam_resolved.length == 0) {
				printErr("No metrics matched: " + __nam_select.join(", "));
				exit(1);
			}
			var __nam_watchSession = __nm.watchSession(__nam_resolved, { samples: __nam_samples, periodMs: __nam_refreshMs });
			addOnOpenAFShutdown(() => __nam_watchSession.stop());
			nMetricsView.runLive(ctx => nMetricsView.renderWatchFrame(__nam_watchSession, { caps: ctx.caps }), { refreshMs: __nam_refreshMs });
			exit(0);
			break;
		default:
			printErr("Unknown --metrics value '" + params.metrics + "' (expected list|snapshot|watch)");
			exit(2);
		}
	}

	if (isDef(params.dashboard)) {
		var __nam_dashName = String(params.dashboard).trim();
		var __nam_dashIsRuntime = (__nam_dashName.toLowerCase() == "runtime");
		var __nam_dashArg = __nam_dashIsRuntime ? "runtime" : __nam_dashName.split(",").map(s => s.trim()).filter(s => s.length > 0);

		if (!__nam_dashIsRuntime) {
			var __nam_dashResolved = __nm.match(__nam_dashArg);
			if (__nam_dashResolved.length == 0) {
				printErr("No metrics matched: " + __nam_dashArg.join(", "));
				exit(1);
			}
		}

		var __nam_dash = nDashboards.build(__nam_dashArg, __nm, { samples: __nam_samples, periodMs: __nam_refreshMs });
		addOnOpenAFShutdown(() => __nam_dash.stop());

		// --format=json|yaml is a one-shot structured dump (like --metrics=snapshot), not a live
		// view -- makes `kubectl exec <pod> -- ... --dashboard=runtime --format=json` scriptable
		// even without a TTY, instead of silently falling back to a bordered ANSI dashboard.
		if (__nam_format == "json" || __nam_format == "yaml") {
			var __nam_dashData = __nam_dash.panels.map(p => merge({ title: p.title, type: p.type }, p.pull()));
			print(__nam_format == "json" ? stringify(__nam_dashData, __, "  ") : af.toYAML(__nam_dashData));
			__nam_dash.stop();
			exit(0);
		}

		nMetricsView.runLive(ctx => nMetricsView.renderDashboardFrame(__nam_dash.panels, { caps: ctx.caps }), { refreshMs: __nam_refreshMs });
		exit(0);
	}
}

var __sleepperiod = isNumber(__NAM_MAIN_WATCHDOG_SLEEP) ? __NAM_MAIN_WATCHDOG_SLEEP : 60000
var __stuckfactor = isNumber(__NAM_MAIN_WATCHDOG_STUCKFACTOR) ? __NAM_MAIN_WATCHDOG_STUCKFACTOR : 500
var __warnCooldown = isNumber(__NAM_MAIN_WATCHDOG_WARN_COOLDOWN) ? __NAM_MAIN_WATCHDOG_WARN_COOLDOWN : 300000
var __watchdogLastWarn = {}
var __watchdogStats = {
	startedAt: __,
	lastUpdate: __,
	mainThresholdHits: 0,
	threadThresholdHits: 0,
	restarts: 0,
	warningsEmitted: 0,
	warningsSuppressed: 0,
	lastWarningAt: __,
	lastWarningKey: __,
	lastRestartAt: __,
	lastRestartReason: __
}

var __watchdogSync = function() {
	try {
		if (isDef(nattrmon) && isFunction(nattrmon.setSessionData)) nattrmon.setSessionData("watchdog.stats", clone(__watchdogStats))
		if (isDef(nattrmon) && isFunction(nattrmon.publishRuntimeMetrics)) nattrmon.publishRuntimeMetrics("watchdog-sync")
	} catch(e) {}
}

var __watchdogBump = function(aKey, aInc) {
	aInc = isNumber(aInc) ? aInc : 1
	if (!isNumber(__watchdogStats[aKey])) __watchdogStats[aKey] = 0
	__watchdogStats[aKey] += aInc
	__watchdogStats.lastUpdate = now()
}

var __watchdogSet = function(aKey, aVal) {
	__watchdogStats[aKey] = aVal
	__watchdogStats.lastUpdate = now()
}

var __watchdogWarn = function(aKey, aMsg) {
	var _n = now()
	var _lw = __watchdogLastWarn[aKey]
	if (isUnDef(_lw) || (_n - _lw) >= __warnCooldown) {
		__watchdogBump("warningsEmitted")
		__watchdogSet("lastWarningAt", _n)
		__watchdogSet("lastWarningKey", aKey)
		logWarn(aMsg)
		__watchdogLastWarn[aKey] = _n
		if (isDef(nattrmon) && isFunction(nattrmon.recordWatchdogEvent)) nattrmon.recordWatchdogEvent("warning", { key: aKey, message: aMsg, suppressed: false })
		__watchdogSync()
	} else {
		__watchdogBump("warningsSuppressed")
		if (isDef(nattrmon) && isFunction(nattrmon.recordWatchdogEvent)) nattrmon.recordWatchdogEvent("warning", { key: aKey, message: aMsg, suppressed: true })
		__watchdogSync()
	}
}

if (isDef(params.watchdogSleep)) {
	var _wdSleep = Number(params.watchdogSleep)
	if (!isNaN(_wdSleep) && isFinite(_wdSleep) && _wdSleep > 0) __sleepperiod = _wdSleep
}
if (isDef(params.watchdogStuckFactor)) {
	var _wdFactor = Number(params.watchdogStuckFactor)
	if (!isNaN(_wdFactor) && isFinite(_wdFactor) && _wdFactor > 0) __stuckfactor = _wdFactor
}
if (isDef(params.watchdogWarnCooldown)) {
	var _wdWarnCooldown = Number(params.watchdogWarnCooldown)
	if (!isNaN(_wdWarnCooldown) && isFinite(_wdWarnCooldown) && _wdWarnCooldown >= 0) __warnCooldown = _wdWarnCooldown
}

// Option stop
if (isDef(params.stop)) {
	pidKill(ow.server.getPid(NATTRMON_SUBHOME + "/nattrmon.pid"));
	exit(1);
}

ow.server.checkIn(NATTRMON_SUBHOME + "/nattrmon.pid", function(aPid) {
	if (isDef(params.restart)) {
		log("Killing process " + ow.server.getPid(aPid));
                if (!pidKill(ow.server.getPid(aPid), false)) 
		   pidKill(ow.server.getPid(aPid), true);
		return true;
	} else {
 		if (isDef(params.stop)) {
			exit(0);	
 		}
		if (isDef(params.status)) {
 			var pid = ow.server.getPid(aPid);
			if (isDef(pid)) log("Running on pid = " + pid);
                }
		return false;
	}
}, function() {
	nattrmon.stop();
	log("nAttrMon stopped.");	
});

if (isDef(params.status)) {
   log("Not running");
   exit(0);
}

if (isDef(params.preflight)) {
	log("Running nAttrMon preflight checks...")
	var _pf = nattrmon.preflight()
	if (_pf.ok) {
		log("nAttrMon preflight passed with no issues.")
		exit(0)
	} else {
		logErr("nAttrMon preflight failed with " + _pf.totalIssues + " issue(s):")
		_pf.issues.forEach(i => logErr(" - " + i))
		exit(2)
	}
}

nattrmon.start();
__watchdogSet("startedAt", now())
__watchdogSync()
if (isFunction(nattrmon.recordWatchdogEvent)) nattrmon.recordWatchdogEvent("started", { main: NATTRMON_HOME, home: NATTRMON_SUBHOME })
log("nAttrMon started (main=" + NATTRMON_HOME + "; home=" + NATTRMON_SUBHOME + ").");
log("nAttrMon watchdog configuration (sleep=" + __sleepperiod + "ms; stuckFactor=" + __stuckfactor + "; warnCooldown=" + __warnCooldown + "ms).");

ow.server.daemon(__sleepperiod, function() {
	// Check main health
	var _mainElapsed = now() - nattrmon.count
	var _mainThreshold = nattrmon.countCheck * __stuckfactor
	if (_mainElapsed >= _mainThreshold) {
		__watchdogBump("mainThresholdHits")
		__watchdogBump("restarts")
		__watchdogSet("lastRestartAt", now())
		__watchdogSet("lastRestartReason", "main")
		__watchdogSync()
		__watchdogWarn("main", "nAttrMon watchdog(main) threshold reached (elapsed=" + _mainElapsed + "ms; threshold=" + _mainThreshold + "ms; countCheck=" + nattrmon.countCheck + "; stuckFactor=" + __stuckfactor + ").")
		if (isFunction(nattrmon.recordWatchdogEvent)) nattrmon.recordWatchdogEvent("restart", { reason: "main", elapsedMs: _mainElapsed, thresholdMs: _mainThreshold })
		log("nAttrMon restarting process!!");
		nattrmon.stop();
		restartOpenAF();
	}

	// Check all threads
	for(var uuid in nattrmon.threadsSessions) {
		var _ts = nattrmon.threadsSessions[uuid]
		var _thElapsed = now() - _ts.count
		var _thThreshold = _ts.entry.aTime * __stuckfactor
		if ( isUnDef(_ts.entry.getCron()) && 
			 _ts.entry.aTime > 0 && 
			 _thElapsed >= _thThreshold ) {
			__watchdogBump("threadThresholdHits")
			__watchdogBump("restarts")
			__watchdogSet("lastRestartAt", now())
			__watchdogSet("lastRestartReason", "thread:" + uuid + ":" + _ts.entry.getName())
			__watchdogSync()
			__watchdogWarn("thread:" + uuid, "nAttrMon watchdog(thread) threshold reached (uuid=" + uuid + "; name='" + _ts.entry.getName() + "'; elapsed=" + _thElapsed + "ms; threshold=" + _thThreshold + "ms; aTime=" + _ts.entry.aTime + "; stuckFactor=" + __stuckfactor + ").")
			if (isFunction(nattrmon.recordWatchdogEvent)) nattrmon.recordWatchdogEvent("restart", {
				reason: "thread",
				uuid: uuid,
				name: _ts.entry.getName(),
				plugType: _ts.entry.type,
				plugCategory: _ts.entry.getCategory(),
				elapsedMs: _thElapsed,
				thresholdMs: _thThreshold
			})
			log("nAttrMon restarting process!!");
			nattrmon.stop();
			restartOpenAF();
		}
	}
});
nattrmon.stop();

log("nAttrMon stopped.");
print(new Date() + " | Stopping.");

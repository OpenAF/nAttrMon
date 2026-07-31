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

// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var nattrmon;

if (isUnDef(params.withDirectory)) {
	nattrmon = new nAttrMon(NATTRMON_SUBHOME + "/config", params.__NAM_DEBUG || __NAM_DEBUG);
} else {
	nattrmon = new nAttrMon(params.withDirectory, params.__NAM_DEBUG || __NAM_DEBUG);
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
		__watchdogSync()
	} else {
		__watchdogBump("warningsSuppressed")
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

nattrmon.start();
__watchdogSet("startedAt", now())
__watchdogSync()
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
			log("nAttrMon restarting process!!");
			nattrmon.stop();
			restartOpenAF();
		}
	}
});
nattrmon.stop();

log("nAttrMon stopped.");
print(new Date() + " | Stopping.");

// nAttrMon main script functionality
// Copyright 2023 Nuno Aguiar

// Initialization 
var __NAM_LOGHK_HOWLONGAGOINMINUTES = 30 * 24 * 60  // How long to keep logs
var __NAM_LOGAUDIT                  = true          // Set to false to turn it off
var __NAM_LOGAUDIT_TEMPLATE         = "AUDIT | User: {{request.user}} | Channel: {{name}} | Operation: {{op}} | Key: {{{key}}}" // Audit log template
var __NAM_JAVA_ARGS                 = [ ]           // Array of java arguments
var __NAM_LOGCONSOLE                = false         // Create files or log to console
var __NAM_MAXPLUGEXECUTE_TIME       = __            // Max default time for plug execution
var __NAM_DEBUG                     = false			// Debug flag
var __NAM_BUFFERCHANNELS            = false			// Buffer channels
var __NAM_BUFFERBYNUMBER            = 100			// Buffer by number of entries
var __NAM_BUFFERBYTIME              = 1000			// Buffer by time in ms
var __NAM_WORKERS                   = __cpucores	// Number of worker threads
var __NAM_COREOBJECTS               = __			// Core objects to be loaded
var __NAM_COREOBJECTS_LAZYLOADING   = true			// Core objects lazy loading
var __NAM_NEED_CH_PERSISTENCE       = true			// Need channels persistence
var __NAM_CH_PERSISTENCE_PATH       = __			// Path to store channel persistence files
var __NAM_CLOSEDHK_HOWLONGAGOINMS   = 60000         // How long to keep closed warnings in ms
var __NAM_CLOSEDHK_ONSTARTUP        = true			// Closed warnings on startup
var __NAM_CHANNEL_CVALS             = __			// Channel for current values
var __NAM_CHANNEL_LVALS             = __			// Channel for last values
var __NAM_CHANNEL_WARNS             = __			// Channel for warnings
var __NAM_CHANNEL_WNOTS             = __			// Channel for notifications
var __NAM_CHANNEL_LOGS              = __			// Channel for logs
var __NAM_LIBS                      = __			// Libraries
var __NAM_JSONLOG                   = false			// JSON log flag
var __NAM_SLOWDOWN                  = true			// Slowdown flag
var __NAM_SLOWDOWN_WARNS            = false			// Slowdown warnings flag
var __NAM_SLOWDOWN_TIME             = 250			// Slowdown time in ms
var __NAM_NOPLUGFILES               = false			// No plug files flag
var __NAM_PLUGSORDER                = "inputs,outputs,validations" // Plugs order
var __NAM_ERRSTACK                  = true          // Print error stack trace
var __NAM_ALLOW_EVAL_EXECFROM       = true          // Keep eval fallback for execFrom compatibility
var __NAM_MAIN_WATCHDOG_SLEEP       = 60000         // Main loop watchdog period in ms
var __NAM_MAIN_WATCHDOG_STUCKFACTOR = 500           // Stuck detection multiplier
var __NAM_MAIN_WATCHDOG_WARN_COOLDOWN = 300000      // Min interval between repeated watchdog warnings for same key
var __NAM_RUNTIME_METRICS           = true          // Enable runtime metrics snapshots/publication
var __NAM_RUNTIME_METRICS_PERIOD    = 5000          // Runtime metrics periodic publish cadence (ms)
var __NAM_RUNTIME_METRICS_CH        = "nattrmon::runtime::metrics" // Runtime metrics channel
var __NAM_RUNTIME_EVENTS_CH         = "nattrmon::runtime::events"  // Runtime events channel
var __NAM_RUNTIME_OWMETRICS         = false         // Optional ow.metrics collector registration
var __NAM_RUNTIME_OWMETRICS_NAME    = "nattrmon_runtime" // ow.metrics collector name
var __NAM_DEGRADED_ERROR_RATE_THRESHOLD = 0.25      // Error-rate threshold to flag degraded plugs
var __NAM_DEGRADED_MIN_EXECS            = 5         // Minimum executions before applying error-rate degradation rule
var __NAM_DEGRADED_TIMEOUT_HITS         = 2         // Timeout-hit threshold to flag degraded plugs
var __NAM_DEGRADED_WATCHDOG_HITS        = 1         // Watchdog thread-hit threshold to flag degraded plugs
var __NAM_INTEGRITY                 = {}            // Optional file integrity map (path -> hash)
var __NAM_INTEGRITY_WARN            = true          // If true integrity mismatches are warnings; otherwise load fails
var __NAM_INTEGRITY_STRICT          = false         // If true files without configured hash also fail integrity checks
var __NAM_DESCRIPTOR_SCHEMA_WARN    = true          // If true descriptor schema issues are logged/preflighted
var __NAM_DESCRIPTOR_SCHEMA_STRICT  = false         // If true descriptor schema issues fail loading
var __NAM_DESCRIPTOR_LEGACY_WARN    = true          // If true legacy descriptor keys emit compatibility warnings

var __NAM_SEC_REPO        = __   // Security repository
var __NAM_SEC_BUCKET      = __   // Security bucket
var __NAM_SEC_BUCKET_PASS = __   // Security bucket password
var __NAM_SEC_MAIN_PASS   = __   // Security main password
var __NAM_SEC_FILE        = __   // Security file

var NATTRMON_HOME = NATTRMON_HOME || getOPackPath("nAttrMon") || "."  // nAttrMon home

// -------------------------------------------------------------------

ow.loadServer()
ow.loadObj()
ow.loadFormat()
ow.loadTemplate()
if (isDef(ow.template.addOpenAFHelpers)) ow.template.addOpenAFHelpers()
ow.template.addFormatHelpers()
ow.template.addConditionalHelpers()
loadLodash()

/*
if (isUnDef(toBoolean)) toBoolean = function(aObj) {
	if (isBoolean(aObj)) return aObj;
	if (isNumber(aObj)) return Boolean(aObj);
	if (isString(aObj)) return (aObj.trim().toLowerCase() == 'true');
	return aObj;
}
*/

var params
var pms = getEnvs()
if (io.fileExists(NATTRMON_SUBHOME + "/nattrmon.yaml"))
	pms = merge(io.readFileYAML(NATTRMON_SUBHOME + "/nattrmon.yaml", true), pms)

var __nam_mergeIntegrityEntries = function(aTarget, aSource) {
	aTarget = _$(aTarget).isMap().default({})
	aSource = _$(aSource).isMap().default({})
	Object.keys(aSource).forEach(k => {
		if (isString(aSource[k])) aTarget[String(k)] = aSource[k]
	})
	return aTarget
}

// Typed parser helpers for the __NAM_* bootstrap config below -- each mirrors exactly one
// of the guard/coercion patterns that used to be duplicated inline (isDef+toBoolean,
// isDef+Number, isDef&&isNumber strict, isString guard, isDef+String, isDef&&isArray,
// bare isDef passthrough), so behavior is unchanged; only the duplication is removed.
// ----------------------------------------
// pms = parsed env/yaml config map; key = property name on pms; cur = current/default value
// ----------------------------------------
const __nam_cfgBool = (pms, key, cur) => isDef(pms[key]) ? toBoolean(pms[key]) : cur
const __nam_cfgNum = (pms, key, cur) => isDef(pms[key]) ? Number(pms[key]) : cur
const __nam_cfgNumStrict = (pms, key, cur) => (isDef(pms[key]) && isNumber(pms[key])) ? Number(pms[key]) : cur
const __nam_cfgStr = (pms, key, cur) => isString(pms[key]) ? pms[key] : cur
const __nam_cfgStrCoerce = (pms, key, cur) => isDef(pms[key]) ? String(pms[key]) : cur
const __nam_cfgArr = (pms, key, cur) => (isDef(pms[key]) && isArray(pms[key])) ? pms[key] : cur
const __nam_cfgAny = (pms, key, cur) => isDef(pms[key]) ? pms[key] : cur

//if (isUnDef(pms) || pms == null) pms = {};
__NAM_JAVA_ARGS = __nam_cfgArr(pms, "JAVA_ARGS", __NAM_JAVA_ARGS)
__NAM_LOGAUDIT = __nam_cfgBool(pms, "LOGAUDIT", __NAM_LOGAUDIT)
__NAM_LOGAUDIT_TEMPLATE = __nam_cfgStr(pms, "LOGAUDIT_TEMPLATE", __NAM_LOGAUDIT_TEMPLATE)
__NAM_LOGHK_HOWLONGAGOINMINUTES = __nam_cfgNumStrict(pms, "LOGHK_HOWLONGAGOINMINUTES", __NAM_LOGHK_HOWLONGAGOINMINUTES)
if (isDef(pms.NUMBER_WORKERS)) { __cpucores = Number(pms.NUMBER_WORKERS); __NAM_WORKERS = Number(pms.NUMBER_WORKERS) }
if (isDef(pms.LOG_ASYNC)) __logFormat.async = toBoolean(pms.LOG_ASYNC)
__NAM_DEBUG = __nam_cfgBool(pms, "DEBUG", __NAM_DEBUG)
__NAM_LOGCONSOLE = __nam_cfgBool(pms, "LOGCONSOLE", __NAM_LOGCONSOLE)
__NAM_JSONLOG = __nam_cfgBool(pms, "JSONLOG", __NAM_JSONLOG)
__NAM_MAXPLUGEXECUTE_TIME = __nam_cfgNum(pms, "MAXPLUGEXECUTE_TIME", __NAM_MAXPLUGEXECUTE_TIME)
if (isDef(params) && isUnDef(params.withDirectory) && isDef(pms.CONFIG)) params.withDirectory = pms.CONFIG

__NAM_BUFFERCHANNELS = __nam_cfgBool(pms, "BUFFERCHANNELS", __NAM_BUFFERCHANNELS)
__NAM_BUFFERBYNUMBER = __nam_cfgNum(pms, "BUFFERBYNUMBER", __NAM_BUFFERBYNUMBER)
__NAM_BUFFERBYTIME = __nam_cfgNum(pms, "BUFFERBYTIME", __NAM_BUFFERBYTIME)

__NAM_COREOBJECTS = __nam_cfgAny(pms, "COREOBJECTS", __NAM_COREOBJECTS)
__NAM_COREOBJECTS_LAZYLOADING = __nam_cfgBool(pms, "COREOBJECTS_LAZYLOADING", __NAM_COREOBJECTS_LAZYLOADING)

__NAM_LIBS = __nam_cfgStr(pms, "LIBS", __NAM_LIBS)

__NAM_CHANNEL_CVALS = __nam_cfgStr(pms, "CHANNEL_CVALS", __NAM_CHANNEL_CVALS)
__NAM_CHANNEL_LVALS = __nam_cfgStr(pms, "CHANNEL_LVALS", __NAM_CHANNEL_LVALS)
__NAM_CHANNEL_WARNS = __nam_cfgStr(pms, "CHANNEL_WARNS", __NAM_CHANNEL_WARNS)
__NAM_CHANNEL_WNOTS = __nam_cfgStr(pms, "CHANNEL_WNOTS", __NAM_CHANNEL_WNOTS)
__NAM_CHANNEL_LOGS = __nam_cfgStr(pms, "CHANNEL_LOGS", __NAM_CHANNEL_LOGS)

__NAM_CH_PERSISTENCE_PATH = __nam_cfgAny(pms, "CH_PERSISTENCE_PATH", __NAM_CH_PERSISTENCE_PATH)
__NAM_CLOSEDHK_HOWLONGAGOINMS = __nam_cfgNum(pms, "CLOSEDHK_HOWLONGAGOINMS", __NAM_CLOSEDHK_HOWLONGAGOINMS)
__NAM_CLOSEDHK_ONSTARTUP = __nam_cfgBool(pms, "CLOSEDHK_ONSTARTUP", __NAM_CLOSEDHK_ONSTARTUP)

__NAM_NEED_CH_PERSISTENCE = __nam_cfgBool(pms, "NEED_CH_PERSISTENCE", __NAM_NEED_CH_PERSISTENCE)
__NAM_SLOWDOWN = __nam_cfgBool(pms, "SLOWDOWN", __NAM_SLOWDOWN)
__NAM_SLOWDOWN_WARNS = __nam_cfgBool(pms, "SLOWDOWN_WARNS", __NAM_SLOWDOWN_WARNS)
__NAM_SLOWDOWN_TIME = __nam_cfgNum(pms, "SLOWDOWN_TIME", __NAM_SLOWDOWN_TIME)
__NAM_NOPLUGFILES = __nam_cfgBool(pms, "NOPLUGFILES", __NAM_NOPLUGFILES)
__NAM_PLUGSORDER = __nam_cfgStrCoerce(pms, "PLUGSORDER", __NAM_PLUGSORDER)
__NAM_ALLOW_EVAL_EXECFROM = __nam_cfgBool(pms, "ALLOW_EVAL_EXECFROM", __NAM_ALLOW_EVAL_EXECFROM)
__NAM_MAIN_WATCHDOG_SLEEP = __nam_cfgNum(pms, "MAIN_WATCHDOG_SLEEP", __NAM_MAIN_WATCHDOG_SLEEP)
__NAM_MAIN_WATCHDOG_STUCKFACTOR = __nam_cfgNum(pms, "MAIN_WATCHDOG_STUCKFACTOR", __NAM_MAIN_WATCHDOG_STUCKFACTOR)
__NAM_MAIN_WATCHDOG_WARN_COOLDOWN = __nam_cfgNum(pms, "MAIN_WATCHDOG_WARN_COOLDOWN", __NAM_MAIN_WATCHDOG_WARN_COOLDOWN)
__NAM_RUNTIME_METRICS = __nam_cfgBool(pms, "RUNTIME_METRICS", __NAM_RUNTIME_METRICS)
__NAM_RUNTIME_METRICS_PERIOD = __nam_cfgNum(pms, "RUNTIME_METRICS_PERIOD", __NAM_RUNTIME_METRICS_PERIOD)
__NAM_RUNTIME_METRICS_CH = __nam_cfgStrCoerce(pms, "RUNTIME_METRICS_CH", __NAM_RUNTIME_METRICS_CH)
__NAM_RUNTIME_EVENTS_CH = __nam_cfgStrCoerce(pms, "RUNTIME_EVENTS_CH", __NAM_RUNTIME_EVENTS_CH)
__NAM_RUNTIME_OWMETRICS = __nam_cfgBool(pms, "RUNTIME_OWMETRICS", __NAM_RUNTIME_OWMETRICS)
__NAM_RUNTIME_OWMETRICS_NAME = __nam_cfgStrCoerce(pms, "RUNTIME_OWMETRICS_NAME", __NAM_RUNTIME_OWMETRICS_NAME)
__NAM_DEGRADED_ERROR_RATE_THRESHOLD = __nam_cfgNum(pms, "DEGRADED_ERROR_RATE_THRESHOLD", __NAM_DEGRADED_ERROR_RATE_THRESHOLD)
__NAM_DEGRADED_MIN_EXECS = __nam_cfgNum(pms, "DEGRADED_MIN_EXECS", __NAM_DEGRADED_MIN_EXECS)
__NAM_DEGRADED_TIMEOUT_HITS = __nam_cfgNum(pms, "DEGRADED_TIMEOUT_HITS", __NAM_DEGRADED_TIMEOUT_HITS)
__NAM_DEGRADED_WATCHDOG_HITS = __nam_cfgNum(pms, "DEGRADED_WATCHDOG_HITS", __NAM_DEGRADED_WATCHDOG_HITS)

if (isMap(pms.RUNTIME_METRICS)) {
	if (isBoolean(pms.RUNTIME_METRICS.enabled)) __NAM_RUNTIME_METRICS = pms.RUNTIME_METRICS.enabled
	if (isNumber(pms.RUNTIME_METRICS.period)) __NAM_RUNTIME_METRICS_PERIOD = Number(pms.RUNTIME_METRICS.period)
	if (isString(pms.RUNTIME_METRICS.channel)) __NAM_RUNTIME_METRICS_CH = String(pms.RUNTIME_METRICS.channel)
	if (isString(pms.RUNTIME_METRICS.eventsChannel)) __NAM_RUNTIME_EVENTS_CH = String(pms.RUNTIME_METRICS.eventsChannel)
	if (isBoolean(pms.RUNTIME_METRICS.owMetrics)) __NAM_RUNTIME_OWMETRICS = pms.RUNTIME_METRICS.owMetrics
	if (isString(pms.RUNTIME_METRICS.owMetricsName)) __NAM_RUNTIME_OWMETRICS_NAME = String(pms.RUNTIME_METRICS.owMetricsName)
}
if (isMap(pms.RUNTIME_DIAGNOSTICS)) {
	if (isNumber(pms.RUNTIME_DIAGNOSTICS.errorRateThreshold)) __NAM_DEGRADED_ERROR_RATE_THRESHOLD = Number(pms.RUNTIME_DIAGNOSTICS.errorRateThreshold)
	if (isNumber(pms.RUNTIME_DIAGNOSTICS.minExecs)) __NAM_DEGRADED_MIN_EXECS = Number(pms.RUNTIME_DIAGNOSTICS.minExecs)
	if (isNumber(pms.RUNTIME_DIAGNOSTICS.timeoutHits)) __NAM_DEGRADED_TIMEOUT_HITS = Number(pms.RUNTIME_DIAGNOSTICS.timeoutHits)
	if (isNumber(pms.RUNTIME_DIAGNOSTICS.watchdogHits)) __NAM_DEGRADED_WATCHDOG_HITS = Number(pms.RUNTIME_DIAGNOSTICS.watchdogHits)
}

__NAM_INTEGRITY_WARN = __nam_cfgBool(pms, "INTEGRITY_WARN", __NAM_INTEGRITY_WARN)
__NAM_INTEGRITY_STRICT = __nam_cfgBool(pms, "INTEGRITY_STRICT", __NAM_INTEGRITY_STRICT)
__NAM_DESCRIPTOR_SCHEMA_WARN = __nam_cfgBool(pms, "DESCRIPTOR_SCHEMA_WARN", __NAM_DESCRIPTOR_SCHEMA_WARN)
__NAM_DESCRIPTOR_SCHEMA_STRICT = __nam_cfgBool(pms, "DESCRIPTOR_SCHEMA_STRICT", __NAM_DESCRIPTOR_SCHEMA_STRICT)
__NAM_DESCRIPTOR_LEGACY_WARN = __nam_cfgBool(pms, "DESCRIPTOR_LEGACY_WARN", __NAM_DESCRIPTOR_LEGACY_WARN)
if (isMap(pms.DESCRIPTOR_SCHEMA)) {
	if (isBoolean(pms.DESCRIPTOR_SCHEMA.warn)) __NAM_DESCRIPTOR_SCHEMA_WARN = pms.DESCRIPTOR_SCHEMA.warn
	if (isBoolean(pms.DESCRIPTOR_SCHEMA.strict)) __NAM_DESCRIPTOR_SCHEMA_STRICT = pms.DESCRIPTOR_SCHEMA.strict
	if (isBoolean(pms.DESCRIPTOR_SCHEMA.legacyWarn)) __NAM_DESCRIPTOR_LEGACY_WARN = pms.DESCRIPTOR_SCHEMA.legacyWarn
}
if (isMap(pms.INTEGRITY_HASHES)) __NAM_INTEGRITY = __nam_mergeIntegrityEntries(__NAM_INTEGRITY, pms.INTEGRITY_HASHES)
if (isMap(pms.INTEGRITY)) {
	if (isMap(pms.INTEGRITY.hashes)) __NAM_INTEGRITY = __nam_mergeIntegrityEntries(__NAM_INTEGRITY, pms.INTEGRITY.hashes)
	if (isArray(pms.INTEGRITY.list)) {
		pms.INTEGRITY.list.forEach(entry => {
			if (isMap(entry) && Object.keys(entry).length > 0) {
				var _k = Object.keys(entry)[0]
				if (isString(entry[_k])) __NAM_INTEGRITY[String(_k)] = entry[_k]
			}
		})
	}
	if (isBoolean(pms.INTEGRITY.warn)) __NAM_INTEGRITY_WARN = pms.INTEGRITY.warn
	if (isBoolean(pms.INTEGRITY.strict)) __NAM_INTEGRITY_STRICT = pms.INTEGRITY.strict
}

__NAM_SEC_REPO = __nam_cfgStrCoerce(pms, "SEC_REPO", __NAM_SEC_REPO)
__NAM_SEC_BUCKET = __nam_cfgStrCoerce(pms, "SEC_BUCKET", __NAM_SEC_BUCKET)
__NAM_SEC_BUCKET_PASS = __nam_cfgStrCoerce(pms, "SEC_BUCKET_PASS", __NAM_SEC_BUCKET_PASS)
__NAM_SEC_MAIN_PASS = __nam_cfgStrCoerce(pms, "SEC_MAIN_PASS", __NAM_SEC_MAIN_PASS)
__NAM_SEC_FILE = __nam_cfgStrCoerce(pms, "SEC_FILE", __NAM_SEC_FILE)

__NAM_ERRSTACK = __nam_cfgBool(pms, "ERRSTACK", __NAM_ERRSTACK)

// Auxiliary objects
loadLib(NATTRMON_HOME + "/lib/nattribute.js")
loadLib(NATTRMON_HOME + "/lib/nattributevalue.js")
loadLib(NATTRMON_HOME + "/lib/nattributes.js")
loadLib(NATTRMON_HOME + "/lib/nmonitoredobject.js")
loadLib(NATTRMON_HOME + "/lib/nplug.js")
loadLib(NATTRMON_HOME + "/lib/ninput.js")
loadLib(NATTRMON_HOME + "/lib/noutput.js")
loadLib(NATTRMON_HOME + "/lib/nwarning.js")
loadLib(NATTRMON_HOME + "/lib/nwarnings.js")
loadLib(NATTRMON_HOME + "/lib/nvalidation.js")

loadLib(NATTRMON_HOME + "/lib/ntmplhelpers.js")

// Main object ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

// Get security values
// --------------------------------------------------------------------------------
// aM = map with security parameters
// aPath = optional path to merge security values into
// Returns map with security values merged or original map if no secKey is provided
// --------------------------------------------------------------------------------
const __nam_getSec = (aM, aPath) => {
	aM = _$(aM).isMap().default({})
	if (isDef(aM.secKey)) {
		var aMap = clone(aM)
		
		aMap.secRepo     = _$(aMap.secRepo).default(__NAM_SEC_REPO)
		aMap.secBucket   = _$(aMap.secBucket).default(__NAM_SEC_BUCKET)
		aMap.secPass     = _$(aMap.secPass).default(__NAM_SEC_BUCKET_PASS)
		aMap.secMainPass = _$(aMap.secMainPass).default(__NAM_SEC_MAIN_PASS)
		aMap.secFile     = _$(aMap.secFile).default(__NAM_SEC_FILE)

		var s = $sec(aMap.secRepo, aMap.secBucket, aMap.secPass, aMap.secMainPass, aMap.secFile).get(aMap.secKey)

		delete aMap.secRepo
		delete aMap.secBucket
		delete aMap.secPass
		delete aMap.secMainPass
		delete aMap.secFile
		delete aMap.secKey

		if (isDef(aPath)) {
			return $$(aMap).set(aPath, merge($$(aMap).get(aPath), s))
		} else {
			return merge(aMap, s)
		}
	} else {
		return aM
	}
}

// Get extra channel options
// --------------------------------------------------------------------------------
// aMap = map with channel parameters
// field = optional field to be used for idKey hashing
// Returns map with extra channel options merged
// --------------------------------------------------------------------------------
const __nam_getChExtraOptions = (aMap, field) => {
	if (aMap.type == "elasticsearch") {
		aMap.options = _$(aMap.options).isMap().default({})
		aMap.options.idKey = "id"
		aMap.options.size = 10000
		if (isDef(field)) aMap.options.fnId = k => { return sha256(k[field]) }
	}
	return aMap
}

// Extracts the last {...} JSON-looking fragment out of an audited request URI
// and returns it re-stringified without quotes (used to build the "key" field
// referenced by __NAM_LOGAUDIT_TEMPLATE). Precompiled regex, no per-call new RegExp.
// ----------------------------------------
// aURI = the audited request's URI
// Returns the extracted key string, or "" when there's nothing to extract
// ----------------------------------------
const __nam_auditKeyRe = /.+({[^}]+}).*/
const __nam_auditKey = (aURI) => {
	if (!isString(aURI) || aURI.indexOf("{") < 0) return ""
	return stringify(jsonParse(aURI.replace(__nam_auditKeyRe, "$1").replace(/&quot;/g, "\'")), undefined, "").replace(/\"/g, "")
}

// Shared SLOWDOWN backpressure helper (used by the time-based, chSubscribe and
// cron-based scheduled-thread bodies in execPlugs). Skips the sleep when the
// plug's own average exec time is already under __NAM_SLOWDOWN_TIME -- delaying
// a fast plug doesn't relieve pressure, the thread just sleeps inside the pool,
// still occupying it. Caps the sleep at 5s so a large backlog can't stall a
// worker indefinitely.
// ----------------------------------------
// etry       = the plug entry (nPlug instance) about to execute
// aChPS      = the "process status" channel name (parent.chPS)
// __cpucores = worker/core count computed once per execPlugs call
// ----------------------------------------
const __nam_slowdown = (etry, aChPS, __cpucores) => {
	if (!__NAM_SLOWDOWN) return
	if (etry.avgExecTimeInMs.get() < __NAM_SLOWDOWN_TIME) return
	var _cd = $ch(aChPS).size() - __cpucores
	if (_cd > 1) {
		var _w = Math.min(_cd * __NAM_SLOWDOWN_TIME, 5000)
		if (__NAM_SLOWDOWN_WARNS) logWarn(etry.getName() + " | Slowing down in " + _w + "ms")
		sleep(_w, true)
	}
}

// Shared killAfterMinutes execution wrapper used by all plug trigger paths in
// execPlugs (time-based, channel-subscriber and cron). This keeps timeout
// semantics consistent while removing duplicated $tb().stopWhen(...) blocks.
// ----------------------------------------
// etry   = plug entry (nPlug)
// chpsi  = start date of current execution
// aExec  = function to execute the plug body and return its result
// Returns plug result (or undefined when interrupted by timeout guard)
// ----------------------------------------
const __nam_execWithKillAfter = (etry, chpsi, aExec) => {
	if (!(isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes))) return aExec()

	var _res
	$tb()
	.stopWhen(() => {
		sleep(500, true)
		if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
			logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)")
			if (isDef(global.nattrmon) && isFunction(global.nattrmon.recordWatchdogEvent)) {
				global.nattrmon.recordWatchdogEvent("plug-timeout", {
					plugName: etry.getName(),
					plugCategory: etry.getCategory(),
					plugType: etry.type,
					elapsedMinutes: ow.format.dateDiff.inMinutes(chpsi),
					killAfterMinutes: etry.killAfterMinutes
				})
			}
			return true
		} else {
			return false
		}
	})
	.exec(() => { _res = aExec(); return true })

	return _res
}

// Build a single execution-context object shared by all plug trigger paths.
// ----------------------------------------
// aUUID      = session uuid used by the running plug
// aSource    = trigger source: time | cron | subscribe
// aEvent     = optional channel event payload for subscribers
// aStartedAt = optional execution start date
// ----------------------------------------
const __nam_buildExecContext = (aUUID, aSource, aEvent, aStartedAt) => {
	return {
		uuid: aUUID,
		sourceType: aSource,
		chEvent: _$(aEvent).default(__),
		startedAt: _$(aStartedAt).default(new Date())
	}
}

// Shared guard + backpressure + stale cleanup preparation for trigger execution.
// Returns true when execution should proceed and false when it should be skipped.
const __nam_preparePlugExec = (parent, etry, execCtx, __cpucores) => {
	if (etry.waitForFinish) {
		var _running = $from($ch(parent.chPS).getAll())
			.equals("name", etry.getName())
			.equals("type", etry.type)
			.equals("uuid", execCtx.uuid)

		if (execCtx.sourceType == "subscribe" && isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
			_running = _running.where(r => ow.format.dateDiff.inMinutes(r.start) <= etry.killAfterMinutes)
		}

		if (_running.any()) {
			if (execCtx.sourceType == "cron") {
				parent.debug("Already executing '" + etry.getName() + "' (" + execCtx.uuid +")")
			}
			return false
		}
	} else {
		__nam_slowdown(etry, parent.chPS, __cpucores)
	}

	if (execCtx.sourceType == "subscribe" && isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
		var _stale = $from($ch(parent.chPS).getAll())
			.equals("name", etry.getName())
			.equals("type", etry.type)
			.where(r => ow.format.dateDiff.inMinutes(r.start) > etry.killAfterMinutes)
		$ch(parent.chPS).unsetAll(["name", "uuid", "start"], _stale.select(r => {
			parent.debug("Old subscriber for '" + r.name + "' (uuid " + r.uuid + ") clean up...")
			return r
		}))
	}

	return true
}

// Execute a plug through the unified runtime flow, regardless of trigger source.
// Handles prepare/guard, timeout wrapper, addValues commit, stats and cleanup.
const __nam_execPlug = (parent, etry, execCtx, __cpucores) => {
	try {
		if (!__nam_preparePlugExec(parent, etry, execCtx, __cpucores)) return true

		$ch(parent.chPS).set(
			{ name: etry.getName(), uuid: execCtx.uuid, start: execCtx.startedAt },
			{ name: etry.getName(), type: etry.type, uuid: execCtx.uuid, start: execCtx.startedAt }
		)

		var res
		if (execCtx.sourceType == "subscribe") {
			var ev = _$(execCtx.chEvent).isMap().default({})
			parent.debug("Subscriber " + ev.ch + " on '" + etry.getName() + "' (uuid " + execCtx.uuid + ") ")

			var _execSub = (aArgs) => __nam_execWithKillAfter(etry, execCtx.startedAt, () => etry.exec(parent, aArgs))
			if (etry.chHandleSetAll && ev.op == "setall" && isArray(ev.v)) {
				res = []
				for (var ii in ev.v) {
					var _r = _execSub({ ch: ev.ch, op: "set", k: ow.obj.filterKeys(ev.k, ev.v[ii]), v: ev.v[ii] })
					if (isArray(_r)) {
						res = res.concat(_r)
					} else {
						if (isObject(_r)) res.push(_r)
					}
				}
			} else {
				res = _execSub({ ch: ev.ch, op: ev.op, k: ev.k, v: ev.v })
			}
		} else {
			res = __nam_execWithKillAfter(etry, execCtx.startedAt, () => etry.exec(parent))
		}

		parent.addValues(etry.onlyOnEvent, res, {
			aStamp: etry.getStamp(),
			toArray: etry.getToArray(),
			mergeKeys: etry.getMerge(),
			sortKeys: etry.getSort()
		})

		if (isDef(parent.threadsSessions[execCtx.uuid])) {
			parent.threadsSessions[execCtx.uuid].count = now()
		}
		etry.touch()
	} catch(e) {
		logErr(etry.getName() + " | " + __nam_err(e, false, true))
	} finally {
		$ch(parent.chPS).unset({ name: etry.getName(), uuid: execCtx.uuid, start: execCtx.startedAt })
		var _m = {
			trigger: execCtx.sourceType,
			plugName: etry.getName(),
			plugType: etry.type,
			uuid: execCtx.uuid
		}
		if (execCtx.sourceType == "subscribe" && isMap(execCtx.chEvent)) {
			_m.operation = execCtx.chEvent.op
		}
		parent.publishRuntimeMetrics("plug", _m)
	}

	return true
}

/**
 * <odoc>
 * <key>__nam_err(exception, rethrow, returnStr, code)</key>
 * Prints the exception stack trace and the code where it was thrown. If rethrow is true it will throw the exception again. If returnStr is true it will return the string instead of printing it.
 * </odoc>
 */
const __nam_err = function(exception, rethrow, returnStr, code) {
	const _ac = (aCode, aStr) => {
		if (__NAM_JSONLOG) {
			return aStr
		} else {
			return ansiColor(aCode, aStr)
		}
	}

	// Cache the file name and line number, providing sensible defaults.
	var file = exception.fileName || ""
	var lineNum = parseInt(exception.lineNumber, 10)
	var str = [ _ac("UNDERLINE,BOLD", `${exception.name} @${file}:${exception.lineNumber}`) ]

	if (exception.message !== undefined) {
		str.push(["\n", _ac("", exception.message)].join(""))
	}

	// If we need to print the error stack, cache the split stack lines.
	let stackLines
	if (__NAM_ERRSTACK && exception.stack !== undefined) {
		stackLines = exception.stack.split("\n")
		// Color the entire stack at once.
		let coloredStack = stackLines.map(line => _ac("FAINT,ITALIC", line)).join("\n")
		str.push(["\n", coloredStack].join(""))
	}

	if (!returnStr) {
		printnl(ow.loadFormat().withSideLine(str.join(""), __, "red"))
		str = []
	}

	if (__NAM_ERRSTACK) {
		// If no file name exists, try to extract it from the cached stack lines
		if (!file && stackLines && stackLines.length > 0) {
			var matchLine = stackLines.find(r => /at [^:]+:/.test(r))
			if (matchLine) {
				file = matchLine.trim().split(" ")[1].split(":")[0]
			}
		}
		// Avoid reading file more than once by checking the cached file variable.
		if (file.endsWith("_js")) file = NATTRMON_HOME + "/" + file.replace(/_js$/, ".js")
		if (file && io.fileExists(file)) {
			code = io.readFileString(file)
		}

		// If lineNum = 0 try to extract it from the cached stack lines
		if (code !== undefined && lineNum === 0 && stackLines && stackLines.length > 0) {
			if (stackLines[0].indexOf(":") > 0) {
				var ar = stackLines[0].match(/at [^:]+:(\d+)/);
				lineNum = parseInt(ar[1], 10)
			}
		} 

		if (code !== undefined && !isNaN(lineNum) && isFinite(lineNum)) {
			var lcode = code.split(/[\r\n]/)
			var start = Math.max(0, lineNum - 3)
			var end = Math.min(lcode.length, lineNum + 3)
			str.push(_ac("FAINT", "   v\n"))
			var numWidth = Math.max(String(start).length, String(end).length)
			var lnFormat = "%" + numWidth + "d"

			for (var i = start; i < end; i++) {
				var lineStr = $ft(lnFormat, i + 1) + ": " + lcode[i]
				if (i === lineNum - 1) {
					str.push([_ac("RED,BOLD,UNDERLINE", ["> ", lineStr].join("")), "\n"].join(""))
				} else {
					str.push(["  ", _ac("RED,FAINT", lineStr), "\n"].join(""))
				}
			}
		}
		if (isJavaException(exception)) {
			str.push("\n")
			var jStack = getJavaStackTrace(exception)
				.map(r => _ac("FAINT,ITALIC", `  at ${r.className}.${r.methodName}(${r.fileName}:${r.lineNumber})`))
				.join("\n")
			str.push(["\n", jStack].join(""))
		}
	}
	
	str = str.join("")
	if (returnStr) {
		return str
	} else {
		print(str)
	}
	
	if (rethrow) throw exception
}

// nAttrMon main class
// ----------------------------------------------------------------------------------
// aConfigPath = path to configuration files
// debugFlag  = debug flag
// ----------------------------------------------------------------------------------
var nAttrMon = function(aConfigPath, debugFlag) {
	plugin("Threads")

	if (debugFlag && isDef(ow.loadDebug)) {
		ow.loadDebug()
		ow.debug.register()
	}

	// Log current info
	(function() {
		var p = $from(getOPackLocalDB()).equals("name", "nAttrMon")
		var t = templify("OpenAF version: {{oafVersion}} ({{oafDistribution}}) | nAttrMon version: {{namVersion}} | Java version: {{javaVersion}}", {
			oafVersion: getVersion(),
			oafDistribution: getDistribution(),
			namVersion: (p.any() ? p.at(0).version : "n/a"),
			javaVersion: ow.format.getJavaVersion()
		})
		print(t + "\n" + repeat(t.length, "-"))

		print("Applying parameters:")
		$from(af.fromJavaArray( af.getScopeIds() ))
		.starts("__NAM_")
		.notStarts("__NAM_SEC")
		.sort()
		.select(r => { 
			print(r + ": " + (isFunction(global[r]) ? "(function)" : global[r]))
		})

		print(repeat(t.length, "-"))
	})()

	// If __NAM_LIBS is provided as a comma-delimited list of OpenAF libraries then try to load them
	if (isString(__NAM_LIBS)) {
		// Load external libs
		__NAM_LIBS.split(",").forEach(lib => {
			try {
				// Ensure the lib name is trimmed
				var _lib = lib.trim()
				log(`Loading external lib '${_lib}'...`)
				// Load the lib
				loadLib(_lib)
			} catch(e) {
				// Log the error and continue
				logErr(`Problem loading external lib '${_lib}': ` + __nam_err(e, false, true))
			}
		})
	}

	// Channels
	this.chCurrentValues = "nattrmon::cvals"
	this.chLastValues    = "nattrmon::lvals"
	this.chNotifications = "nattrmon::wnotf"
	this.chWarnings      = "nattrmon::warnings"
 	this.chPS            = "nattrmon::ps"

	// Create channels

	// Current values channel
	if (isDef(__NAM_CHANNEL_CVALS)) {
		var o = jsonParse(__NAM_CHANNEL_CVALS, true)
		if (!isMap(o)) logWarn("Couldn't parse __NAM_CHANNEL_CVALS to a map")
		o.options = __nam_getSec(o.options)
		o = __nam_getChExtraOptions(o, "name")
		$ch(this.chCurrentValues).create(1, o.type, o.options)
	} else {
		$ch(this.chCurrentValues).create(1, "simple")
	}

	// Last values channel
	if (isDef(__NAM_CHANNEL_LVALS)) {
		var o = jsonParse(__NAM_CHANNEL_LVALS, true)
		if (!isMap(o)) logWarn("Couldn't parse __NAM_CHANNEL_LVALS to a map")
		o.options = __nam_getSec(o.options)
		o = __nam_getChExtraOptions(o, "name")
		$ch(this.chLastValues).create(1, o.type, o.options)
	} else {
		$ch(this.chLastValues).create(1, "simple")
	}

	// Warnings channel
	if (isDef(__NAM_CHANNEL_LOGS)) {
		var o = jsonParse(__NAM_CHANNEL_LOGS, true)
		if (!isMap(o)) logWarn("Couldn't parse __NAM_CHANNEL_LOGS to a map")
		o.options = __nam_getSec(o.options)
		o = __nam_getChExtraOptions(o)
		$ch("__es").create(1, o.type, o.options)
		startLog("__es")
		
		o.options.host = _$(o.options.host, "options.host").isString().default("nattrmon")

		global.__esSubs = ow.ch.utils.getLogStashSubscriber("__es", "stdin", o.options.host, e => {
			sprintErr(e)
		}, __, o.options.stamp)
		$ch("__log").subscribe(global.__esSubs)
		addOnOpenAFShutdown(() => ($ch().list().indexOf("__log") ? $ch("__log").waitForJobs(2500) : __))

		// Log current info
		var p = $from(getOPackLocalDB()).equals("name", "nAttrMon")
		var t = templify("OpenAF version: {{oafVersion}} ({{oafDistribution}}) | nAttrMon version: {{namVersion}} | Java version: {{javaVersion}}", {
			oafVersion: getVersion(),
			oafDistribution: getDistribution(),
			namVersion: (p.any() ? p.at(0).version : "n/a"),
			javaVersion: ow.format.getJavaVersion()
		})
		log(t, { off: true, async: false })

		$from(af.fromJavaArray( af.getScopeIds() ))
		.starts("__NAM_")
		.notStarts("__NAM_SEC")
		.sort()
		.select(r => { 
			if (!isObject(global[r])) log("Parameter " + r + ": " + global[r], { off: true, async: false })
		})
	}
	
	$ch(this.chPS).create(1, "simple")

	// Buffer cvals
	if (__NAM_BUFFERCHANNELS) {
		$ch(this.chCurrentValues).subscribe(ow.ch.utils.getBufferSubscriber(this.chCurrentValues, [ "name" ], __NAM_BUFFERBYNUMBER, __NAM_BUFFERBYTIME), true);
	}

	this.currentValues    = $ch(this.chCurrentValues)
	this.lastValues       = $ch(this.chLastValues)

	this.configPath          = (isUnDef(aConfigPath)) ? "." : aConfigPath
	this.listOfAttributes    = new nAttributes()
	this.listOfWarnings      = new nWarnings()
	this.count               = now()
	this.countCheck          = 30000 // shouldn't be very aggresive
	this.debugFlag           = (isUnDef(debugFlag)) ? false : debugFlag

	this.plugs = {}

	this.PLUGINPUTS      = "inputs"
	this.PLUGOUTPUTS     = "outputs"
	this.PLUGVALIDATIONS = "validations"
	this.PLUGSYSTEM      = "system"

	this.threads = []
	this.threadsSessions = {}
	this.sessionData = {}
	this.monitoredObjects = {}
	this.objPools = {}
	this.objPoolsCat = {}
	this.objPoolsAssociations = {}
	this.indexPlugThread = {}
	this.sch = new ow.server.scheduler() // schedule plugs thread pool
	this.schList = {} // schedule plugs list
	this.ignoreList = []
	this.__preflightMode = false
	this.__preflightIssues = []
	this.alive = false
	this.runtimeMetricsEnabled = toBoolean(__NAM_RUNTIME_METRICS)
	this.runtimeMetricsPeriod = isNumber(__NAM_RUNTIME_METRICS_PERIOD) ? __NAM_RUNTIME_METRICS_PERIOD : 5000
	this.runtimeOwMetricsEnabled = toBoolean(__NAM_RUNTIME_OWMETRICS)
	this.chRuntimeMetrics = _$(__NAM_RUNTIME_METRICS_CH).isString().default("nattrmon::runtime::metrics")
	this.chRuntimeEvents = _$(__NAM_RUNTIME_EVENTS_CH).isString().default("nattrmon::runtime::events")

	plugin("Threads")
	this.thread = new Threads()
	this.thread.initScheduledThreadPool(__NAM_WORKERS)
	this.threads.push(this.thread)
	if (this.runtimeMetricsEnabled) {
		try { $ch(this.chRuntimeMetrics).create(1, "simple") } catch(e) {}
		try { $ch(this.chRuntimeEvents).create(1, "simple") } catch(e) {}
	}
	if (this.runtimeOwMetricsEnabled) this.initRuntimeMetricsCollector()

	var nattrmon = this

	// Start logging
	if (!__NAM_LOGCONSOLE) {
		io.mkdir(aConfigPath + "/log")
		ow.ch.utils.setLogToFile({
			logFolder: aConfigPath + "/log",
			HKhowLongAgoInMinutes: __NAM_LOGHK_HOWLONGAGOINMINUTES,
			numberOfEntriesToKeep: 10,
			setLogOff            : true
		})
	}

	// Audit log
	if (__NAM_LOGAUDIT) {
		var __nam_auditTemplateFn = ow.template.getTemplate(__NAM_LOGAUDIT_TEMPLATE)
		var __nam_auditTemplateHasKey = String(__NAM_LOGAUDIT_TEMPLATE).indexOf("key") >= 0
		ow.ch.server.setLog(function(aMap) {
			if (__nam_auditTemplateHasKey) aMap.key = __nam_auditKey(isDef(aMap.request) ? aMap.request.uri : __)
			log(__nam_auditTemplateFn(aMap))
		})
	}

	// JSON log
	if (__NAM_JSONLOG) {
		setLog({ format: "json" })
	}

	if (!__NAM_LOGCONSOLE) print(new Date() + " | Starting log to " + aConfigPath + "/log")
	if (this.runtimeMetricsEnabled) this.publishRuntimeMetrics("init")

	// date checks
	this.currentValues.subscribe((new nAttributeValue()).convertDates, true)
	this.lastValues.subscribe((new nAttributeValue()).convertDates, true)
	this.listOfAttributes.getCh().subscribe((new nAttribute()).convertDates, true)
    this.listOfWarnings.getCh().subscribe((new nWarning()).convertDates, true)
   
	// persistence
	if (toBoolean(__NAM_NEED_CH_PERSISTENCE)) {
		this.listOfWarnings.getCh().storeAdd(this.getSnapshotPath() + "/nattrmon.warns.snapshot", [ "title" ], true)
		this.listOfAttributes.getCh().storeAdd(this.getSnapshotPath() + "/nattrmon.attrs.snapshot", [ "name" ], true)
		this.lastValues.storeAdd(this.getSnapshotPath() + "/nattrmon.lvals.snapshot", [ "name" ], true)
		this.currentValues.storeAdd(this.getSnapshotPath() + "/nattrmon.cvals.snapshot", [ "name" ], true)
	}
}

// Build a runtime metrics snapshot for channels/session/OpenMetrics exporting
// ----------------------------------------
// Returns map with plugs, scheduler/thread, channels and watchdog summaries
// ----------------------------------------
nAttrMon.prototype.getRuntimeMetricsSnapshot = function() {
	var _now = now()
	var _ps = []
	try { _ps = $ch(this.chPS).getAll() } catch(e) { _ps = [] }

	var _sizes = {
		currentValues: (function(p) { try { return $ch(p.chCurrentValues).size() } catch(e) { return -1 } })(this),
		lastValues: (function(p) { try { return $ch(p.chLastValues).size() } catch(e) { return -1 } })(this),
		warnings: (function() { try { return $ch("nattrmon::warnings").size() } catch(e) { return -1 } })(),
		notifications: (function() { try { return $ch("nattrmon::wnotf").size() } catch(e) { return -1 } })(),
		processStatus: (function(p) { try { return $ch(p.chPS).size() } catch(e) { return -1 } })(this),
		plugs: (function() { try { return $ch("nattrmon::plugs").size() } catch(e) { return -1 } })(),
		attributes: (function() { try { return $ch("nattrmon::attributes").size() } catch(e) { return -1 } })()
	}

	var _threads = []
	var _totTimed = 0, _totCron = 0, _totSub = 0, _stale = 0
	for (var uuid in this.threadsSessions) {
		var _ts = this.threadsSessions[uuid]
		if (isUnDef(_ts) || isUnDef(_ts.entry)) continue
		var _e = _ts.entry
		var _elapsed = _now - _ts.count
		var _threshold = (isDef(_e.getCron()) || _e.aTime <= 0) ? -1 : (_e.aTime * __NAM_MAIN_WATCHDOG_STUCKFACTOR)
		var _isStale = (_threshold > 0 && _elapsed >= _threshold)
		if (_isStale) _stale++
		if (isDef(_e.getCron())) _totCron++
		if (isDef(_e.chSubscribe)) _totSub++
		if (!isDef(_e.getCron()) && _e.aTime > 0) _totTimed++

		var _running = $from(_ps).equals("uuid", uuid).count()
		_threads.push({
			uuid: uuid,
			name: _e.getName(),
			type: _e.type,
			elapsedMs: _elapsed,
			thresholdMs: _threshold,
			stale: _isStale,
			running: _running,
			waitForFinish: _e.waitForFinish,
			timeInterval: _e.aTime,
			hasCron: isDef(_e.getCron()),
			hasSubscription: isDef(_e.chSubscribe)
		})
	}

	var _plugRows = []
	var _totPlugs = 0, _totExec = 0, _totErr = 0, _totRunning = 0
	var _totLatencyWeighted = 0
	for (var _ptype in this.plugs) {
		for (var _pi in this.plugs[_ptype]) {
			var _p = this.plugs[_ptype][_pi]
			if (isUnDef(_p)) continue
			var _execs = (isDef(_p.numberOfExecs) && isDef(_p.numberOfExecs.get)) ? _p.numberOfExecs.get() : _p.numberOfExecs
			var _errs = (isDef(_p.numberOfExecsInError) && isDef(_p.numberOfExecsInError.get)) ? _p.numberOfExecsInError.get() : _p.numberOfExecsInError
			var _running = (isDef(_p.numberOfRunning) && isDef(_p.numberOfRunning.get)) ? _p.numberOfRunning.get() : _p.numberOfRunning
			var _avg = (isDef(_p.avgExecTimeInMs) && isDef(_p.avgExecTimeInMs.get)) ? _p.avgExecTimeInMs.get() : _p.avgExecTimeInMs
			var _last = (isDef(_p.lastExecTimeInMs) && isDef(_p.lastExecTimeInMs.get)) ? _p.lastExecTimeInMs.get() : _p.lastExecTimeInMs

			_totPlugs++
			_totExec += (isNumber(_execs) ? _execs : 0)
			_totErr += (isNumber(_errs) ? _errs : 0)
			_totRunning += (isNumber(_running) ? _running : 0)
			if (isNumber(_avg) && isNumber(_execs) && _execs > 0) _totLatencyWeighted += (_avg * _execs)

			_plugRows.push({
				name: _p.getName(),
				category: _p.getCategory(),
				type: _p.type,
				numberOfExecs: _execs,
				numberOfExecsInError: _errs,
				numberOfRunning: _running,
				avgExecTimeInMs: _avg,
				lastExecTimeInMs: _last,
				errorRate: (isNumber(_execs) && _execs > 0) ? (_errs / _execs) : 0
			})
		}
	}

	var _watchdog = clone(this.getSessionData("watchdog.stats"))
	if (!isMap(_watchdog)) _watchdog = {}
	var _timeoutsByPlug = clone(this.getSessionData("runtime.timeoutHitsByPlug"))
	if (!isMap(_timeoutsByPlug)) _timeoutsByPlug = {}
	var _watchdogByPlug = clone(this.getSessionData("runtime.watchdogHitsByPlug"))
	if (!isMap(_watchdogByPlug)) _watchdogByPlug = {}

	return {
		ts: _now,
		channels: _sizes,
		scheduler: {
			workers: __NAM_WORKERS,
			threadsTotal: _threads.length,
			timedThreads: _totTimed,
			cronThreads: _totCron,
			subscribedThreads: _totSub,
			staleThreads: _stale,
			threads: _threads
		},
		plugs: {
			total: _totPlugs,
			running: _totRunning,
			totalExecutions: _totExec,
			totalErrors: _totErr,
			avgExecTimeInMs: (_totExec > 0 ? Math.round(_totLatencyWeighted / _totExec) : 0),
			rows: _plugRows
		},
		watchdog: _watchdog,
		restart: {
			count: isNumber(_watchdog.restarts) ? _watchdog.restarts : 0,
			lastReason: _$( _watchdog.lastRestartReason ).default(""),
			lastAt: _$( _watchdog.lastRestartAt ).default(__)
		},
		hits: {
			timeoutsByPlug: _timeoutsByPlug,
			watchdogByPlug: _watchdogByPlug
		}
	}
}

// Returns a list of degraded plugs according to runtime thresholds
// ----------------------------------------
// aOptions  = optional thresholds override
// aSnapshot = optional runtime snapshot to avoid recomputation
// Returns { generatedAt, thresholds, total, degraded[] }
// ----------------------------------------
nAttrMon.prototype.getDegradedPlugs = function(aOptions, aSnapshot) {
	aOptions = _$(aOptions).isMap().default({})
	var _snap = isMap(aSnapshot) ? aSnapshot : this.getRuntimeMetricsSnapshot()

	var _thr = {
		errorRateThreshold: _$(aOptions.errorRateThreshold).isNumber().default(__NAM_DEGRADED_ERROR_RATE_THRESHOLD),
		minExecs: _$(aOptions.minExecs).isNumber().default(__NAM_DEGRADED_MIN_EXECS),
		timeoutHits: _$(aOptions.timeoutHits).isNumber().default(__NAM_DEGRADED_TIMEOUT_HITS),
		watchdogHits: _$(aOptions.watchdogHits).isNumber().default(__NAM_DEGRADED_WATCHDOG_HITS)
	}

	var _timeoutsByPlug = isMap(_snap.hits) && isMap(_snap.hits.timeoutsByPlug) ? _snap.hits.timeoutsByPlug : {}
	var _watchdogByPlug = isMap(_snap.hits) && isMap(_snap.hits.watchdogByPlug) ? _snap.hits.watchdogByPlug : {}

	var _degraded = []
	var _rows = (isMap(_snap.plugs) && isArray(_snap.plugs.rows)) ? _snap.plugs.rows : []
	_rows.forEach(r => {
		var _reasons = []
		var _key = r.type + "::" + r.category + "::" + r.name
		var _to = _$( _timeoutsByPlug[_key] ).default(0)
		var _wd = _$( _watchdogByPlug[_key] ).default(_$( _watchdogByPlug[r.name] ).default(0))

		if (isNumber(r.numberOfExecs) && r.numberOfExecs >= _thr.minExecs && isNumber(r.errorRate) && r.errorRate >= _thr.errorRateThreshold) {
			_reasons.push({ rule: "errorRate", value: r.errorRate, threshold: _thr.errorRateThreshold })
		}
		if (isNumber(_to) && _to >= _thr.timeoutHits) {
			_reasons.push({ rule: "timeoutHits", value: _to, threshold: _thr.timeoutHits })
		}
		if (isNumber(_wd) && _wd >= _thr.watchdogHits) {
			_reasons.push({ rule: "watchdogHits", value: _wd, threshold: _thr.watchdogHits })
		}

		if (_reasons.length > 0) {
			_degraded.push({
				key: _key,
				name: r.name,
				category: r.category,
				type: r.type,
				numberOfExecs: r.numberOfExecs,
				numberOfExecsInError: r.numberOfExecsInError,
				errorRate: r.errorRate,
				avgExecTimeInMs: r.avgExecTimeInMs,
				lastExecTimeInMs: r.lastExecTimeInMs,
				timeoutHits: _to,
				watchdogHits: _wd,
				reasons: _reasons
			})
		}
	})

	return {
		generatedAt: now(),
		thresholds: _thr,
		total: _degraded.length,
		degraded: _degraded
	}
}

// Publish current runtime metrics snapshot to session/channel
// ----------------------------------------
// aSource = snapshot source marker
// aExtra  = optional extra event/context map merged into snapshot.event
// ----------------------------------------
nAttrMon.prototype.publishRuntimeMetrics = function(aSource, aExtra) {
	if (!this.runtimeMetricsEnabled) return

	var _snap = this.getRuntimeMetricsSnapshot()
	var _diag = this.getDegradedPlugs({}, _snap)
	var _evt = merge({ source: _$(aSource).isString().default("runtime"), ts: now() }, _$(aExtra).isMap().default({}))
	_snap.event = _evt
	_snap.diagnostics = {
		degradedTotal: _diag.total,
		thresholds: _diag.thresholds
	}

	this.setSessionData("runtime.metrics", _snap)
	this.setSessionData("runtime.diagnostics", _diag)
	try {
		$ch(this.chRuntimeMetrics).set({ name: "runtime" }, { name: "runtime", date: new Date(), metrics: _snap })
	} catch(e) {}
}

// Record watchdog/runtime events to a dedicated channel and refresh snapshot
// ----------------------------------------
// aType = event type
// aData = optional event payload
// ----------------------------------------
nAttrMon.prototype.recordWatchdogEvent = function(aType, aData) {
	if (!this.runtimeMetricsEnabled) return

	var _ev = merge({
		id: genUUID(),
		ts: now(),
		type: _$(aType).isString().default("watchdog")
	}, _$(aData).isMap().default({}))

	if (_ev.type == "plug-timeout") {
		var _tm = clone(this.getSessionData("runtime.timeoutHitsByPlug"))
		if (!isMap(_tm)) _tm = {}
		if (isDef(_ev.plugName) && isDef(_ev.plugCategory) && isDef(_ev.plugType)) {
			var _tk = _ev.plugType + "::" + _ev.plugCategory + "::" + _ev.plugName
			_tm[_tk] = _$( _tm[_tk] ).default(0) + 1
			this.setSessionData("runtime.timeoutHitsByPlug", _tm)
		}
	}

	if (_ev.type == "restart" && _ev.reason == "thread" && isDef(_ev.name)) {
		var _wm = clone(this.getSessionData("runtime.watchdogHitsByPlug"))
		if (!isMap(_wm)) _wm = {}
		var _wk = _ev.name
		if (isDef(_ev.plugType) && isDef(_ev.plugCategory)) _wk = _ev.plugType + "::" + _ev.plugCategory + "::" + _ev.name
		_wm[_wk] = _$( _wm[_wk] ).default(0) + 1
		this.setSessionData("runtime.watchdogHitsByPlug", _wm)
	}

	try {
		$ch(this.chRuntimeEvents).set({ id: _ev.id }, _ev)
		if ($ch(this.chRuntimeEvents).size() > 256) {
			var _old = $from($ch(this.chRuntimeEvents).getAll()).sort("ts").limit($ch(this.chRuntimeEvents).size() - 256).select(r => ({ id: r.id }))
			if (_old.length > 0) $ch(this.chRuntimeEvents).unsetAll(["id"], _old)
		}
	} catch(e) {}

	this.setSessionData("watchdog.lastEvent", _ev)
	this.publishRuntimeMetrics("watchdog", { eventType: _ev.type })
}

// Optionally registers an ow.metrics collector with runtime internals
// ----------------------------------------
// Collector name controlled by __NAM_RUNTIME_OWMETRICS_NAME
// ----------------------------------------
nAttrMon.prototype.initRuntimeMetricsCollector = function() {
	if (!this.runtimeOwMetricsEnabled) return
	if (isUnDef(global.__nam_runtime_metrics_collectors)) global.__nam_runtime_metrics_collectors = {}
	if (isDef(global.__nam_runtime_metrics_collectors[__NAM_RUNTIME_OWMETRICS_NAME])) return

	ow.loadMetrics()
	ow.metrics.add(__NAM_RUNTIME_OWMETRICS_NAME, () => this.getRuntimeMetricsSnapshot())
	global.__nam_runtime_metrics_collectors[__NAM_RUNTIME_OWMETRICS_NAME] = true
}

// nAttrMon main class methods
// ----------------------------

// Get configuration path
// ----------------------------------------
// aPath = optional path to check existence
// Returns configuration path
// ----------------------------------------
nAttrMon.prototype.getConfigPath = function(aPath) {
	if (isUnDef(aPath)) return this.configPath
	var opackPath = (getOPackPath("nAttrMon") || ".") + "/config"
	if (!io.fileExists(this.configPath + "/" + aPath) && io.fileExists(opackPath + "/" + aPath)) return opackPath; else return this.configPath
}

// Get snapshot path
// ----------------------------------------
// Returns snapshot path
// ----------------------------------------
nAttrMon.prototype.getSnapshotPath = function() {
	return (isUnDef(__NAM_CH_PERSISTENCE_PATH) ? this.getConfigPath() : __NAM_CH_PERSISTENCE_PATH)
}

// Shutdown nAttrMon
// ----------------------------------------
// aCode = exit code
// ----------------------------------------
nAttrMon.prototype.shutdown = function(aCode) {
	aCode = _$(aCode, "aCode").isNumber().default(0)

	log("Shutting down... (exit code = " + aCode + ")")
	nattrmon.stop()
	exit(aCode)
}

// Snapshot functions
// ------------------

// Generate snapshot
// ----------------------------------------
/*nAttrMon.prototype.genSnapshot = function() {
	// Async write
	$doV(() => {
		var mainpath = this.getConfigPath()
		var snapshot = {
			currentValues: ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true),
			lastValues: ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true),
			listOfAttributes: this.listOfAttributes.getAttributes(true),
			listOfWarnings: this.listOfWarnings.getWarnings(true)
		}
		io.writeFileBytes(mainpath + "/nattrmon.snapshot", compress(snapshot))
	})
}*/

// Session function
// ----------------

// Sets session data
// ----------------------------------------
// aKey    = key to store object
// aObject = object to store
// ----------------------------------------
nAttrMon.prototype.setSessionData = function(aKey, aObject) {
	this.sessionData[aKey] = aObject
}

// Gets session data
// ----------------------------------------
// aKey    = key to retrieve object
// Returns stored object
// ----------------------------------------
nAttrMon.prototype.getSessionData = function(aKey) {
	return this.sessionData[aKey]
}

// Deletes session data
// ----------------------------------------
// aKey    = key to delete
// ----------------------------------------
nAttrMon.prototype.delSessionData = function(aKey) {
	delete this.sessionData[aKey]
}

// Checks if session data exists
// ----------------------------------------
// aKey    = key to check existence
// Returns true/false
// ----------------------------------------
nAttrMon.prototype.hasSessionData = function(aKey) {
	if(isUnDef(this.getSessionData(aKey))) {
		return false
	} else {
		return true
	}
}

// Debug functions
// ---------------

// Sets debug flag
// ----------------------------------------
// aDebugFlag = debug flag
// ----------------------------------------
nAttrMon.prototype.setDebug = function(aDebugFlag) {
	this.debugFlag = aDebugFlag
}

// Monitored objects
// -----------------

// Adds monitored object
// ----------------------------------------
// aKey    = key to store object
// anObject = object to store
// Returns stored object
// ----------------------------------------
nAttrMon.prototype.addMonitoredObject = function(aKey, anObject) {
	this.monitoredObjects[aKey] = new nMonitoredObject(aKey, anObject)
	return this.getMonitoredObject(aKey)
}

// Gets monitored object
// ----------------------------------------
// aKey    = key to retrieve object
// Returns stored object
// ----------------------------------------
nAttrMon.prototype.getMonitoredObject = function(aKey) {
  	if (this.hasMonitoredObject(aKey))
		return this.monitoredObjects[aKey].getObject()
}

// Checks if monitored object exists
// ----------------------------------------
// aKey    = key to check existence
// Returns true/false
// ----------------------------------------
nAttrMon.prototype.hasMonitoredObject = function(aKey) {
	if(isUnDef(this.monitoredObjects[aKey])) {
		return false
	} else {
		return true
	}
}

// Tests all monitored objects
// ----------------------------------------
nAttrMon.prototype.monitoredObjectsTest = function() {
	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].test()
	}
}

// Declares monitored object as dirty
// ----------------------------------------
// aKey    = key to declare dirty
// ----------------------------------------
nAttrMon.prototype.declareMonitoredObjectDirty = function(aKey) {
	this.monitoredObjects[aKey].setDirty()
	this.monitoredObjects[aKey].test()
}

// Object pools
// ------------

/**
 * <odoc>
 * <key>nattrmon.isObjectPool(aKey) : boolean</key>
 * Determines if there is an ObjectPool for the provided aKey. Returns true or false.
 * </odoc>
 */
nAttrMon.prototype.isObjectPool = function(aKey) {
	if (isDef(this.objPools[aKey]))
		return true
	else
		return false
}

/**
 * <odoc>
 * <key>nattrmon.addObjectPool(aKey, aOWObjPool, aCat, aLifeCycle)</key>
 * Given a aOWObjPool (created, but not started, from ow.obj.pool) starts it and adds it to nattrmon
 * with the provided aKey. Later objects can be requested and returned using nattrmon.leaseObject and
 * nattrmon.returnObject. Optionally you can provide a aCat category and/or aLifeCycle map (limit, fn and last).
 * </odoc>
 */
nAttrMon.prototype.addObjectPool = function(aKey, aOWObjPool, aCat, aLifeCycle) {
	this.objPools[aKey] = aOWObjPool.start()
	this.objPoolsCat[aKey] = aCat
	this.objPoolsAssociations[aKey] = {}
	return this
}

/**
 * <odoc>
 * <key>nattrmon.getObjectPool(aKey) : Object</key>
 * Returns the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.getObjectPool = function(aKey) {
	return this.objPools[aKey]
}

/**
 * <odoc>
 * <key>nattrmon.delObjectPool(aKey) : nattrmon</key>
 * Deletes the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.delObjectPool = function(aKey) {
    this.objPools[aKey].stop()
	//deleteFromArray(this.objPools, this.objPools.indexOf(aKey));
	delete this.objPools[aKey]
	delete this.objPoolsCat[aKey]
	delete this.objPoolsAssociations[aKey]

	return this
}

/**
 * <odoc>
 * <key>nattrmon.getObjectPoolKeys(aKey, aCategory) : Array</key>
 * Retrieves the current list of object pool keys. Optionally you can filter by a specific aCategory provided
 * on addObjectPool.
 * </odoc>
 */
nAttrMon.prototype.getObjectPoolKeys = function(aCat) {
	var res = []
	if (isUnDef(aCat))
		return Object.keys(this.objPools)
	else {
		var ori = Object.keys(this.objPools)
		for(var i in ori) {
			if (this.objPoolsCat[ori[i]] == aCat) {
				res.push(ori[i])
			}
		}
	}

	return res
}

/**
 * <odoc>
 * <key>nattrmon.leaseObject(aKey) : Object</key>
 * Ask the object pool associated with aKey for an object instance to be used.
 * </odoc>
 */
nAttrMon.prototype.leaseObject = function(aKey) {
	return this.objPools[aKey].checkOut()
}

/**
 * <odoc>
 * <key>nattrmon.returnObject(aKey, anObj, aStatus)</key>
 * Returns an object that was previsouly leased using nattrmon.leaseObject for the object pool associated with aKey
 * providing aStatus (false = obj should be thrown away).
 * </odoc>
 */
nAttrMon.prototype.returnObject = function(aKey, anObj, aStatus) {
	return this.objPools[aKey].checkIn(anObj, aStatus)
}

/**
 * <odoc>
 * <key>nattrmon.useObject(aKey, aFunction)</key>
 * Given aFunction will pass it, as an argument, an object instance to be used from the object pool associated with aKey.
 * If aFunction throws anException or returns false the provided object instance will be thrown away.
 * </odoc>
 */
nAttrMon.prototype.useObject = function(aKey, aFunction) {
	// Temporary until dependency OpenAF >= 20181210
	if (isUnDef(this.objPools[aKey])) {
		logWarn("Object pool '" + aKey + "' doesn't exist.")
		return false
	} else {
		return this.objPools[aKey].use(function(v) {
			var res = aFunction(v)
			if (isDef(res)) return res; else return true
		})
	}
}

/**
 * <odoc>
 * <key>nattrmon.associateObjectPool(aParentKey, aChildKey, aPathAssociation)</key>
 * Associates aChildKey to aParentKey for aPathAssociation. For example:\
 * \
 * nattrmon.associateObjectPool("FMS", "FMSAPP", "db.app");\
 * \
 * This will associate the db object pool FMSAPP to the af object pool FMS. Specifically for "db.app".\
 * \
 * </odoc>
 */
nAttrMon.prototype.associateObjectPool = function(aParentKey, aChildKey, aPath) {
	this.objPoolsAssociations[aParentKey][aPath] = aChildKey
}

/**
 * <odoc>
 * <key>nattrmon.getAssociatedObjectPool(aParentKey, aPath) : String</key>
 * Returns the associated object pool to aParentKey given aPath. Example:\
 * \
 * var dbPoolName = nattrmon.getAssociatedObjectPool("FMS", "db.app");\
 * \
 * </odoc>
 */
nAttrMon.prototype.getAssociatedObjectPool = function(aParentKey, aPath) {
	return this.objPoolsAssociations[aParentKey][aPath]
}

/**
 * <odoc>
 * <key>nattrmon.deassociateObjectPool(aParentKey, aPath)</key>
 * Deassociates any object pool associated to aParentKey for aPath.
 * </odoc>
 */
nAttrMon.prototype.deassociateObjectPool = function(aParentKey, aPath) {
	delete this.objPoolsAssociations[aParentKey][aPath]
}

/**
 * <odoc>
 * <key>nattrmon.newSSHObjectPool(aSSHURL) : ObjectPool</key>
 * Creates a new ow.obj.pool.SSH based on the provided aSSHURL in the form:
 *  ssh://user:password@host:port/pathToIdentificationKey
 * </odoc>
 */
nAttrMon.prototype.newSSHObjectPool = function(aURL) {
	var uri = new java.net.URI(aURL)

	if (uri.getScheme().toLowerCase() == "ssh") {
		var port = uri.getPort()
		var [user, pass] = String(uri.getUserInfo()).split(/:/)
		var path = uri.getPath()
		return ow.obj.pool.SSH(String(uri.getHost()), (Number(port) > 0) ? port : 22, user, pass, (String(path).length > 0) ? String(path) : __, true)
	}
}

// System functions
// ----------------

// Debug function
// ----------------------------------------
// aMessage = debug message
// ----------------------------------------
nAttrMon.prototype.debug = function(aMessage) {
	if(this.debugFlag) {
		ansiStart()
		log(ansiColor("BG_YELLOW,BLACK", "DEBUG | " + aMessage))
		ansiStop()
	}
}

// Start nAttrMon
// ----------------------------------------
nAttrMon.prototype.start = function() {
	this.debug("nAttrMon monitor plug")

	// Add system monitor plug
	this.addPlug(this.PLUGSYSTEM,
		         {"name": "system monitor", "timeInterval": this.countCheck, "waitForFinish": false, "onlyOnEvent": false}, 
		         new nValidation(function() {
		         	nattrmon.count = now()
		         	//nattrmon.genSnapshot();
		         }),
		         {})
	this.execPlugs(this.PLUGSYSTEM)
	this.debug("nAttrMon start load plugs")
	this.loadPlugs()

	// Execute plugs based on order
	var loadOrder = __NAM_PLUGSORDER.split(",")
	var loadedInputs = false, loadedOutputs = false, loadedValidations = false
	loadOrder.forEach(item => {
		switch(item.toLowerCase().trim()) {
		case "inputs":
			this.debug("nAttrMon exec input plugs")
			this.execPlugs(this.PLUGINPUTS)
			loadedInputs = true	
			break
		case "outputs":
			this.debug("nAttrMon exec output plugs")
			this.execPlugs(this.PLUGOUTPUTS)	
			loadedOutputs = true
			break
		case "validations":
			this.debug("nAttrMon exec validation plugs")
			this.execPlugs(this.PLUGVALIDATIONS)
			loadedValidations = true
			break
		default:
			logWarn("PLUGSORDER value '" + item + "' not recognized. Should be either inputs, outputs or validations.")
		}
	})

	if (!loadedInputs) logWarn("nAttrmon exec input plugs not executed due to PLUGSORDER = '" + __NAM_PLUGSORDER + "'")
	if (!loadedOutputs) logWarn("nAttrmon exec output plugs not executed due to PLUGSORDER = '" + __NAM_PLUGSORDER + "'")
	if (!loadedValidations) logWarn("nAttrmon exec validations plugs not executed due to PLUGSORDER = '" + __NAM_PLUGSORDER + "'")

	this.debug("nAttrMon restoring snapshot")
	this.alive = true

	if (this.runtimeMetricsEnabled && isNumber(this.runtimeMetricsPeriod) && this.runtimeMetricsPeriod > 0) {
		var parent = this
		if (isUnDef(this.__runtimeMetricsThreadUuid)) {
			this.__runtimeMetricsThreadUuid = this.thread.addScheduleThreadWithFixedDelay(function(uuid) {
				try { parent.publishRuntimeMetrics("periodic") } catch(e) {}
				return true
			}, this.runtimeMetricsPeriod)
		}
		this.publishRuntimeMetrics("start")
	}
}

// Stop nAttrMon
// ----------------------------------------
nAttrMon.prototype.stop = function() {
	this.alive = false
	this.debug("nAttrMon stopping.")
	for(var i in this.threads) {
		this.threads[i].stop(true)
	}

	for(var i in this.threads) {
		this.threads[i].waitForThreads(1000)
	}

	//this.genSnapshot();
	this.stopObjects()

	$ch(this.chCurrentValues).destroy()
	$ch(this.chLastValues).destroy()
	$ch("nattrmon::warnings").destroy()
	if (isDef(__NAM_CHANNEL_WNOTS)) $ch("nattrmon::wnotf").destroy()
	$ch(this.chPS).destroy()
	$ch("nattrmon::plugs").destroy()
	$ch("nattrmon::attributes").destroy()
	if (isDef(this.chRuntimeMetrics)) {
		try { $ch(this.chRuntimeMetrics).destroy() } catch(e) {}
	}
	if (isDef(this.chRuntimeEvents)) {
		try { $ch(this.chRuntimeEvents).destroy() } catch(e) {}
	}
}

// Stop monitored objects and object pools
// ----------------------------------------
nAttrMon.prototype.stopObjects = function() {
	for(var i in this.objPools) {
		this.objPools[i].stop()
		delete this.objPools[i]
	}
	this.objPools = {}

	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].tryToClose(o)
		delete this.monitoredObjects[o]
	}
	this.monitoredObjects = {}

	for(var itype in this.plugs) {
		for(var iplug in this.plugs[itype]) {
			try {
				this.plugs[itype][iplug].close()
			} catch(e) {
			}
		}
	}
}

// Restart nAttrMon
// ----------------------------------------
nAttrMon.prototype.restart = function() {
	this.debug("nAttrMon restarting")
	this.stop()
	restartOpenAF(__, __NAM_JAVA_ARGS)
}

// Attribute management
// --------------------

// Get attributes
// ---------------------------------------------------------------
// justData = if true returns only the attributes data as an array
// Returns list of attributes
// ---------------------------------------------------------------
nAttrMon.prototype.getAttributes = function(justData) {
	if (justData)
		return this.listOfAttributes.getAttributes(justData)
	else
		return this.listOfAttributes
}

// Set attribute
// ---------------------------------------------------------------
// aName        = attribute name
// aDescription = attribute description
// aType        = attribute type
// ---------------------------------------------------------------
nAttrMon.prototype.setAttribute = function(aName, aDescription, aType) {
	this.listOfAttributes.setAttribute(new nAttribute(aName, aDescription, aType))
}

// Set attributes from structure
// ---------------------------------------------------------------
// aStruct = structure with attribute names as keys and description/type as values
// ---------------------------------------------------------------
nAttrMon.prototype.setAttributes = function(aStruct) {
	for(var attr in aStruct) {
		this.listOfAttributes.setAttribute(new nAttribute(attr, aStruct[attr]))
	}
}

// Warning management
// ------------------

// Set warnings from array
// ---------------------------------------------------------------
// anArrayofWarnings = array of nWarning objects
// ---------------------------------------------------------------
nAttrMon.prototype.setWarnings = function(anArrayofWarnings) {
	for(var i in anArrayofWarnings) {
		this.listOfWarnings.setWarning(anArrayofWarnings[i])
	}
}

// Get warnings
// ---------------------------------------------------------------
// full = if true returns the full nWarnings object
// Returns list of warnings
// ---------------------------------------------------------------
nAttrMon.prototype.getWarnings = function(full) {
	if (full) {
		return this.listOfWarnings
	} else {
		return this.listOfWarnings.getWarnings()
	}
}

// Notification management
// -----------------------

// Set notified flag for a warning/notification
// ---------------------------------------------------------------
// aTitle = warning/notification title
// aId    = id to set notified flag
// aValue = value to set (default true)
// Returns true if ok
// ---------------------------------------------------------------
nAttrMon.prototype.setNotified = function(aTitle, aId, aValue) {
	if (isUnDef(aValue)) aValue = true
	if (isUnDef(aId)) throw "Please provide a setNotified id"
   
	var w = nattrmon.getWarnings(true).getNotificationByName(aTitle)
	if (isUnDef(w)) w = nattrmon.getWarnings(true).getWarningByName(aTitle)

	if (isUnDef(w)) throw "Warning '" + aTitle + "' not found."
	if (isDef(w.getData)) w = w.getData()
	
	if (isUnDef(w.notified)) w.notified = {}
	w.notified[aId] = aValue

	// Set on a different channel if configured
	nattrmon.getWarnings(true).setNotificationByName(aTitle, w)
	return true
}

// Check if notified flag is set for a warning/notification
// ---------------------------------------------------------------
// aTitle = warning/notification title
// aId    = id to check notified flag
// Returns true/false
// ---------------------------------------------------------------
nAttrMon.prototype.isNotified = function(aTitle, aId) {
	if (isUnDef(aId)) throw "Please provide a setNotified id"

	// Get details from a different channel if configured
	var w
	if (isDef(__NAM_CHANNEL_WNOTS)) {
		w = $ch(this.chNotifications).get({ title: aTitle })
	} else {
		w = nattrmon.getWarnings(true).getWarningByName(aTitle)
	}
	if (isUnDef(w) || isUnDef(w.notified)) return false
	return w.notified[aId]
}

// Utils
// -----

// Filter example:
// filter:
//   where:
//   - cond: equals
//     args: 
//     - isFile
//     - true
//   transform:
//   - func: sort
//     args:
//     - "-size"
//   select:
//     filename: n/a
//     size    : -1
//   #selector:
//   #  func: at
//   #  args:
//   #  - 0

// Filters array
// ---------------------------------------------------------------
// aArray = array to filter
// aMap   = map with filter definition
// noDateConversion = if true, no date conversion is applied
// Returns filtered array
// ---------------------------------------------------------------
nAttrMon.prototype.filter = function(aArray, aMap, noDateConversion) {
	aMap = _$(aMap, "aMap").isMap().default({})
	aArray = _$(aArray, "aArray").isArray().default([])

	aMap.where = _$(aMap.where, "where").isArray().default([])
	aMap.select = _$(aMap.select, "select").default(__)
	aMap.transform = _$(aMap.transform, "transform").isArray().default([])
	aMap.selector = _$(aMap.selector, "selector").isMap().default(__)
	aArray = _$(aArray, "aArray").isArray().default([])

	var f = $from(aArray)

	if (!noDateConversion) {
		if (aArray.length > 0) {
			var ar = aArray[0]
			Object.keys(ar).forEach(k => {
				if (k.indexOf("date") >= 0 && !isNull(new Date(ar[k]))) {
					f = f.attach(k + "_ms", r => now() - (new Date(r[k]).getTime()))
				}
			})
		}
	}

	aMap.where.forEach(w => {
		if (isString(w.cond)) f = f[w.cond].apply(f, w.args)
	})
	aMap.transform.forEach(t => {
		if (isString(t.func)) {
			f = f[t.func].apply(f, t.args)
		}
	})

	var res
	if (isString(aMap.select)) {
		if (isUnDef(this.__filterFnCache)) this.__filterFnCache = {}
		var _fn = this.__filterFnCache[aMap.select]
		if (isUnDef(_fn)) {
			if (Object.keys(this.__filterFnCache).length >= 128) this.__filterFnCache = {}
			_fn = new Function("elem", "index", "array", aMap.select)
			this.__filterFnCache[aMap.select] = _fn
		}
		res = f.select(_fn)
	}
	if (isMap(aMap.select)) res = f.select(aMap.select)

	if (isUnDef(res) && isMap(aMap.selector)) res = (isString(aMap.selector.func) ? $$({}).set(aMap.selector.func, f[aMap.selector.func].apply(f, aMap.selector.args)) : res)
	if (isUnDef(res) && isUnDef(aMap.select)) res = f.select()

	return res
}

// Attribute values management
// ---------------------------

// Get current attribute values
// ---------------------------------------------------------------
// full = if true returns the full channel object
// Returns current attribute values
// ---------------------------------------------------------------
nAttrMon.prototype.getCurrentValues = function(full) {
	if (full) {
		return this.currentValues
	} else {
		return ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true)
	}
}

// Get last attribute values
// ---------------------------------------------------------------
// full = if true returns the full channel object
// Returns last attribute values
// ---------------------------------------------------------------
nAttrMon.prototype.getLastValues = function(full) {
	if (full) {
		return this.lastValues
	} else {
		return ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true)
	}
}

// Get historical attribute values by time
// ---------------------------------------------------------------
// anAttributeName    = attribute name
// howManySecondsAgo  = how many seconds ago to retrieve values from
// Returns historical attribute values
// ---------------------------------------------------------------
nAttrMon.prototype.getHistoryValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var attrHist = this.getSessionData("attribute.history")
	if (isUnDef(attrHist)) {
		this.debug("An attribute.history is not defined.")
		return {}
	} else {
		try {
			return attrHist.getValuesByTime(anAttributeName, howManySecondsAgo)
		} catch(e) {
			this.debug("Error getting historical values by time: " + __nam_err(e, false, true))
			return {}
		}
	}
}

// Get historical attribute values by events
// ---------------------------------------------------------------
// anAttributeName    = attribute name
// howManyEventsAgo   = how many events ago to retrieve values from
// Returns historical attribute values
// ---------------------------------------------------------------
nAttrMon.prototype.getHistoryValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var attrHist = this.getSessionData("attribute.history")
	if (isUnDef(attrHist)) {
		this.debug("An attribute.history is not defined.")
		return {}
	} else {
		try {
			return attrHist.getValuesByEvents(anAttributeName, howManyEventsAgo)
		} catch(e) {
			this.debug("Error getting historical values by events: " + __nam_err(e, false, true))
			return {}
		}
 	}
}

// Post attribute processing
// ---------------------------------------------------------------
// et     = extra options map
// values = attribute values map
// Returns processed attribute values map
// ---------------------------------------------------------------
nAttrMon.prototype.posAttrProcessing = function (et, values) {
	var sortKeys
	var toArray = _$(et.toArray).isMap("toArray needs to be a map. " + stringify(et,__,"")).default(__)
	var stamp = _$(et.aStamp).isMap("stamp needs to be a map. " + stringify(et,__,"")).default(__)
	sortKeys = _$(et.sortKeys).isMap("sort needs to be a map. " + stringify(et,__,"")).default(__)
	if (isDef(et.aSort) && isMap(et.aSort)) sortKeys = et.aSort

	// Utilitary functions
	var sorting = (v) => {
		if (isDef(sortKeys)) {
			for(var key in v) {
				if (isDef(sortKeys[key]) && isArray(sortKeys[key]) && isArray(v[key])) {
					var temp = $from(v[key])
					for(var iii in sortKeys[key]) {
						temp = temp.sort(sortKeys[key][iii])
					}
					v[key].val = temp.select()
				}
			}
		}
		return v
	}

	// Stamp
	if (isDef(stamp)) {
		for(var key in values) {
			values[key] = merge(values[key], stamp)
		}
	}

	// Handle to array
	if (isDef(toArray) &&
		isDef(toArray.attrName)) {
		var aFutureValues = {}
		toArray.key = _$(toArray.key)
					.isString("toArray key needs to be a string. " + stringify(toArray,__,""))
					.default("key")
		toArray.attrName = _$(toArray.attrName)
						.isString("toArray attrName needs to be a string. " + stringify(toArray,__,""))
						.$_("to Array attrName needs to be provided. " + stringify(toArray,__,""))
		aFutureValues[toArray.attrName] = ow.obj.fromObj2Array(values, toArray.key)
		values = aFutureValues
	}

	return sorting(values)
}

// Add attribute values
// ---------------------------------------------------------------
// onlyOnEvent    = if true only adds values that changed
// aOrigValues    = original attribute values map
// aOptionals     = optional extra options map
// ---------------------------------------------------------------
nAttrMon.prototype.addValues = function(onlyOnEvent, aOrigValues, aOptionals) {
	var count

	aOptionals = _$(aOptionals).default({})

	if (isUnDef(aOrigValues) || isUnDef(aOrigValues.attributes)) return
	var aMergeKeys = _$(aOptionals.mergeKeys).default(__)

	aMergeKeys = _$(aMergeKeys).isMap().default(__)

	var aValues = aOrigValues.attributes
	aValues = this.posAttrProcessing(aOptionals, aValues)

	for(var key in aValues) {
		if (key.length > 0) {
			if (!this.listOfAttributes.exists(key)) {
				this.setAttribute(key, key + " description")
			}

			this.listOfAttributes.touchAttribute(key)

			// av is already in {name, val, date} shape (as stored by a previous set()
			// below), so it's read directly -- no need to allocate an nAttributeValue
			// wrapper just to immediately unwrap it again via getValue()/getData()
			var av = this.currentValues.get({"name": key})
			if (onlyOnEvent && isDef(av) && compare(av.val, aValues[key])) continue

			this.lastValues.set({"name": key}, isDef(av) ? av : { name: key, val: undefined, date: new Date() })

			if (isDef(aMergeKeys) && isDef(aMergeKeys[key])) {
				var t = { name: key, val: aValues[key], date: new Date() }
				if (isObject(t.val) && !(isArray(t.val))) { t.val = [ t.val ] }
				if (isArray(t.val) && isDef(av)) {
					// Single pass: keep the previous entries not matched by the merge
					// predicate, then append the new entries -- same matcher semantics
					// as _.reject, avoiding the intermediate array from _.concat(_.reject(...))
					var _matcher = _.iteratee(aMergeKeys[key])
					var _merged = []
					if (isArray(av.val)) {
						for (var ii = 0; ii < av.val.length; ii++) {
							if (!_matcher(av.val[ii])) _merged.push(av.val[ii])
						}
					}
					t.val = _merged.concat(t.val)
				}
				if (isUnDef(this.currentValues.getSet({"name": key}, {"name": key}, t))) this.currentValues.set({"name": key}, t)
			} else {
				this.currentValues.set({"name": key}, { name: key, val: aValues[key], date: new Date() })
			}
		}
	}
}

// --------------------------------------------------------------------------------------------
// Plugs
// --------------------------------------------------------------------------------------------

/**
 * <odoc>
 * <key>nattrmon.getPlugs() : Array</key>
 * Get the current array of plugs on nattrmon.
 * </odoc>
 */
nAttrMon.prototype.getPlugs = function() {
	return this.plugs
}

// Add or modify scheduled entry
// ----------------------------------------
// aName      = name of the scheduled entry
// aCronExpr  = cron expression
// aFunc      = function to execute
// waitForFinish = if true, waits for finish before next execution
// Returns uuid of the scheduled entry
// ----------------------------------------
nAttrMon.prototype.addSch = function(aName, aCronExpr, aFunc, waitForFinish) {
	if (isDef(this.schList[aName])) {
		this.sch.modifyEntry(this.schList[aName], aCronExpr, aFunc, waitForFinish)
	} else {
		var uuid = this.sch.addEntry(aCronExpr, aFunc, waitForFinish)
		this.schList[aName] = uuid
	}

	return this.schList[aName]
}

// Execute plugs
// ----------------------------------------
// aPlugType = type of plug to execute
// ----------------------------------------
nAttrMon.prototype.execPlugs = function(aPlugType) {
	var __cpucores = isDef(__NAM_WORKERS) ? __NAM_WORKERS : getNumberOfCores()

	// For each plug of the provided type
    for(var iPlug in this.plugs[aPlugType]) {
		try {
			var entry = this.plugs[aPlugType][iPlug]
			var parent = this
			parent.thread = this.thread

			var uuid
			// Time based or initial meta for channel subscriber
			if (entry.aTime >= 0 || isDef(entry.chSubscribe)) {
				var f
				if (entry.aTime >= 0) f = function(uuid) {
					// Get entry (guard against a session pruned by plug re-registration/removal)
					var _ts = parent.threadsSessions[uuid]
					if (isUnDef(_ts)) return false
					var etry = _ts.entry

					// Check cron expression
					if (isDef(etry.getCron()) &&
						!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
						return false
					}
					parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")")

					var execCtx = __nam_buildExecContext(uuid, "time", __, new Date())
					return __nam_execPlug(parent, etry, execCtx, __cpucores)
				}

				// Schedule thread
				try {
					// Schedule based on time
					if (entry.aTime > 0) {
						if (entry.waitForFinish) {
							this.debug("Starting with fixed rate for " + entry.getName() + " - " + entry.aTime)
							uuid = parent.thread.addScheduleThreadWithFixedDelay(f, entry.aTime)
						} else {
							this.debug("Starting at fixed rate for " + entry.getName() + " - " + entry.aTime)
							uuid = parent.thread.addScheduleThreadAtFixedRate(f, entry.aTime)
						}
					
						this.debug("Creating a thread for " + entry.getName() + " with uuid = " + uuid)
					} else {
						uuid = genUUID()
						if (isDef(entry.chSubscribe)) {
							this.debug("Creating subscriber for " + entry.getName() + " with uuid = " + uuid)
						}
					}

					// Store session
					parent.threadsSessions[uuid] = {
						"entry": this.plugs[aPlugType][iPlug],
						"count": now()
					}
					// Index plug thread
					parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid

					// One-time execution
					if (entry.aTime == 0) f(uuid)
				} catch(e) {
					logErr("Problem starting thread for '" + entry.getName() + "' (uuid " + uuid + "): " + __nam_err(e, false, true))
				}
			}

			// If not time based
			if (entry.aTime <= 0) {
				// If channel subscriber
				if (isDef(entry.chSubscribe)) {
					// Subscriber function
					var subs = function(aUUID) { 
						return function(aCh, aOp, aK, aV) {		
							var cont = false
							try {
								// Guard against a session pruned by plug re-registration/removal
								var _ts = parent.threadsSessions[aUUID]
								if (isUnDef(_ts)) return false
								var etry = _ts.entry
								if (isDef(etry.getAttrPattern())) {
									var gap = etry.getAttrPattern()
									if (isString(gap)) {
										gap = [ gap ]
									}
									var api = 0
									while(api < gap.length && !cont) {
										cont = (new RegExp(gap[api])).test(aK.name)
										api++
									}
								} else {
									cont = true
								}
								// Check cron expression
								if (cont) {
									var execCtx = __nam_buildExecContext(aUUID, "subscribe", { ch: aCh, op: aOp, k: aK, v: aV }, new Date())
									return __nam_execPlug(parent, etry, execCtx, __cpucores)
								}
							} catch(e) {
								logErr(etry.getName() + " | " + __nam_err(e, false, true))
							}
						}
					}
					// Subscribe to channel(s)
					if (isArray(entry.chSubscribe)) {
						for(var i in entry.chSubscribe) {
							this.debug("Subscribing " + entry.chSubscribe[i] + " for " + entry.getName() + "...")
							$ch(entry.chSubscribe[i]).subscribe(subs(uuid))
						}
					} else {
						this.debug("Subscribing " + entry.chSubscribe + " for " + entry.getName() + "...")
						$ch(entry.chSubscribe).subscribe(subs(uuid))
					}
				} else {
				    // If cron based
					if (isDef(entry.getCron())) {
						var f = function(uuid) {
							// Guard against a session pruned by plug re-registration/removal
							var _ts = parent.threadsSessions[uuid]
							if (isUnDef(_ts)) return false
							var etry = _ts.entry
							if (isDef(etry.getCron()) &&
								!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
								return false
							}
							parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")")

							var execCtx = __nam_buildExecContext(uuid, "cron", __, new Date())
							return __nam_execPlug(parent, etry, execCtx, __cpucores)
						}

						// Schedule based on cron
						uuid = this.addSch(entry.getName(), entry.getCron(), f, entry.getWaitForFinish())
						parent.threadsSessions[uuid] = {
							"entry": this.plugs[aPlugType][iPlug],
							"count": now()
						}
						parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid
					} else {
						this.debug("Muting " + entry.getName() + "' (uuid + " + uuid + ") ")
					}
				}
			}
		} catch(e) {
			logErr("Error loading plug: " + aPlugType + "::" + stringify(this.plugs[aPlugType][iPlug], __, "") + " | "  + __nam_err(e, false, true))
		}
    }
}

// Add plug
// ----------------------------------------
// aPlugType     = type of plug
// aInputMeta    = plug meta information
// aObject       = plug object
// args          = extra arguments
// ----------------------------------------
nAttrMon.prototype.addPlug = function(aPlugType, aInputMeta, aObject, args) {
    if (isUnDef(this.plugs[aPlugType])) {
        this.plugs[aPlugType] = []
    }

	if (isUnDef(aInputMeta.type)) aInputMeta.type = aPlugType

    var plug = new nPlug(aInputMeta, args, aObject)

    var anyPlug = $from(this.plugs[aPlugType]).equals("aName", plug.getName()).equals("aCategory", plug.getCategory())
    if (anyPlug.any()) {
    	var i = this.plugs[aPlugType].indexOf(anyPlug.select()[0])
    	this.plugs[aPlugType][i] = plug
    	// Reload works by swapping the live session's .entry in place: the plug's
    	// scheduled thread (or channel subscriber) keeps running under the same uuid
    	// and re-reads parent.threadsSessions[uuid].entry on every invocation -- there is
    	// no separate execPlugs() re-run on reload (see nOutput_Channels.js's reloadPlug),
    	// so this is the only mechanism that makes a reloaded plug's new config/behavior live.
    	if (isDef(this.indexPlugThread[plug.getCategory() + "/" + plug.getName()]))
    		this.threadsSessions[this.indexPlugThread[plug.getCategory() + "/" + plug.getName()]].entry = plug
    } else {
    	this.plugs[aPlugType].push(plug)
    }
    this.debug("Added plug " + plug.getName())
}

// Add input plug
// ----------------------------------------
// aInputMeta    = input plug meta information
// aInputObject  = input plug object
// args          = extra arguments
// ----------------------------------------
nAttrMon.prototype.addInput = function(aInputMeta, aInputObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGINPUTS])) {
		var plug = $from(nattrmon.plugs[this.PLUGINPUTS]).equals("aName", aInputMeta.name)
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGINPUTS + "::" + aInputMeta.name)
			plug.at(0).close()
			logWarn("Reloading plug " + this.PLUGINPUTS + "::" + aInputMeta.name)
		}
	}
	this.addPlug(this.PLUGINPUTS, aInputMeta, aInputObject, args)
}

// Add output plug
// ----------------------------------------
// aOutputMeta    = output plug meta information
// aOutputObject  = output plug object
// args           = extra arguments
// ----------------------------------------
nAttrMon.prototype.addOutput = function(aOutputMeta, aOutputObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGOUTPUTS])) {
		var plug = $from(nattrmon.plugs[this.PLUGOUTPUTS]).equals("aName", aOutputMeta.name)
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGOUTPUTS + "::" + aOutputMeta.name)
			plug.at(0).close()
			logWarn("Reloading plug " + this.PLUGOUTPUTS + "::" + aOutputMeta.name)
		}	
	}
	this.addPlug(this.PLUGOUTPUTS, aOutputMeta, aOutputObject, args)
}

// Add validation plug
// ----------------------------------------
// aValidationMeta    = validation plug meta information
// aValidationObject  = validation plug object
// args               = extra arguments
// ----------------------------------------
nAttrMon.prototype.addValidation = function(aValidationMeta, aValidationObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGVALIDATIONS])) {
		var plug = $from(nattrmon.plugs[this.PLUGVALIDATIONS]).equals("aName", aValidationMeta.name)
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGVALIDATIONS + "::" + aValidationMeta.name)
			plug.at(0).close()
			logWarn("Reloading plug " + this.PLUGVALIDATIONS + "::" + aValidationMeta.name)
		}	
	}
	this.addPlug(this.PLUGVALIDATIONS, aValidationMeta, aValidationObject, args)
}

// Load plugs from directory
// ----------------------------------------
// aDirPath     = directory path
// aPlugType    = type of plug
// ignoreList   = list of files/patterns to ignore
// ----------------------------------------
nAttrMon.prototype.loadPlugs = function() {
	var parent = this;

	// Get ignore list
	var getIgnoreList = (d) => {
		var res = []
		if (io.fileExists(d + "/.nattrmonignore")) {
			var t = io.readFileAsArray(d + "/.nattrmonignore")
			res = $from(t).notStarts("#").notEquals("").match("[a-zA-Z0-9]+").select((r) => {
				var f = javaRegExp(javaRegExp(d + "/" + r).replace("(.+)( +#+.*)", "$1")).replaceAll("\\\\#", "#").trim()
				return f
			})
		} else {
			res = []
		}

		if (io.fileExists(d + "/nattrmonignore.js")) {
			log("Executing '" + d + "/nattrmonignore.js'...")
			try {
				var fn = require(d + "/nattrmonignore.js")
				if (isUnDef(fn.getIgnoreList) || !isFunction(fn.getIgnoreList)) {
					logErr("nattrmonignore.js doesn't have a getIgnoreList function.")
				} else {
					var tmpRes = fn.getIgnoreList()
					tmpRes.forEach((r) => {
						var f = javaRegExp(javaRegExp(d + "/" + r).replace("(.+)( +#+.*)", "$1")).replaceAll("\\\\#", "#").trim()
						res.push(f)
					})
				}
			} catch(e) {
				logErr("Problem with nattrmonignore.js: " + __nam_err(e, false, true))
			}
		}

		return res
	}

	var ignoreList = getIgnoreList(this.configPath)
	this.ignoreList = ignoreList
	this.__ignoreMatchers = this.getIgnoreMatchers(ignoreList)
	parent.debug("Ignore list: " + stringify(ignoreList))

	var newCoreObjects = []
	if (isDef(getOPackPath("nAttrMon"))) newCoreObjects.push(getOPackPath("nAttrMon") + "/config/objects")
	if (io.fileExists(this.configPath + "/objects")) newCoreObjects.push(this.configPath + "/objects")
	if (isDef(__NAM_COREOBJECTS)) newCoreObjects = newCoreObjects.concat(__NAM_COREOBJECTS.split(",").map(r=>templify(r.trim(), getOPackPaths())))
	__NAM_COREOBJECTS = newCoreObjects.join(",")
	parent.debug("_NAM_COREOBJECTS resolved to '" + __NAM_COREOBJECTS + "'")

	// Load core objects
	if (!__NAM_COREOBJECTS_LAZYLOADING) {
		if (isDef(__NAM_COREOBJECTS)) {
			var pthis = this
			__NAM_COREOBJECTS.split(",").filter(co => co.trim().length > 0).forEach(co => {
				pthis.loadPlugDir(co.trim(), "objects", ignoreList, this.__ignoreMatchers)
			})
		} else {
			this.loadPlugDir(this.configPath + "/objects", "objects", ignoreList, this.__ignoreMatchers)
		}
	} else {
		this.objectsPath = {}
		var parent = this
		if (isDef(__NAM_COREOBJECTS)) {
			__NAM_COREOBJECTS.split(",").filter(co => co.trim().length > 0).forEach(co => {
				$from(listFilesRecursive(co.trim()))
				.equals("isFile", true)
				.sort("canonicalPath")
				.select(r => {
					parent.objectsPath[r.filename] = r.filepath
				})
			})

		} else {
			$from(listFilesRecursive(this.configPath + "/objects"))
			.equals("isFile", true)
			.sort("canonicalPath")
			.select(r => { 
				parent.objectsPath[r.filename] = r.filepath
			})
		}
	}

	// Load plugs in order
	if (!__NAM_NOPLUGFILES) {
		var loadOrder = __NAM_PLUGSORDER.split(",")
		var loadedInputs = false, loadedOutputs = false, loadedValidations = false
		loadOrder.forEach(item => {
			switch(item.toLowerCase().trim()) {
			case "inputs":
				this.loadPlugDir(this.configPath + "/inputs", "inputs", ignoreList, this.__ignoreMatchers)
				loadedInputs = true	
				break
			case "outputs":
				this.loadPlugDir(this.configPath + "/outputs", "outputs", ignoreList, this.__ignoreMatchers)
				loadedOutputs = true
				break
			case "validations":
				this.loadPlugDir(this.configPath + "/validations", "validations", ignoreList, this.__ignoreMatchers)
				loadedValidations = true
				break
			default:
				logWarn("PLUGSORDER value '" + item + "' not recognized. Should be either inputs, outputs or validations.")
			}
		})

		if (!loadedInputs) logWarn("nAttrmon exec input plugs not loaded due to PLUGSORDER = '" + __NAM_PLUGSORDER + "'")
		if (!loadedOutputs) logWarn("nAttrmon exec output plugs not loaded due to PLUGSORDER = '" + __NAM_PLUGSORDER + "'")
		if (!loadedValidations) logWarn("nAttrmon exec validations plugs not loaded due to PLUGSORDER = '" + __NAM_PLUGSORDER + "'")
	}
}

/**
 * Creates the necessary internal objects (nInput, nOutput and nValidation) given an yaml definition.
 * 
 * yy   = object;
 * type = [input, output, validation]
 */
nAttrMon.prototype.loadObject = function(yy, type) {
	yy = this.normalizeDescriptorLegacyKeys(yy, type)
	var _schemaIssues = this.validateDescriptorSchema(yy, type)
	if (_schemaIssues.length > 0 && __NAM_DESCRIPTOR_SCHEMA_WARN) {
		_schemaIssues.forEach(m => {
			logWarn(m)
			this._preflightIssue(m)
		})
	}
	if (_schemaIssues.length > 0 && __NAM_DESCRIPTOR_SCHEMA_STRICT) throw _schemaIssues.join(" | ")

	if (isUnDef(yy.args)) yy.args = {}
	if (isDef(yy.exec)) {
		var _fn = this.getInlineExecFn(type, yy.exec)
		switch (type) {
			case "input"     : yy.exec = new nInput(_fn); break
			case "output"    : yy.exec = new nOutput(_fn); break
			case "validation": yy.exec = new nValidation(_fn); break
		}
	}
	if (isUnDef(yy.execArgs)) yy.execArgs = {}
	//if (!(isArray(yy.execArgs))) yy.execArgs = yy.execArgs;
	if (isDef(yy.execFrom)) {
	    var notFound = false
		if (__NAM_COREOBJECTS_LAZYLOADING && type != "objects") {
			var aPath
			if (isDef(__NAM_COREOBJECTS)) {
				__NAM_COREOBJECTS.split(",").forEach(co => {
					var pt = co + "/" + yy.execFrom + ".js"
					if (io.fileExists(pt)) aPath = pt
				})
			} else {
				aPath = this.configPath + "/objects/" + yy.execFrom + ".js"
			}
			if (isUnDef(aPath)) {
				notFound = true
			} else {
				if (isDef(aPath) && !(this.isOnIgnoreList(aPath, __, this.__ignoreMatchers))) {
					if (isDef(aPath)) {
						this.debug("Lazy loading object " + aPath)
						this.loadPlug(aPath, "objects", this.ignoreList)
					} 
				}
			}
		}
		if (!notFound) {
			var o = this.resolveExecFromCtor(yy.execFrom)
			if (!isFunction(o)) {
				var _msg = "Object '" + yy.execFrom + "' couldn't be resolved to a constructor (ALLOW_EVAL_EXECFROM=" + __NAM_ALLOW_EVAL_EXECFROM + ")"
				logErr(_msg)
				this._preflightIssue(_msg)
			} else {
				yy.exec = Object.create(o.prototype)
				if (isMap(yy.execArgs) && isString(yy.execArgs.secKey)) yy.execArgs = __nam_getSec(yy.execArgs, yy.execArgs.secOut)
				o.apply(yy.exec, [yy.execArgs])
			}
		} else {
			var _msg = "Object '"+ yy.execFrom + "' constructor couldn't be found (configPath='" + this.configPath + "'; COREOBJECTS='" + __NAM_COREOBJECTS + "')"
			logErr(_msg)
			this._preflightIssue(_msg)
		}
	}

	return yy
}

// Compatibility map for legacy descriptor keys
// ----------------------------------------
// Returns { lowerCaseKey: canonicalKey }
// ----------------------------------------
nAttrMon.prototype.getDescriptorLegacyMap = function() {
	return {
		execfrom: "execFrom",
		timeinterval: "timeInterval",
		waitforfinish: "waitForFinish",
		onlyonevent: "onlyOnEvent",
		killafterminutes: "killAfterMinutes",
		chsubscribe: "chSubscribe",
		chhandlesetall: "chHandleSetAll",
		execargs: "execArgs"
	}
}

// Normalizes legacy descriptor key casing into canonical keys
// ----------------------------------------
// yy   = descriptor map
// type = input | output | validation
// Returns normalized descriptor map
// ----------------------------------------
nAttrMon.prototype.normalizeDescriptorLegacyKeys = function(yy, type) {
	yy = _$(yy, "yy").isMap().default({})
	var _map = this.getDescriptorLegacyMap()
	Object.keys(yy).forEach(k => {
		if (!isString(k)) return
		var _target = _map[String(k).toLowerCase()]
		if (isDef(_target) && isUnDef(yy[_target])) {
			yy[_target] = yy[k]
			if (__NAM_DESCRIPTOR_LEGACY_WARN) {
				var _msg = "Descriptor compatibility: '" + k + "' is deprecated; use '" + _target + "' on " + type + " plug '" + _$(yy.name).default("unnamed") + "'."
				logWarn(_msg)
				this._preflightIssue(_msg)
			}
		}
	})

	return yy
}

// Validates plug descriptor shape without changing runtime behavior by default
// ----------------------------------------
// yy   = descriptor map
// type = input | output | validation
// Returns array of issue messages
// ----------------------------------------
nAttrMon.prototype.validateDescriptorSchema = function(yy, type) {
	var _issues = []
	if (!isMap(yy)) {
		_issues.push("Descriptor schema: expected a map for " + type + ", got '" + typeof yy + "'.")
		return _issues
	}

	if (!isString(yy.name) || String(yy.name).trim() == "") _issues.push("Descriptor schema: 'name' should be a non-empty string for " + type + ".")
	if (isUnDef(yy.exec) && isUnDef(yy.execFrom)) _issues.push("Descriptor schema: either 'exec' or 'execFrom' must be provided for " + type + " plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.exec) && isDef(yy.execFrom)) _issues.push("Descriptor schema: both 'exec' and 'execFrom' are set for " + type + " plug '" + _$(yy.name).default("unnamed") + "'; this is ambiguous.")

	if (isDef(yy.timeInterval) && !isNumber(yy.timeInterval)) _issues.push("Descriptor schema: 'timeInterval' should be a number for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.cron) && !isString(yy.cron)) _issues.push("Descriptor schema: 'cron' should be a string for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.waitForFinish) && !isBoolean(yy.waitForFinish)) _issues.push("Descriptor schema: 'waitForFinish' should be boolean for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.onlyOnEvent) && !isBoolean(yy.onlyOnEvent)) _issues.push("Descriptor schema: 'onlyOnEvent' should be boolean for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.killAfterMinutes) && !isNumber(yy.killAfterMinutes)) _issues.push("Descriptor schema: 'killAfterMinutes' should be a number for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.chSubscribe) && !(isString(yy.chSubscribe) || isArray(yy.chSubscribe))) _issues.push("Descriptor schema: 'chSubscribe' should be string or array for plug '" + _$(yy.name).default("unnamed") + "'.")

	return _issues
}

// Compile/caches inline YAML/JSON exec scripts by type/source
// ----------------------------------------
// aType = input | output | validation
// aSrc  = inline exec source code
// Returns compiled function
// ----------------------------------------
nAttrMon.prototype.getInlineExecFn = function(aType, aSrc) {
	aType = _$(aType, "aType").isString().$_()
	aSrc = _$(aSrc, "aSrc").isString().$_()

	if (isUnDef(this.__inlineExecFnCache)) this.__inlineExecFnCache = {}
	var _key = aType + "::" + aSrc
	if (isDef(this.__inlineExecFnCache[_key])) return this.__inlineExecFnCache[_key]

	if (Object.keys(this.__inlineExecFnCache).length >= 128) this.__inlineExecFnCache = {}

	var _fn
	switch(aType) {
	case "input":
	case "output":
		_fn = new Function("var scope = arguments[0]; var args = arguments[1]; " + aSrc)
		break
	case "validation":
		_fn = new Function("var warns = arguments[0]; var scope = arguments[1]; var args = arguments[2]; " + aSrc)
		break
	default:
		_fn = new Function(aSrc)
	}

	this.__inlineExecFnCache[_key] = _fn
	return _fn
}

// Resolve execFrom constructor by name with a compatibility fallback to eval
// ----------------------------------------
// aExecFrom = constructor name/expression from config
// Returns constructor function or undefined
// ----------------------------------------
nAttrMon.prototype.resolveExecFromCtor = function(aExecFrom) {
	aExecFrom = _$(aExecFrom, "aExecFrom").isString().$_().trim()
	if (isUnDef(this.__execFromCtorCache)) this.__execFromCtorCache = {}

	if (isDef(this.__execFromCtorCache[aExecFrom])) return this.__execFromCtorCache[aExecFrom]

	var _cacheCtor = (k, v) => {
		if (!isFunction(v)) return __
		if (Object.keys(this.__execFromCtorCache).length >= 256) this.__execFromCtorCache = {}
		this.__execFromCtorCache[k] = v
		return v
	}

	var _ctor
	var _isSimpleIdentifier = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(aExecFrom)
	if (_isSimpleIdentifier) {
		_ctor = global[aExecFrom]
		if (isFunction(_ctor)) {
			return _cacheCtor(aExecFrom, _ctor)
		}
	}

	if (__NAM_ALLOW_EVAL_EXECFROM) {
		if (!_isSimpleIdentifier) {
			if (isUnDef(this.__execFromEvalWarned)) this.__execFromEvalWarned = {}
			if (isUnDef(this.__execFromEvalWarned[aExecFrom])) {
				if (Object.keys(this.__execFromEvalWarned).length >= 128) this.__execFromEvalWarned = {}
				this.__execFromEvalWarned[aExecFrom] = true
				logWarn("resolveExecFromCtor using eval fallback for '" + aExecFrom + "'. Consider migrating to a constructor name.")
			}
		}

		try {
			_ctor = eval(aExecFrom)
			if (isFunction(_ctor)) {
				return _cacheCtor(aExecFrom, _ctor)
			}
		} catch(e) {
			this.debug("resolveExecFromCtor failed for '" + aExecFrom + "': " + __nam_err(e, false, true))
		}
	}

	return __
}

// Precompile ignore-list regexes once and reuse them while walking the plug tree
// ----------------------------------------
// ignoreList = list of ignore entries (prefixes or regex-like patterns)
// Returns array of { prefix, re } matchers
// ----------------------------------------
nAttrMon.prototype.getIgnoreMatchers = function(ignoreList) {
	ignoreList = _$(ignoreList, "ignoreList").isArray().default([])
	return ignoreList.map(entry => {
		var e = String(entry)
		var m = { prefix: e, re: __ }
		try {
			m.re = new RegExp("^" + e + "$")
		} catch(err) {
			m.re = __
		}
		return m
	})
}

// Check if a path is ignored using precompiled matchers
// ----------------------------------------
// aPath           = path to test
// ignoreMatchers  = array returned by getIgnoreMatchers
// Returns true if ignored
// ----------------------------------------
nAttrMon.prototype._isIgnoredPath = function(aPath, ignoreMatchers) {
	if (isUnDef(aPath)) return false
	for (var ii in ignoreMatchers) {
		var im = ignoreMatchers[ii]
		if (aPath.indexOf(im.prefix) == 0) return true
		if (isDef(im.re) && aPath.match(im.re)) return true
	}
	return false
}

// Load plugs from directory
// ----------------------------------------
// aPlugDir     = directory path
// aPlugType    = type of plug
// ignoreList   = list of files/patterns to ignore
// ----------------------------------------
nAttrMon.prototype.loadPlugDir = function(aPlugDir, aPlugDesc, ignoreList, ignoreMatchers) {
    var files = io.listFiles(aPlugDir).files

	ignoreList = _$(ignoreList, "ignoreList").isArray().default([])
	ignoreMatchers = _$(ignoreMatchers).default(this.getIgnoreMatchers(ignoreList))

    var dirs = []
    var plugsjs = []

	// Separate files and directories
    for(var i in files) {
		if (!files[i].filename.startsWith(".")) {
			if(files[i].isFile) {
				plugsjs.push(files[i].filepath)
			} else {
				dirs.push(files[i].filepath)
			}
		}
    }

    dirs = dirs.sort()
    plugsjs = plugsjs.sort()

	// Load directories first
    for (var i in dirs) {
		var inc = !(this._isIgnoredPath(dirs[i], ignoreMatchers))
		if (inc) { this.loadPlugDir(dirs[i], aPlugDesc, ignoreList, ignoreMatchers); } else { 
			logWarn("ignoring " + dirs[i])
			this.ignoreList.push(dirs[i])
		}
    }

	// Load files
    for (var i in plugsjs) {
		var inc = !(this._isIgnoredPath(plugsjs[i], ignoreMatchers))
		if (inc) { this.loadPlug(plugsjs[i], aPlugDesc, ignoreList) } else { 
			logWarn("ignoring " + plugsjs[i])
			this.ignoreList.push(plugsjs[i])
		}
    }
}

// Check if path is on ignore list
// ----------------------------------------
// aPath       = path to check
// ignoreList  = list of files/patterns to ignore
// Returns true if path is on ignore list
// ----------------------------------------
nAttrMon.prototype.isOnIgnoreList = function(aPath, ignoreList) {
	_$(aPath, "path").isString().$_()
	ignoreList = _$(ignoreList).default(this.ignoreList)
	var ignoreMatchers = arguments[2]
	if (isUnDef(ignoreMatchers)) ignoreMatchers = this.getIgnoreMatchers(ignoreList)

	return this._isIgnoredPath(aPath, ignoreMatchers)
}

// Load plug
// ----------------------------------------
// aPlugFile    = plug file path
// aPlugDesc    = plug description
// ignoreList   = list of files/patterns to ignore
// ----------------------------------------
nAttrMon.prototype.loadPlug = function (aPlugFile, aPlugDesc, ignoreList) {
	if (isUnDef(aPlugDesc)) aPlugDesc = ""

	if (aPlugFile.match(/\.(js|yaml|json)$/)) {
		if (!this.checkPlugFileIntegrity(aPlugFile)) {
			var _msg = "Integrity check failed for '" + aPlugFile + "'"
			this._preflightIssue(_msg)
			return
		}
	}

	// Load JS file
	if (aPlugFile.match(/\.js$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile)
		try {
			// Lazy load core objects if enabled
			if (__NAM_COREOBJECTS_LAZYLOADING && aPlugDesc != "objects") {
				var str = io.readFileString(aPlugFile)
				try {
					var ars = str.match(/new (nInput|nOutput|nValidation)([^\(]+)\(/g)
					for (var ii in ars) {
						var ar = ars[ii].match(/new (nInput|nOutput|nValidation)([^\(]+)\(/)
						if (isDef(ar) && isDef(ar[1]) && isDef(ar[2])) {
							var p = this.objectsPath[ar[1] + ar[2] + ".js"]

							if (!(this.isOnIgnoreList(p))) {
								this.debug("Lazy loading object " + p)
								this.loadPlug(p, "objects", ignoreList)
							}
						}
					}
				} catch(e) {
					logErr("Problem on object lazy loading triggered by '" + aPlugFile + "': " + __nam_err(e, false, true))
				}
			}

			if (this.debugFlag && isDef(ow.loadDebug)) {
				ow.debug.load(aPlugFile)
			} else {
				af.load(aPlugFile)
			}
		} catch (e) {
			var _msg = "Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e
			logErr(_msg)
			this._preflightIssue(_msg)
		}
	}
	
	// Load YAML/JSON file
	if (aPlugFile.match(/\.yaml$/) || aPlugFile.match(/\.json$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile)
		try {
			var y
			if (aPlugFile.match(/\.yaml$/))
			   y = io.readFileYAML(aPlugFile, true)
			else
			   y = io.readFileJSON(aPlugFile)

			var parent = this

			function __handlePlug(yyy, type, parent) {
				var yy = parent.loadObject(yyy, type)

				switch (type) {
					case "input": parent.addInput(yy, yy.exec); break
					case "output": parent.addOutput(yy, yy.exec); break
					case "validation": parent.addValidation(yy, yy.exec); break
				}
			}

			var procY = yy => {
				if (isDef(yy.input))
					if (isArray(yy.input))
						yy.input.forEach(function (yo) { __handlePlug(yo, "input", parent) })
					else
						__handlePlug(yy.input, "input", parent)
				if (isDef(yy.output))
					if (isArray(yy.output))
						yy.output.forEach(function (yo) { __handlePlug(yo, "output", parent) })
					else
						__handlePlug(yy.output, "output", parent)
				if (isDef(yy.validation))
					if (isArray(yy.validation))
						yy.validation.forEach(function (yo) { __handlePlug(yo, "validation", parent) })
					else
						__handlePlug(yy.validation, "validation", parent)
			}

			if (isArray(y)) y.forEach(procY); else procY(y)

		} catch (e) {
			var _msg = "Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e
			logErr(_msg)
			this._preflightIssue(_msg)
		}
	}
}

// Convert time abbreviation to milliseconds
// ----------------------------------------
// aStr       = time abbreviation string
// Returns milliseconds
// ----------------------------------------
nAttrMon.prototype.fromTimeAbbreviation = function(aStr) {
	_$(aStr, "aStr").isString().$_()

	var ars = aStr.trim().match(/[0-9]+[a-zA-Z]+/g), res = 0
	if (!isArray(ars) || ars.length == 0) return parseInt(aStr)
	for(var i in ars) {
		var ar = ars[i].match(/([0-9]+)\s*([a-zA-Z]+)/)
		if (isArray(ar) && ar.length > 0) {
			var v = Number(ar[1])
			var u = String(ar[2])
	
			var _u = {
				"ms": 1,
				"s" : 1000,
				"m" : 60 * 1000,
				"h" : 60 * 60 * 1000,
				"d" : 24 * 60 * 60 * 1000,
				"M" : 30 * 24 * 60 * 60 * 1000,
				"y" : 365 * 24 * 60 * 60 * 1000
			}
			if (isDef(_u[u])) {
				res += v * _u[u]
			} else {
				res += v
			}
		}
	}

	return res
}

// Shell execution helper
// ----------------------------------------
// aType       = execution type (local, ssh, kube)
// aOptions    = execution options
// ----------------------------------------
nAttrMon.prototype.shExec = function(aType, aOptions) {
	aType    = _$(aType, "aType").oneOf(["local", "ssh", "kube"]).default("local")
	aOptions = _$(aOptions, "aOptions").isMap().default({})

	var _r = {
		envs: (aMap, incExisting) => {
			this.envs = aMap
			this.incEnvs = incExisting
            return _r
		},
		timeout: (aTimeout) => {
			this.timeout = aTimeout
            return _r
		},
		exec: (cmd, inp) => {
            var res

            switch(aType) {
            case "ssh"  :
                res = $ssh(aOptions)
                if (isDef(this.timeout)) res = res.timeout(this.timeout)
                res = res.sh(cmd, inp).get(0)
                break
			case "kube" :
				if (isUnDef(getOPackPath("Kube"))) throw "Kube opack not installed."
				loadLib("kube.js")
				//var kube = new Kube(aOptions.url, aOptions.user, aOptions.pass, aOptions.wsTimeout, aOptions.token)
				res = $kube({
					url : aOptions.url,
					user: aOptions.user,
					pass: aOptions.pass,
					wsTimeout: aOptions.wsTimeout,
					token: aOptions.token
				}).ns(aOptions.namespace).exec(aOptions.pod, cmd, this.timeout)
				res = {
					stdout: res,
					stderr: __,
					exitcode: __
				}
				break
            case "local":
            default     :
                res = $sh(cmd, inp)
                if (isDef(this.envs) || isDef(this.incEnvs)) res = res.envs(this.envs, this.incEnvs)
                if (isDef(this.timeout)) res = res.timeout(this.timeout)
                res = res.get(0)
            }

			return {
				stdout: res.stdout,
				stderr: res.stderr,
				exitcode: res.exitcode
			}
		}
	}

	return _r
}

// Ensure (and optionally rotate) an HTTP session server
// ----------------------------------------
// aSessionName = session key where the httpd instance is stored
// aPort        = desired port (defaults to 8090)
// aHost        = optional host binding
// aKeyStore    = optional keystore path
// aKeyPassword = optional keystore password
// Returns the active httpd session instance
// ----------------------------------------
nAttrMon.prototype.ensureHttpSession = function(aSessionName, aPort, aHost, aKeyStore, aKeyPassword) {
	aSessionName = _$(aSessionName, "aSessionName").isString().default("httpd")
	aPort = _$(aPort, "aPort").isNumber().default(8090)

	if (this.hasSessionData(aSessionName)) {
		var _hs = this.getSessionData(aSessionName)
		if (isDef(_hs) && isFunction(_hs.getPort) && aPort != _hs.getPort()) {
			this.setSessionData(aSessionName, ow.server.httpd.start(aPort, aHost, aKeyStore, aKeyPassword))
		}
	} else {
		this.setSessionData(aSessionName, ow.server.httpd.start(aPort, aHost, aKeyStore, aKeyPassword))
	}

	return this.getSessionData(aSessionName)
}

// Normalizes a relative HTTP route base path and returns route helpers
// ----------------------------------------
// aMap  = route/config map possibly containing relativePath
// aPort = http server port used to resolve native prefix behavior
// Returns { relativePath, useNativePrefix, routePath(), stripBasePath() }
// ----------------------------------------
nAttrMon.prototype.getHttpRouteHelpers = function(aMap, aPort) {
	aMap = _$(aMap, "aMap").isMap().default({})
	aPort = _$(aPort, "aPort").isNumber().default(8090)

	var relativePath = _$(aMap.relativePath, "relativePath").isString().default(
		isDef(__flags.HTTPD_PREFIX) && isDef(ow.server.httpd.stripPrefix)
			? (ow.server.httpd.getPrefix(aPort) || "/")
			: "/"
	)
	relativePath = templify(relativePath)
	if (!relativePath.startsWith("/")) relativePath = "/" + relativePath
	relativePath = relativePath.replace(/\/+$/, "")
	if (relativePath == "") relativePath = "/"

	var useNativePrefix = isDef(__flags.HTTPD_PREFIX) && isDef(ow.server.httpd.stripPrefix)
	if (useNativePrefix && relativePath !== "/") __flags.HTTPD_PREFIX[String(aPort)] = relativePath

	var routePath = (!useNativePrefix && relativePath !== "/")
		? (aSuffix) => { if (aSuffix == "/") return relativePath; return relativePath + aSuffix; }
		: (aSuffix) => aSuffix

	var stripBasePath = (!useNativePrefix && relativePath !== "/")
		? (aUri) => {
			if (isUnDef(aUri)) return "/"
			if (aUri === relativePath || aUri.startsWith(relativePath + "/")) {
				var localUri = aUri.substring(relativePath.length)
				return (localUri == "") ? "/" : localUri
			}
			return aUri
		}
		: (aUri) => isUnDef(aUri) ? "/" : aUri

	return {
		relativePath: relativePath,
		useNativePrefix: useNativePrefix,
		routePath: routePath,
		stripBasePath: stripBasePath
	}
}

// Build an auth function with one-time custom function compilation
// ----------------------------------------
// aPerms        = permissions map (user -> { p, m })
// aCustomSource = optional custom function source body (u,p,s,r)
// aOptions      = { decodePermPasswords: boolean }
// Returns auth function(u,p,s,r): boolean
// ----------------------------------------
nAttrMon.prototype.getPrecompiledAuthFn = function(aPerms, aCustomSource, aOptions) {
	aOptions = _$(aOptions, "aOptions").isMap().default({})
	var _decodePermPasswords = _$(aOptions.decodePermPasswords).isBoolean().default(false)
	var _perms = aPerms
	var _fnCustom = (isDef(aCustomSource) && isString(aCustomSource))
		? new Function("u", "p", "s", "r", aCustomSource)
		: __

	return function(u, p, s, r) {
		u = String(u)
		p = String(p)

		if (isDef(_fnCustom)) return _fnCustom(u, p, s, r)
		if (!isDef(_perms) || !isDef(_perms[u])) return false

		var _perm = _perms[u]
		var _pp = _perm.p
		if (_decodePermPasswords) _pp = Packages.openaf.AFCmdBase.afc.dIP(_pp)

		if (p == _pp) {
			if (isDef(r)) r.channelPermission = (isDef(_perm.m) ? _perm.m : "r")
			return true
		}

		return false
	}
}

// Builds a reusable HTTP preprocess/auth/audit wrapper for output handlers
// ----------------------------------------
// aMap      = output map with auth/authLocal/authCustom/authType
// aHttpd    = httpd server instance
// aParent   = object with optional audit/auditTemplate
// aLogOwner = short owner name for log messages
// Returns function(aReq, aReply) -> processed reply
// ----------------------------------------
nAttrMon.prototype.getHttpPreProcessFn = function(aMap, aHttpd, aParent, aLogOwner) {
	aMap = _$(aMap, "aMap").isMap().default({})
	aParent = _$(aParent).isMap().default({})
	aLogOwner = _$(aLogOwner).isString().default("nAttrMon")

	var hauth_perms, hauth_func
	var hauth_type = _$(aMap.authType, "hauthType").isString().default("none")
	if (isDef(aMap.auth)) hauth_perms = aMap.auth
	if (isDef(aMap.authLocal)) hauth_perms = aMap.authLocal
	if (isDef(aMap.authCustom)) hauth_func = aMap.authCustom

	var fnAuth = this.getPrecompiledAuthFn(hauth_perms, hauth_func, { decodePermPasswords: true })

	return (aReq, aReply) => {
		var res = aReply, user = ""
		res.header = _$(res.header).default({})
		if (isDef(hauth_perms) && hauth_type != "none") {
			if (hauth_type == "basic") {
				res = ow.server.httpd.authBasic("nattrmon", aHttpd, aReq, (u, p, s, r) => {
					if (!isString(u) || !isString(p)) return false
					user = String(u)
					return fnAuth(user, p, s, r)
				}, () => {
					try {
						if (_$(aParent.audit).isBoolean().default(true)) {
							var data = merge(aReq, {
								reply: {
									status: aReply.status,
									mimetype: aReply.mimetype
								},
								user: "'" + user + "'"
							})
							tlog(_$(aParent.auditTemplate).default(""), data)
						}
					} catch(e) {
						logErr(aLogOwner + " | Error on auditing access: " + String(e))
					}
					return aReply
				}, hss => {
					if (user != "" && _$(aParent.audit).isBoolean().default(true)) {
						try {
							tlogWarn(_$(aParent.auditTemplate).default(""), merge(aReq, {
								method: "AUTH_FAILED",
								user: "'" + user + "'",
								reply: { status: 401, mimetype: "text/plain" }
							}))
						} catch(e) {}
					}
					return hss.reply("Not authorized.", "text/plain", ow.server.httpd.codes.UNAUTHORIZED)
				})
			}
			res.header["Set-Cookie"] = "nattrmon_auth=1"
		} else {
			res.header["Set-Cookie"] = "nattrmon_auth=0"
			if (_$(aParent.audit).isBoolean().default(true)) {
				try {
					var data = merge(aReq, {
						reply: {
							status: aReply.status,
							mimetype: aReply.mimetype
						},
						user: ""
					})
					tlog(_$(aParent.auditTemplate).default(""), data)
				} catch(e) {
					logErr(aLogOwner + " | Error on auditing access: " + String(e))
				}
			}
		}

		return res
	}
}

// Records preflight issues while preflight mode is active
// ----------------------------------------
// aMsg = issue message
// ----------------------------------------
nAttrMon.prototype._preflightIssue = function(aMsg) {
	if (!this.__preflightMode) return
	if (isUnDef(this.__preflightIssues)) this.__preflightIssues = []
	this.__preflightIssues.push(String(aMsg))
}

// Verifies a file against the configured integrity map (when present)
// ----------------------------------------
// aFileOrPath = file path to verify
// Returns true (match), false (mismatch), or undefined (no configured hash)
// ----------------------------------------
nAttrMon.prototype.verifyIntegrity = function(aFileOrPath) {
	aFileOrPath = _$(aFileOrPath, "aFileOrPath").isString().$_()
	if (!isMap(__NAM_INTEGRITY) || Object.keys(__NAM_INTEGRITY).length <= 0) return __

	var _path = aFileOrPath
	try { _path = io.fileInfo(aFileOrPath).canonicalPath } catch(e) {}

	var _relPath = _path
	try {
		var _cfg = io.fileInfo(this.configPath).canonicalPath
		if (_path.indexOf(_cfg + "/") == 0) _relPath = _path.substring(_cfg.length + 1)
	} catch(e) {}

	var _hash = __NAM_INTEGRITY[_path]
	if (isUnDef(_hash)) _hash = __NAM_INTEGRITY[aFileOrPath]
	if (isUnDef(_hash)) _hash = __NAM_INTEGRITY[_relPath]
	if (isUnDef(_hash)) return __

	var stream = io.readFileStream(_path)
	var valid = false

	if (_hash.indexOf("-") >= 0) {
		var alg, h
		[alg, h] = _hash.split("-")
		switch (alg) {
		case "sha256": valid = (sha256(stream) == h); break
		case "sha512": valid = (sha512(stream) == h); break
		case "sha384": valid = (sha384(stream) == h); break
		case "sha1"  : valid = (sha1(stream) == h); break
		case "md5"   : valid = (md5(stream) == h); break
		case "md2"   : valid = (md2(stream) == h); break
		default      : valid = false
		}
	}
	if (_hash.indexOf(":") >= 0) {
		ow.loadJava()
		valid = ow.java.checkDigest(_hash, stream)
	}

	stream.close()
	return valid
}

// Checks if a plug file should be allowed to load according to integrity config
// ----------------------------------------
// aPlugFile = plug/object file path
// Returns true when load should proceed, false otherwise
// ----------------------------------------
nAttrMon.prototype.checkPlugFileIntegrity = function(aPlugFile) {
	if (!isMap(__NAM_INTEGRITY) || Object.keys(__NAM_INTEGRITY).length <= 0) {
		if (__NAM_INTEGRITY_STRICT) {
			var _msg0 = "INTEGRITY OF '" + aPlugFile + "' not configured and INTEGRITY_STRICT is true"
			logErr(_msg0)
			this._preflightIssue(_msg0)
			return false
		}
		return true
	}

	var _ig = this.verifyIntegrity(aPlugFile)
	if (_ig === true) return true

	if (isUnDef(_ig)) {
		if (__NAM_INTEGRITY_STRICT) {
			var _msg = "INTEGRITY OF '" + aPlugFile + "' not configured and INTEGRITY_STRICT is true"
			logErr(_msg)
			this._preflightIssue(_msg)
			return false
		}
		return true
	}

	var _msg = "INTEGRITY OF '" + aPlugFile + "' failed. Please check the source and update integrity hashes."
	this._preflightIssue(_msg)
	if (__NAM_INTEGRITY_WARN && !__NAM_INTEGRITY_STRICT) {
		logWarn(_msg + " Loading will continue because INTEGRITY_WARN=true.")
		return true
	}

	logErr(_msg)
	return false
}

// Performs a startup preflight by loading plugs without starting execution
// ----------------------------------------
// Returns { ok, issues, totalIssues }
// ----------------------------------------
nAttrMon.prototype.preflight = function() {
	this.__preflightMode = true
	this.__preflightIssues = []

	try {
		this.loadPlugs()
	} catch(e) {
		this._preflightIssue("Unexpected preflight exception: " + __nam_err(e, false, true))
	} finally {
		this.__preflightMode = false
	}

	var _issues = clone(this.__preflightIssues)
	return {
		ok: _issues.length == 0,
		totalIssues: _issues.length,
		issues: _issues
	}
}

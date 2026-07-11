// nAttrMon hermetic test harness
// Copyright 2023 Nuno Aguiar
//
// Loads lib/nmain.js once (which pulls in every lib/*.js) against its default
// configuration, then lets individual test files spin up isolated nAttrMon
// engines -- or just the bare constructors -- backed by temp directories
// under tests/.tmp. No network access and no live nAttrMon server required.
//
// Expects a global `NATTRMON_HOME` to already be set (see autoTestAll.js).

if (isUnDef(global.NATTRMON_HOME)) throw "harness.js requires global NATTRMON_HOME to be set before loading"

var __NAM_TEST_TMP_ROOT = NATTRMON_HOME + "/tests/.tmp"
io.mkdir(__NAM_TEST_TMP_ROOT)

if (isUnDef(global.__nam_test_harness_loaded)) {
	global.__nam_test_harness_loaded = true

	// Bootstrap dir used only to load lib/nmain.js with default settings (no nattrmon.yaml present to merge in)
	var NATTRMON_SUBHOME = __NAM_TEST_TMP_ROOT + "/_bootstrap"
	io.mkdir(NATTRMON_SUBHOME)

	loadLib(NATTRMON_HOME + "/lib/nmain.js")

	// Snapshot the __NAM_* defaults nmain.js just set, so tests can cleanly reset between runs
	global.__nam_defaults = {}
	$from(af.fromJavaArray(af.getScopeIds())).starts("__NAM_").select(r => { global.__nam_defaults[r] = global[r] })
}

var harness = {}

// Standard channel names nAttrMon's core classes create under fixed names
var __TEST_STD_CHANNELS = [
	"nattrmon::cvals", "nattrmon::lvals", "nattrmon::warnings", "nattrmon::wnotf",
	"nattrmon::ps", "nattrmon::plugs", "nattrmon::attributes"
]

// Create a fresh, uniquely named temp directory (with a config/ subfolder) under tests/.tmp
// ----------------------------------------
// aName = prefix for the directory name
// Returns the directory path
// ----------------------------------------
harness.tmpDir = function(aName) {
	var d = __NAM_TEST_TMP_ROOT + "/" + (aName || "t") + "-" + genUUID()
	io.mkdir(d)
	io.mkdir(d + "/config")
	return d
}

// Destroy the fixed-name channels/caches nAttrMon's core classes use, so the next
// test starts from a clean slate
// ----------------------------------------
harness.resetChannels = function() {
	__TEST_STD_CHANNELS.forEach(n => { try { $ch(n).destroy() } catch(e) {} })
	try { $cache("nattrmon::warnings::cache").destroy() } catch(e) {}
}

// Restore every __NAM_* global back to the value nmain.js set at load time
// ----------------------------------------
harness.resetGlobals = function() {
	Object.keys(global.__nam_defaults).forEach(k => { global[k] = global.__nam_defaults[k] })
}

// Apply overrides on top of the default __NAM_* globals
// ----------------------------------------
// overrides = map of __NAM_* global name to value
// ----------------------------------------
harness.setGlobals = function(overrides) {
	Object.keys(overrides || {}).forEach(k => { global[k] = overrides[k] })
}

// Spin up a fresh, isolated nAttrMon engine instance. Sets the global `nattrmon`
// (as production code expects) and returns it.
// ----------------------------------------
// overrides = map of __NAM_* global overrides for this engine
// opts      = { name: tmp dir prefix, debug: debugFlag }
// Returns the new nAttrMon instance
// ----------------------------------------
harness.newEngine = function(overrides, opts) {
	opts = opts || {}
	overrides = overrides || {}

	harness.resetGlobals()
	harness.resetChannels()

	// Hermetic-by-default: no persistence files, no audit noise, console-only logging, no plug files unless asked for
	harness.setGlobals(merge({
		__NAM_NEED_CH_PERSISTENCE: false,
		__NAM_LOGCONSOLE: true,
		__NAM_LOGAUDIT: false,
		__NAM_NOPLUGFILES: true,
		__NAM_CLOSEDHK_ONSTARTUP: false
	}, overrides))

	var dir = harness.tmpDir(opts.name || "engine")
	global.nattrmon = new nAttrMon(dir + "/config", !!opts.debug)
	global.nattrmon.__testDir = dir
	return global.nattrmon
}

// Stop and tear down an engine created with harness.newEngine
// ----------------------------------------
// nm = engine instance (defaults to global nattrmon)
// ----------------------------------------
harness.stopEngine = function(nm) {
	nm = nm || global.nattrmon
	if (isDef(nm)) {
		try { nm.stop() } catch(e) {}
	}
	global.nattrmon = undefined
	harness.resetChannels()
}

// Minimal nattrmon stand-in for lib-level tests (nPlug, nValidation) that only
// need setAttribute/getWarnings/setWarnings without the cost of a full engine
// ----------------------------------------
// overrides = fields/methods to merge over the default stub
// Returns the stub, also installed as global nattrmon
// ----------------------------------------
harness.stubNattrmon = function(overrides) {
	var stub = merge({
		debugFlag: false,
		attributes: {},
		warnings: {},
		setAttribute: function(aName, aDescription, aType) { this.attributes[aName] = { description: aDescription, type: aType } },
		getWarnings: function() { return this.warnings },
		setWarnings: function(w) { this.warnings = w }
	}, overrides || {})
	global.nattrmon = stub
	return stub
}

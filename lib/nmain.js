// nAttrMon main script functionality
// Copyright 2023 Nuno Aguiar

// Initialization 
var __NAM_LOGHK_HOWLONGAGOINMINUTES = 30 * 24 * 60; // How long to keep logs
var __NAM_LOGAUDIT                  = true;         // Set to false to turn it off
var __NAM_LOGAUDIT_TEMPLATE         = "AUDIT | User: {{request.user}} | Channel: {{name}} | Operation: {{op}} | Key: {{{key}}}";
var __NAM_JAVA_ARGS                 = [ ];          // Array of java arguments
var __NAM_LOGCONSOLE                = false;        // Create files or log to console
var __NAM_MAXPLUGEXECUTE_TIME       = void 0;       // Max default time for plug execution
var __NAM_DEBUG                     = false;
var __NAM_BUFFERCHANNELS            = false;
var __NAM_BUFFERBYNUMBER            = 100;
var __NAM_BUFFERBYTIME              = 1000;
var __NAM_WORKERS                   = __cpucores;
var __NAM_COREOBJECTS               = void 0;
var __NAM_COREOBJECTS_LAZYLOADING   = true;
var __NAM_NEED_CH_PERSISTENCE       = true;
var __NAM_CH_PERSISTENCE_PATH       = void 0;
var __NAM_CLOSEDHK_HOWLONGAGOINMS   = 60000;        // How long to keep closed warnings in ms
var __NAM_CLOSEDHK_ONSTARTUP        = true;
var __NAM_CHANNEL_CVALS             = __;
var __NAM_CHANNEL_LVALS             = __;
var __NAM_CHANNEL_WARNS             = __;
var __NAM_CHANNEL_WNOTS             = __
var __NAM_CHANNEL_LOGS              = __
var __NAM_JSONLOG                   = false;
var __NAM_SLOWDOWN                  = true
var __NAM_SLOWDOWN_WARNS            = false
var __NAM_SLOWDOWN_TIME             = 250
var __NAM_NOPLUGFILES               = false
var __NAM_PLUGSORDER                = "inputs,outputs,validations"

var __NAM_SEC_REPO        = __;
var __NAM_SEC_BUCKET      = __;
var __NAM_SEC_BUCKET_PASS = __;
var __NAM_SEC_MAIN_PASS   = __;
var __NAM_SEC_FILE        = __;

var NATTRMON_HOME = NATTRMON_HOME || getOPackPath("nAttrMon") || ".";

// -------------------------------------------------------------------

ow.loadServer();
ow.loadObj(); 
ow.loadFormat(); 
ow.loadTemplate();
if (isDef(ow.template.addOpenAFHelpers)) ow.template.addOpenAFHelpers()
ow.template.addFormatHelpers();
ow.template.addConditionalHelpers();
loadLodash(); 

if (isUnDef(toBoolean)) toBoolean = function(aObj) {
	if (isBoolean(aObj)) return aObj;
	if (isNumber(aObj)) return Boolean(aObj);
	if (isString(aObj)) return (aObj.trim().toLowerCase() == 'true');
	return aObj;
}

var params
var pms = getEnvs();
if (io.fileExists(NATTRMON_SUBHOME + "/nattrmon.yaml"))
	pms = merge(io.readFileYAML(NATTRMON_SUBHOME + "/nattrmon.yaml", true), pms);

//if (isUnDef(pms) || pms == null) pms = {};
if (isDef(pms.JAVA_ARGS) && isArray(pms.JAVA_ARGS)) __NAM_JAVA_ARGS = pms.JAVA_ARGS;
if (isDef(pms.LOGAUDIT)) __NAM_LOGAUDIT = toBoolean(pms.LOGAUDIT);
if (isDef(pms.LOGAUDIT_TEMPLATE) && isString(pms.LOGAUDIT_TEMPLATE)) __NAM_LOGAUDIT_TEMPLATE = pms.LOGAUDIT_TEMPLATE;
if (isDef(pms.LOGHK_HOWLONGAGOINMINUTES) && isNumber(pms.LOGHK_HOWLONGAGOINMINUTES)) __NAM_LOGHK_HOWLONGAGOINMINUTES = Number(pms.LOGHK_HOWLONGAGOINMINUTES) 
if (isDef(pms.NUMBER_WORKERS)) { __cpucores = Number(pms.NUMBER_WORKERS); __NAM_WORKERS = Number(pms.NUMBER_WORKERS); }
if (isDef(pms.LOG_ASYNC)) __logFormat.async = toBoolean(pms.LOG_ASYNC);
if (isDef(pms.DEBUG)) __NAM_DEBUG = toBoolean(pms.DEBUG);	
if (isDef(pms.LOGCONSOLE)) __NAM_LOGCONSOLE = toBoolean(pms.LOGCONSOLE);
if (isDef(pms.JSONLOG)) __NAM_JSONLOG = toBoolean(pms.JSONLOG)
if (isDef(pms.MAXPLUGEXECUTE_TIME)) __NAM_MAXPLUGEXECUTE_TIME = Number(pms.MAXPLUGEXECUTE_TIME);
if (isDef(params) && isUnDef(params.withDirectory) && isDef(pms.CONFIG)) params.withDirectory = pms.CONFIG;

if (isDef(pms.BUFFERCHANNELS)) __NAM_BUFFERCHANNELS = toBoolean(pms.BUFFERCHANNELS);
if (isDef(pms.BUFFERBYNUMBER)) __NAM_BUFFERBYNUMBER = Number(pms.BUFFERBYNUMBER);
if (isDef(pms.BUFFERBYTIME))   __NAM_BUFFERBYTIME = Number(pms.BUFFERBYTIME);

if (isDef(pms.COREOBJECTS))    __NAM_COREOBJECTS = pms.COREOBJECTS;
if (isDef(pms.COREOBJECTS_LAZYLOADING)) __NAM_COREOBJECTS_LAZYLOADING = toBoolean(pms.COREOBJECTS_LAZYLOADING);

if (isString(pms.CHANNEL_CVALS))  __NAM_CHANNEL_CVALS = pms.CHANNEL_CVALS;
if (isString(pms.CHANNEL_LVALS))  __NAM_CHANNEL_LVALS = pms.CHANNEL_LVALS;
if (isString(pms.CHANNEL_WARNS))  __NAM_CHANNEL_WARNS = pms.CHANNEL_WARNS;
if (isString(pms.CHANNEL_WNOTS))  __NAM_CHANNEL_WNOTS = pms.CHANNEL_WNOTS
if (isString(pms.CHANNEL_LOGS))   __NAM_CHANNEL_LOGS  = pms.CHANNEL_LOGS

if (isDef(pms.CH_PERSISTENCE_PATH)) __NAM_CH_PERSISTENCE_PATH = pms.CH_PERSISTENCE_PATH;
if (isDef(pms.CLOSEDHK_HOWLONGAGOINMS)) __NAM_CLOSEDHK_HOWLONGAGOINMS = Number(pms.CLOSEDHK_HOWLONGAGOINMS)
if (isDef(pms.CLOSEDHK_ONSTARTUP)) __NAM_CLOSEDHK_ONSTARTUP = toBoolean(pms.CLOSEDHK_ONSTARTUP);

if (isDef(pms.NEED_CH_PERSISTENCE)) __NAM_NEED_CH_PERSISTENCE = toBoolean(pms.NEED_CH_PERSISTENCE );
if (isDef(pms.SLOWDOWN))       __NAM_SLOWDOWN       = toBoolean(pms.__NAM_SLOWDOWN)
if (isDef(pms.SLOWDOWN_WARNS)) __NAM_SLOWDOWN_WARNS = toBoolean(pms.__NAM_SLOWDOWN_WARNS)
if (isDef(pms.SLOWDOWN_TIME))  __NAM_SLOWDOWN_TIME  = Number(pms.__NAM_SLOWDOWN_TIME)
if (isDef(pms.NOPLUGFILES))    __NAM_NOPLUGFILES    = toBoolean(pms.__NAM_NOPLUGFILES)
if (isDef(pms.PLUGSORDER))     __NAM_PLUGSORDER     = String(pms.PLUGSORDER)

if (isDef(pms.SEC_REPO))        __NAM_SEC_REPO        = String(pms.SEC_REPO);
if (isDef(pms.SEC_BUCKET))      __NAM_SEC_BUCKET      = String(pms.SEC_BUCKET);
if (isDef(pms.SEC_BUCKET_PASS)) __NAM_SEC_BUCKET_PASS = String(pms.SEC_BUCKET_PASS);
if (isDef(pms.SEC_MAIN_PASS))   __NAM_SEC_MAIN_PASS   = String(pms.SEC_MAIN_PASS);
if (isDef(pms.SEC_FILE))        __NAM_SEC_FILE        = String(pms.SEC_FILE);

// Auxiliary objects
loadLib(NATTRMON_HOME + "/lib/nattribute.js");
loadLib(NATTRMON_HOME + "/lib/nattributevalue.js");
loadLib(NATTRMON_HOME + "/lib/nattributes.js");
loadLib(NATTRMON_HOME + "/lib/nmonitoredobject.js");
loadLib(NATTRMON_HOME + "/lib/nplug.js");
loadLib(NATTRMON_HOME + "/lib/ninput.js");
loadLib(NATTRMON_HOME + "/lib/noutput.js");
loadLib(NATTRMON_HOME + "/lib/nwarning.js");
loadLib(NATTRMON_HOME + "/lib/nwarnings.js");
loadLib(NATTRMON_HOME + "/lib/nvalidation.js");

loadLib(NATTRMON_HOME + "/lib/ntmplhelpers.js");

// Main object ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var __nam_getSec = (aM, aPath) => {
	aM = _$(aM).isMap().default({});
	if (isDef(aM.secKey)) {
		aMap = clone(aM)
		
		aMap.secRepo     = _$(aMap.secRepo).default(__NAM_SEC_REPO);
		aMap.secBucket   = _$(aMap.secBucket).default(__NAM_SEC_BUCKET);
		aMap.secPass     = _$(aMap.secPass).default(__NAM_SEC_BUCKET_PASS);
		aMap.secMainPass = _$(aMap.secMainPass).default(__NAM_SEC_MAIN_PASS);
		aMap.secFile     = _$(aMap.secFile).default(__NAM_SEC_FILE);
		
		var s = $sec(aMap.secRepo, aMap.secBucket, aMap.secPass, aMap.secMainPass, aMap.secFile).get(aMap.secKey);

		delete aMap.secRepo
		delete aMap.secBucket
		delete aMap.secPass
		delete aMap.secMainPass
		delete aMap.secFile
		delete aMap.secKey

		if (isDef(aPath)) {
			return $$(aMap).set(aPath, merge($$(aMap).get(aPath), s));
		} else {
			return merge(aMap, s);
		}
	} else {
		return aM;
	}
}

var __nam_getChExtraOptions = (aMap, field) => {
	if (aMap.type == "elasticsearch") { 
           aMap.options.idKey = "id"; 
           aMap.options.size = 10000; 
           if (isDef(field)) aMap.options.fnId = k => { return sha256(k[field]) } 
        } 
	return aMap;
}

var nAttrMon = function(aConfigPath, debugFlag) {
	plugin("Threads");

	if (debugFlag && isDef(ow.loadDebug)) {
		ow.loadDebug()
		ow.debug.register()
	}

	(function() {
		var p = $from(getOPackLocalDB()).equals("name", "nAttrMon");
		var t = templify("OpenAF version: {{oafVersion}} ({{oafDistribution}}) | nAttrMon version: {{namVersion}} | Java version: {{javaVersion}}", {
			oafVersion: getVersion(),
			oafDistribution: getDistribution(),
			namVersion: (p.any() ? p.at(0).version : "n/a"),
			javaVersion: ow.format.getJavaVersion()
		});
		print(t + "\n" + repeat(t.length, "-"));
	
		print("Applying parameters:");
		$from(af.fromJavaArray( af.getScopeIds() ))
		.starts("__NAM_")
		.notStarts("__NAM_SEC")
		.sort()
		.select(r => { 
			print(r + ": " + (isFunction(global[r]) ? "(function)" : global[r]));
		});
	
		print(repeat(t.length, "-"));
	})();

	this.chCurrentValues = "nattrmon::cvals";
	this.chLastValues    = "nattrmon::lvals";
	this.chNotifications = "nattrmon::wnotf"
	this.chWarnings      = "nattrmon::warnings"
 	this.chPS            = "nattrmon::ps";

	if (isDef(__NAM_CHANNEL_CVALS)) {
		var o = jsonParse(__NAM_CHANNEL_CVALS, true);
		if (!isMap(o)) logWarn("Couldn't parse __NAM_CHANNEL_CVALS to a map")
		o.options = __nam_getSec(o.options);
		o = __nam_getChExtraOptions(o, "name");
		$ch(this.chCurrentValues).create(1, o.type, o.options);
	} else {
		$ch(this.chCurrentValues).create(1, "simple");
	}

	if (isDef(__NAM_CHANNEL_LVALS)) {
		var o = jsonParse(__NAM_CHANNEL_LVALS, true);
		if (!isMap(o)) logWarn("Couldn't parse __NAM_CHANNEL_LVALS to a map")
		o.options = __nam_getSec(o.options);
		o = __nam_getChExtraOptions(o, "name");
		$ch(this.chLastValues).create(1, o.type, o.options);
	} else {
		$ch(this.chLastValues).create(1, "simple");
	}

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
		log(t, { off: true, async: false });

		$from(af.fromJavaArray( af.getScopeIds() ))
		.starts("__NAM_")
		.notStarts("__NAM_SEC")
		.sort()
		.select(r => { 
			if (!isObject(global[r])) log("Parameter " + r + ": " + global[r], { off: true, async: false })
		})
	}
	
	$ch(this.chPS).create(1, "simple");

	// Buffer cvals
	if (__NAM_BUFFERCHANNELS) {
		$ch(this.chCurrentValues).subscribe(ow.ch.utils.getBufferSubscriber(this.chCurrentValues, [ "name" ], __NAM_BUFFERBYNUMBER, __NAM_BUFFERBYTIME), true);
	}

	this.currentValues    = $ch(this.chCurrentValues);
	this.lastValues       = $ch(this.chLastValues);

	this.configPath          = (isUnDef(aConfigPath)) ? "." : aConfigPath;
	this.listOfAttributes    = new nAttributes();
	this.listOfWarnings      = new nWarnings();
	this.count               = now();
	this.countCheck          = 30000; // shouldn't be very aggresive
	this.debugFlag           = (isUnDef(debugFlag)) ? false : debugFlag;

	this.plugs = {};

	this.PLUGINPUTS      = "inputs";
	this.PLUGOUTPUTS     = "outputs";
	this.PLUGVALIDATIONS = "validations";
	this.PLUGSYSTEM      = "system";

	this.threads = [];
	this.threadsSessions = {};
	this.sessionData = {};
	this.monitoredObjects = {};
	this.objPools = {};
	this.objPoolsCat = {};
	this.objPoolsAssociations = {};
	this.indexPlugThread = {};
	this.sch = new ow.server.scheduler(); // schedule plugs thread pool
	this.schList = {}; // schedule plugs list
	this.ignoreList = [];
	this.alive = false;

	plugin("Threads");
	this.thread = new Threads();
	this.thread.initScheduledThreadPool(__NAM_WORKERS);
	this.threads.push(this.thread);

	var nattrmon = this;

	// Start logging
	if (!__NAM_LOGCONSOLE) {
		io.mkdir(aConfigPath + "/log");
		ow.ch.utils.setLogToFile({
			logFolder: aConfigPath + "/log",
			HKhowLongAgoInMinutes: __NAM_LOGHK_HOWLONGAGOINMINUTES,
			numberOfEntriesToKeep: 10,
			setLogOff            : true
		});
	}

	if (__NAM_LOGAUDIT) {
		ow.ch.server.setLog(function(aMap) {
			aMap = merge(aMap, { key: stringify(jsonParse(aMap.request.uri.replace(/.+({[^}]+}).*/, "$1").replace(/&quot;/g, "\'")),undefined,"").replace(/\"/g, "") });
			tlog(__NAM_LOGAUDIT_TEMPLATE, aMap);
		});
	}

	if (__NAM_JSONLOG) {
		setLog({ format: "json" })
	}

	if (!__NAM_LOGCONSOLE) print(new Date() + " | Starting log to " + aConfigPath + "/log");

	// date checks
	this.currentValues.subscribe((new nAttributeValue()).convertDates, true)
	this.lastValues.subscribe((new nAttributeValue()).convertDates, true)
	this.listOfAttributes.getCh().subscribe((new nAttribute()).convertDates, true)
    this.listOfWarnings.getCh().subscribe((new nWarning()).convertDates, true)
   
	// persistence
	if (toBoolean(__NAM_NEED_CH_PERSISTENCE)) {
		this.listOfWarnings.getCh().storeAdd(this.getSnapshotPath() + "/nattrmon.warns.snapshot", [ "title" ], true);
		this.listOfAttributes.getCh().storeAdd(this.getSnapshotPath() + "/nattrmon.attrs.snapshot", [ "name" ], true);
		this.lastValues.storeAdd(this.getSnapshotPath() + "/nattrmon.lvals.snapshot", [ "name" ], true);
		this.currentValues.storeAdd(this.getSnapshotPath() + "/nattrmon.cvals.snapshot", [ "name" ], true);
	}
};

nAttrMon.prototype.getConfigPath = function(aPath) {
	if (isUnDef(aPath)) return this.configPath
	var opackPath = (getOPackPath("nAttrMon") || ".") + "/config"
	if (!io.fileExists(this.configPath + "/" + aPath) && io.fileExists(opackPath + "/" + aPath)) return opackPath; else return this.configPath
}

nAttrMon.prototype.getSnapshotPath = function() {
	return (isUnDef(__NAM_CH_PERSISTENCE_PATH) ? this.getConfigPath() : __NAM_CH_PERSISTENCE_PATH);
};

nAttrMon.prototype.shutdown = function(aCode) {
	aCode = _$(aCode, "aCode").isNumber().default(0);

	log("Shutting down... (exit code = " + aCode + ")");
	nattrmon.stop();
	exit(aCode);
}

// Snapshot functions
// ------------------

nAttrMon.prototype.genSnapshot = function() {
	var mainpath = this.getConfigPath();
	var snapshot = {
		currentValues: ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true),
		lastValues: ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true),
		listOfAttributes: this.listOfAttributes.getAttributes(true),
		listOfWarnings: this.listOfWarnings.getWarnings(true)
	};
	io.writeFileBytes(mainpath + "/nattrmon.snapshot", compress(snapshot));
};

// Session function
// ----------------

nAttrMon.prototype.setSessionData = function(aKey, aObject) {
	this.sessionData[aKey] = aObject;
};

nAttrMon.prototype.getSessionData = function(aKey) {
	return this.sessionData[aKey];
};

nAttrMon.prototype.hasSessionData = function(aKey) {
	if(isUnDef(this.getSessionData(aKey))) {
		return false;
	} else {
		return true;
	}
};

// Debug functions
// ---------------
nAttrMon.prototype.setDebug = function(aDebugFlag) {
	this.debugFlag = aDebugFlag;
};

// Monitored objects
// -----------------

nAttrMon.prototype.addMonitoredObject = function(aKey, anObject) {
	this.monitoredObjects[aKey] = new nMonitoredObject(aKey, anObject);
	return this.getMonitoredObject(aKey);
};

nAttrMon.prototype.getMonitoredObject = function(aKey) {
  	if (this.hasMonitoredObject(aKey))
		return this.monitoredObjects[aKey].getObject();
};

nAttrMon.prototype.hasMonitoredObject = function(aKey) {
	if(isUnDef(this.monitoredObjects[aKey])) {
		return false;
	} else {
		return true;
	}
};

nAttrMon.prototype.monitoredObjectsTest = function() {
	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].test();
	}
};

nAttrMon.prototype.declareMonitoredObjectDirty = function(aKey) {
	this.monitoredObjects[aKey].setDirty();
	this.monitoredObjects[aKey].test();
};

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
		return true;
	else
		return false;
};

/**
 * <odoc>
 * <key>nattrmon.addObjectPool(aKey, aOWObjPool, aCat, aLifeCycle)</key>
 * Given a aOWObjPool (created, but not started, from ow.obj.pool) starts it and adds it to nattrmon
 * with the provided aKey. Later objects can be requested and returned using nattrmon.leaseObject and
 * nattrmon.returnObject. Optionally you can provide a aCat category and/or aLifeCycle map (limit, fn and last).
 * </odoc>
 */
nAttrMon.prototype.addObjectPool = function(aKey, aOWObjPool, aCat, aLifeCycle) {
	this.objPools[aKey] = aOWObjPool.start();
	this.objPoolsCat[aKey] = aCat;
	this.objPoolsAssociations[aKey] = {};
	return this;
};

/**
 * <odoc>
 * <key>nattrmon.getObjectPool(aKey) : Object</key>
 * Returns the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.getObjectPool = function(aKey) {
	return this.objPools[aKey];
};

/**
 * <odoc>
 * <key>nattrmon.delObjectPool(aKey) : nattrmon</key>
 * Deletes the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.delObjectPool = function(aKey) {
    this.objPools[aKey].stop();
	//deleteFromArray(this.objPools, this.objPools.indexOf(aKey));
	delete this.objPools[aKey];
	delete this.objPoolsCat[aKey];
	delete this.objPoolsAssociations[aKey];

	return this;
};

/**
 * <odoc>
 * <key>nattrmon.getObjectPoolKeys(aKey, aCategory) : Array</key>
 * Retrieves the current list of object pool keys. Optionally you can filter by a specific aCategory provided
 * on addObjectPool.
 * </odoc>
 */
nAttrMon.prototype.getObjectPoolKeys = function(aCat) {
	var res = [];
	if (isUnDef(aCat))
		return Object.keys(this.objPools);
	else {
		var ori = Object.keys(this.objPools);
		for(var i in ori) {
			if (this.objPoolsCat[ori[i]] == aCat) {
				res.push(ori[i]);
			}
		}
	}

	return res;
};

/**
 * <odoc>
 * <key>nattrmon.leaseObject(aKey) : Object</key>
 * Ask the object pool associated with aKey for an object instance to be used.
 * </odoc>
 */
nAttrMon.prototype.leaseObject = function(aKey) {
	return this.objPools[aKey].checkOut();
};

/**
 * <odoc>
 * <key>nattrmon.returnObject(aKey, anObj, aStatus)</key>
 * Returns an object that was previsouly leased using nattrmon.leaseObject for the object pool associated with aKey
 * providing aStatus (false = obj should be thrown away).
 * </odoc>
 */
nAttrMon.prototype.returnObject = function(aKey, anObj, aStatus) {
	return this.objPools[aKey].checkIn(anObj, aStatus);
};

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
		logWarn("Object pool '" + aKey + "' doesn't exist.");
		return false;
	} else {
		return this.objPools[aKey].use(function(v) {
			var res = aFunction(v);
			if (isDef(res)) return res; else return true;
		});
	}
};

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
	this.objPoolsAssociations[aParentKey][aPath] = aChildKey;
};

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
	return this.objPoolsAssociations[aParentKey][aPath];
};

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
	var uri = new java.net.URI(aURL);

	if (uri.getScheme().toLowerCase() == "ssh") {
		var port = uri.getPort();
		var [user, pass] = String(uri.getUserInfo()).split(/:/);
		var path = uri.getPath();
		return ow.obj.pool.SSH(String(uri.getHost()), (Number(port) > 0) ? port : 22, user, pass, (String(path).length > 0) ? String(path) : void 0, true);
	}
};

// System functions
// ----------------

nAttrMon.prototype.debug = function(aMessage) {
	if(this.debugFlag) {
		ansiStart();
		log(ansiColor("BG_YELLOW,BLACK", "DEBUG | " + aMessage));
		ansiStop();
	}
};

nAttrMon.prototype.start = function() {
	this.debug("nAttrMon monitor plug");

	this.addPlug(this.PLUGSYSTEM,
		         {"name": "system monitor", "timeInterval": this.countCheck, "waitForFinish": false, "onlyOnEvent": false}, 
		         new nValidation(function() {
		         	nattrmon.count = now();
		         	//nattrmon.genSnapshot();
		         }),
		         {});
	this.execPlugs(this.PLUGSYSTEM);
	this.debug("nAttrMon start load plugs");
	this.loadPlugs();

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

	this.debug("nAttrMon restoring snapshot");
	this.alive = true;
}

nAttrMon.prototype.stop = function() {
	this.alive = false;
	this.debug("nAttrMon stopping.");
	for(var i in this.threads) {
		this.threads[i].stop(true);
	}

	for(var i in this.threads) {
		this.threads[i].waitForThreads(1000);
	}

	//this.genSnapshot();
	this.stopObjects();

	$ch(this.chCurrentValues).destroy()
	$ch(this.chLastValues).destroy()
	$ch("nattrmon::warnings").destroy()
	$ch(this.chPS).destroy()
	$ch("nattrmon::plugs").destroy()
	$ch("nattrmon::attributes").destroy()
}

nAttrMon.prototype.stopObjects = function() {
	for(var i in this.objPools) {
		this.objPools[i].stop();
		delete this.objPools[i];
	}
	this.objPools = {};

	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].tryToClose(o);
		delete this.monitoredObjects[o];
	}
	this.monitoredObjects = {};

	for(var itype in this.plugs) {
		for(var iplug in this.plugs[itype]) {
			try {
				this.plugs[itype][iplug].close();
			} catch(e) {
			}
		}
	}
}

nAttrMon.prototype.restart = function() {
	this.debug("nAttrMon restarting");
	this.stop();
	restartOpenAF(void 0, __NAM_JAVA_ARGS);
};

// Attribute management
// --------------------

nAttrMon.prototype.getAttributes = function(justData) {
	if (justData)
		return this.listOfAttributes.getAttributes(justData);
	else
		return this.listOfAttributes;
}

nAttrMon.prototype.setAttribute = function(aName, aDescription, aType) {
	this.listOfAttributes.setAttribute(new nAttribute(aName, aDescription, aType));
}

nAttrMon.prototype.setAttributes = function(aStruct) {
	for(var attr in aStruct) {
		this.listOfAttributes.setAttribute(new nAttribute(attr, aStruct[attr]));
	}
}

// Warning management
// ------------------

nAttrMon.prototype.setWarnings = function(anArrayofWarnings) {
	for(var i in anArrayofWarnings) {
		this.listOfWarnings.setWarning(anArrayofWarnings[i]);
	}
}

nAttrMon.prototype.getWarnings = function(full) {
	if (full) {
		return this.listOfWarnings;
	} else {
		return this.listOfWarnings.getWarnings();
	}
}

nAttrMon.prototype.setNotified = function(aTitle, aId, aValue) {
	if (isUnDef(aValue)) aValue = true;
	if (isUnDef(aId)) throw "Please provide a setNotified id";
   
	var w = nattrmon.getWarnings(true).getNotificationByName(aTitle);
	if (isUnDef(w)) w = nattrmon.getWarnings(true).getWarningByName(aTitle)

	if (isUnDef(w)) throw "Warning '" + aTitle + "' not found."
	if (isDef(w.getData)) w = w.getData()
	
	if (isUnDef(w.notified)) w.notified = {};
	w.notified[aId] = aValue;

	// Set on a different channel if configured
	nattrmon.getWarnings(true).setNotificationByName(aTitle, w)
	return true; 
};

nAttrMon.prototype.isNotified = function(aTitle, aId) {
	if (isUnDef(aId)) throw "Please provide a setNotified id";

	// Get details from a different channel if configured
	var w
	if (isDef(__NAM_CHANNEL_WNOTS)) {
		w = $ch(this.chNotifications).get({ title: aTitle })
	} else {
		w = nattrmon.getWarnings(true).getWarningByName(aTitle)
	}
	if (isUnDef(w) || isUnDef(w.notified)) return false;
	return w.notified[aId];
};

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
	if (isString(aMap.select)) res = f.select(new Function("elem", "index", "array", aMap.select))
	if (isMap(aMap.select)) res = f.select(aMap.select)

	if (isUnDef(res) && isMap(aMap.selector)) res = (isString(aMap.selector.func) ? $$({}).set(aMap.selector.func, f[aMap.selector.func].apply(f, aMap.selector.args)) : res)
	if (isUnDef(res) && isUnDef(aMap.select)) res = f.select()

	return res
}

// Attribute values management
// ---------------------------

nAttrMon.prototype.getCurrentValues = function(full) {
	if (full) {
		return this.currentValues;
	} else {
		return ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true);
	}
}

nAttrMon.prototype.getLastValues = function(full) {
	if (full) {
		return this.lastValues;
	} else {
		return ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true);
	}
}

nAttrMon.prototype.getHistoryValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var attrHist = this.getSessionData("attribute.history");
	if (isUnDef(attrHist)) {
		this.debug("An attribute.history is not defined.");
		return {};
	} else {
		try {
			return attrHist.getValuesByTime(anAttributeName, howManySecondsAgo);
		} catch(e) {
			this.debug("Error getting historical values by time: " + e);
			return {};
		}
	}
}

nAttrMon.prototype.getHistoryValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var attrHist = this.getSessionData("attribute.history");
	if (isUnDef(attrHist)) {
		this.debug("An attribute.history is not defined.");
		return {};
	} else {
		try {
			return attrHist.getValuesByEvents(anAttributeName, howManyEventsAgo);
		} catch(e) {
			this.debug("Error getting historical values by events: " + e);
			return {};
		}
 	}
};

nAttrMon.prototype.posAttrProcessing = function (et, values) {
	var sortKeys;
	var toArray = _$(et.toArray).isMap("toArray needs to be a map. " + stringify(et,void 0,"")).default(void 0);
	var stamp = _$(et.aStamp).isMap("stamp needs to be a map. " + stringify(et,void 0,"")).default(void 0);
	sortKeys = _$(et.sortKeys).isMap("sort needs to be a map. " + stringify(et,void 0,"")).default(void 0);
	if (isDef(et.aSort) && isMap(et.aSort)) sortKeys = et.aSort;

	// Utilitary functions
	var sorting = (v) => {
		if (isDef(sortKeys)) {
			for(var key in v) {
				if (isDef(sortKeys[key]) && isArray(sortKeys[key]) && isArray(v[key])) {
					var temp = $from(v[key]);
					for(var iii in sortKeys[key]) {
						temp = temp.sort(sortKeys[key][iii]);
					}
					v[key].val = temp.select();
				}
			}
		} 
		return v;
	};

	// Stamp
	if (isDef(stamp)) {
		for(var key in values) {
			values[key] = merge(values[key], stamp);
		}
	}

	// Handle to array
	if (isDef(toArray) &&
		isDef(toArray.attrName)) {
		var aFutureValues = {};
		toArray.key = _$(toArray.key)
					.isString("toArray key needs to be a string. " + stringify(toArray,void 0,""))
					.default("key");
		toArray.attrName = _$(toArray.attrName)
						.isString("toArray attrName needs to be a string. " + stringify(toArray,void 0,""))
						.$_("to Array attrName needs to be provided. " + stringify(toArray,void 0,""));
		aFutureValues[toArray.attrName] = ow.obj.fromObj2Array(values, toArray.key);
		values = aFutureValues;
	}

	return sorting(values);
};

nAttrMon.prototype.addValues = function(onlyOnEvent, aOrigValues, aOptionals) {
	var count;

	aOptionals = _$(aOptionals).default({});
	
	if (isUnDef(aOrigValues) || isUnDef(aOrigValues.attributes)) return;
	var aMergeKeys = _$(aOptionals.mergeKeys).default(void 0);

	aMergeKeys = _$(aMergeKeys).isMap().default(void 0);

	var aValues = aOrigValues.attributes;
	aValues = this.posAttrProcessing(aOptionals, aValues);

	for(var key in aValues) {
		if (key.length > 0) {
			//aValues[key].name = key;

			if (!this.listOfAttributes.exists(key)) {
				this.setAttribute(key, key + " description");
			}

			this.listOfAttributes.touchAttribute(key);

			if(onlyOnEvent) {
				var av = this.currentValues.get({"name": key});
				if (isUnDef(av) ||
					//!(stringify((new nAttributeValue(av)).getValue(),__,"") == stringify(aValues[key]),__,"") ) {
					!compare((new nAttributeValue(av)).getValue(), (aValues[key])) ) {
					var newAttr = new nAttributeValue(key, aValues[key]);
					this.lastValues.set({"name": key}, (isDef(av) ? (new nAttributeValue(av)).getData() : (new nAttributeValue(key)).getData() )) ;
					if (isDef(aMergeKeys) && isDef(aMergeKeys[key])) {
						var t = newAttr.getData();
						if (isObject(t.val) && !(isArray(t.val))) { t.val = [ t.val ]; };
						if (isArray(t.val) && isDef(av)) {
							t.val = _.concat(_.reject(av.val, aMergeKeys[key]), t.val);
						}
						if (isUnDef(this.currentValues.getSet({"name": key}, {"name": key}, t))) this.currentValues.set({"name": key}, t);
					} else {
						this.currentValues.set({"name": key}, newAttr.getData());
					}
				}
			} else {
				var av = this.currentValues.get({"name": key});
				var newAttr = new nAttributeValue(key, aValues[key]);
				this.lastValues.set({"name": key}, (isDef(av) ? (new nAttributeValue(av)).getData() : (new nAttributeValue(key)).getData() ));
				if (isDef(aMergeKeys) && isDef(aMergeKeys[key])) {
					var t = newAttr.getData();
					if (isObject(t.val) && !(isArray(t.val))) { t.val = [ t.val ]; };
					if (isArray(t.val) && isDef(av)) {
						t.val = _.concat(_.reject(av.val, aMergeKeys[key]), t.val);
					}
					if (isUnDef(this.currentValues.getSet({"name": key}, {"name": key}, t))) this.currentValues.set({"name": key}, t);
				} else {
					this.currentValues.set({"name": key}, newAttr.getData());
				}
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
	return this.plugs;
};

nAttrMon.prototype.addSch = function(aName, aCronExpr, aFunc, waitForFinish) {
	if (isDef(this.schList[aName])) {
		this.sch.modifyEntry(this.schList[aName], aCronExpr, aFunc, waitForFinish);
	} else {
		var uuid = this.sch.addEntry(aCronExpr, aFunc, waitForFinish);
		this.schList[aName] = uuid;
	}

	return this.schList[aName];
};

nAttrMon.prototype.execPlugs = function(aPlugType) {
	var __cpucores = isDef(__NAM_WORKERS) ? __NAM_WORKERS : getNumberOfCores()

    for(var iPlug in this.plugs[aPlugType]) {
		try {
			var entry = this.plugs[aPlugType][iPlug];
			var parent = this;
			parent.thread = this.thread;

			var uuid;
			// Time based or initial meta for channel subscriber
			if (entry.aTime >= 0 || isDef(entry.chSubscribe)) {
				var f;
				if (entry.aTime >= 0) f = function(uuid) {
					var chpsi = new Date();
					try {
						var etry = parent.threadsSessions[uuid].entry;
						if (isDef(etry.getCron()) &&
							!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
							return false;
						}
						parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")");
						if (etry.waitForFinish && 
							$from($ch(parent.chPS).getAll())
							.equals("name", etry.getName())
							.equals("type", etry.type)
							.equals("uuid", uuid).any()) {
							return true;
						} else {
							if (__NAM_SLOWDOWN) {
								var _cd = $ch(parent.chPS).size() - (__cpucores)
								if (_cd > 1) {
									var _w = _cd * __NAM_SLOWDOWN_TIME
									if (__NAM_SLOWDOWN_WARNS) logWarn(etry.getName() + " | Slowing down in " + _w + "ms")
									sleep(_w, true)
								}
							}
						}

						$ch(parent.chPS).set({ name: etry.getName(), uuid: uuid, start: chpsi }, { name: etry.getName(), type: etry.type, uuid: uuid, start: chpsi });
						var res;
						if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
							$tb()
							.stopWhen(() => {
								sleep(500, true);
								if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
									logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)");
									return true;
								} else {
									return false;
								}
							})
							.exec(() => { res = etry.exec(parent); return res; });
						} else {
							res = etry.exec(parent);
						}	
						parent.addValues(etry.onlyOnEvent, res, { aStamp: etry.getStamp(), toArray: etry.getToArray(), mergeKeys: etry.getMerge(), sortKeys: etry.getSort() });
						parent.threadsSessions[uuid].count = now();
						etry.touch();
					} catch(e) {
						logErr(etry.getName() + " | " + e);
					} finally {
						$ch(parent.chPS).unset({ name: etry.getName(), uuid: uuid, start: chpsi });
					}

					return true;
				};

				try {
					if (entry.aTime > 0) {
						if (entry.waitForFinish) {
							this.debug("Starting with fixed rate for " + entry.getName() + " - " + entry.aTime);
							uuid = parent.thread.addScheduleThreadWithFixedDelay(f, entry.aTime);
						} else {
							this.debug("Starting at fixed rate for " + entry.getName() + " - " + entry.aTime);
							uuid = parent.thread.addScheduleThreadAtFixedRate(f, entry.aTime);
						}
					
						this.debug("Creating a thread for " + entry.getName() + " with uuid = " + uuid);
					} else {
						uuid = genUUID();
						if (isDef(entry.chSubscribe)) {
							this.debug("Creating subscriber for " + entry.getName() + " with uuid = " + uuid);
						}
					}

					parent.threadsSessions[uuid] = {
						"entry": this.plugs[aPlugType][iPlug],
						"count": now()
					};
					parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid;		

					// One-time execution
					if (entry.aTime == 0) f(uuid);		
				} catch(e) {
					logErr("Problem starting thread for '" + entry.getName() + "' (uuid " + uuid + "): " + String(e));
				}
			}

			// If not time based
			if (entry.aTime <= 0) {
				// If channel subscriber
				if (isDef(entry.chSubscribe)) {
					var subs = function(aUUID) { 
						return function(aCh, aOp, aK, aV) {		
							var chpsi = new Date();			
							var cont = false;
							try {
								var etry = parent.threadsSessions[aUUID].entry;
								if (isDef(etry.getAttrPattern())) {
									var gap = etry.getAttrPattern();
									if (isString(gap)) {
										gap = [ gap ];
									}
									var api = 0;
									while(api < gap.length && !cont) {
										cont = (new RegExp(gap[api])).test(aK.name);
										api++;
									}
								} else {
									cont = true;
								}
								if (cont) {
									if (etry.waitForFinish) {
										var _f = $from($ch(parent.chPS).getAll())
										         .equals("name", etry.getName())
										         .equals("type", etry.type)
										         .equals("uuid", uuid)
										if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) 
											_f = _f.where(r => ow.format.dateDiff.inMinutes(r.start) <= etry.killAfterMinutes)

										if (_f.any()) return true
									} else {
										if (__NAM_SLOWDOWN) {
											var _cd = $ch(parent.chPS).size() - (__cpucores)
											if (_cd > 1) {
												var _w = _cd * __NAM_SLOWDOWN_TIME
												if (__NAM_SLOWDOWN_WARNS) logWarn(etry.getName() + " | Slowing down in " + _w + "ms")
												sleep(_w, true)
											}
										}
									}

									if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
										var _f = $from($ch(parent.chPS).getAll())
										         .equals("name", etry.getName())
										         .equals("type", etry.type)
										         .where(r => ow.format.dateDiff.inMinutes(r.start) > etry.killAfterMinutes)
										$ch(parent.chPS).unsetAll(["name", "uuid", "start"], _f.select(r => {
											parent.debug("Old subscriber for '" + r.name + "' (uuid " + r.uuid + ") clean up...")
											return r
										}))
									}

									$ch(parent.chPS).set({ name: etry.getName(), uuid: aUUID, start: chpsi }, { name: etry.getName(), type: etry.type, uuid: aUUID, start: chpsi });
									parent.debug("Subscriber " + aCh + " on '" + etry.getName() + "' (uuid " + aUUID + ") ");
									var res;

									var execRes = (aobj, amap) => {
										var r;
										if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
											$tb()
											.stopWhen(() => {
												sleep(500, true);
												if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
													logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)");
													return true;
												} else {
													return false;
												}
											})
											.exec(() => { r = etry.exec(aobj, amap); return true; });
										} else {
											r = etry.exec(aobj, amap);
										}
										
										return r;
									};

									if (etry.chHandleSetAll && aOp == "setall") {
										res = [];
										for(var ii in aV) {
											var r = execRes(parent, { ch: aCh, op: "set", k: ow.obj.filterKeys(aK, aV[ii]), v: aV[ii] });
											if (isArray(r)) {
												res = res.concat(r);
											} else {
												if (isObject(r)) {
													res.push(r);
												}
											}
										}
									} else {
										res = execRes(parent, { ch: aCh, op: aOp, k: aK, v: aV });
									}
									parent.addValues(etry.onlyOnEvent, res, { aStamp: etry.getStamp(), toArray: etry.getToArray(), mergeKeys: etry.getMerge(), sortKeys: etry.getSort() });
									parent.threadsSessions[aUUID].count = now();
									etry.touch();
								}
							} catch(e) {
								logErr(etry.getName() + " | " + e);
							} finally {
								if (cont) $ch(parent.chPS).unset({ name: etry.getName(), uuid: aUUID, start: chpsi });
							}
						};
					};
					if (isArray(entry.chSubscribe)) {
						for(var i in entry.chSubscribe) {
							this.debug("Subscribing " + entry.chSubscribe + " for " + entry.getName() + "...");
							$ch(entry.chSubscribe).subscribe(subs(uuid));
						}
					} else {
						this.debug("Subscribing " + entry.chSubscribe + " for " + entry.getName() + "...");
						$ch(entry.chSubscribe).subscribe(subs(uuid));
					}
				} else {
				    // If cron based
					if (isDef(entry.getCron())) {
						var f = function(uuid) {
							try {
								var etry = parent.threadsSessions[uuid].entry;
								if (isDef(etry.getCron()) &&
									!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
									return false;
								}
								parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")");
								var chpsi = new Date();
								if (etry.waitForFinish && 
									$from($ch(parent.chPS).getAll())
						    		.equals("name", etry.getName())
							        .equals("type", etry.type)
							        .equals("uuid", uuid).any()) {
									parent.debug("Already executing '" + etry.getName() + "' (" + uuid +")");
								    return true;
								} else {
									if (__NAM_SLOWDOWN) {
										var _cd = $ch(parent.chPS).size() - (__cpucores)
										if (_cd > 1) {
											var _w = _cd * __NAM_SLOWDOWN_TIME
											if (__NAM_SLOWDOWN_WARNS) logWarn(etry.getName() + " | Slowing down in " + _w + "ms")
											sleep(_w, true)
										}
									}
								}

								$ch(parent.chPS).set({ name: etry.getName(), uuid: uuid, start: chpsi }, { name: etry.getName(), type: etry.type, uuid: uuid, start: chpsi });
								var res;
								if (isDef(etry.killAfterMinutes) && isNumber(etry.killAfterMinutes)) {
									$tb()
									.stopWhen(() => {
										sleep(500, true);
										if (ow.format.dateDiff.inMinutes(chpsi) >= etry.killAfterMinutes) {
											logErr("Stopping " + etry.getName() + " due to timeout (executed for more than " + ow.format.dateDiff.inMinutes(chpsi) + " minutes)");
											return true;
										} else {
											return false;
										}
									})
									.exec(() => { res = etry.exec(parent); return true; });
								} else {
									res = etry.exec(parent);
								}							
								$ch(parent.chPS).unset({ name: etry.getName(), uuid: uuid, start: chpsi });
								parent.addValues(etry.onlyOnEvent, res, { aStamp: etry.getStamp(), toArray: etry.getToArray(), mergeKeys: etry.getMerge(), sortKeys: etry.getSort() });
								parent.threadsSessions[uuid].count = now();
								etry.touch();
							} catch(e) {
								logErr(etry.getName() + " | " + e);
							} finally {
								$ch(parent.chPS).unset({ name: etry.getName(), uuid: uuid, start: chpsi });
							}
				
							return true;
						};

						uuid = this.addSch(entry.getName(), entry.getCron(), f, entry.getWaitForFinish());
						parent.threadsSessions[uuid] = {
							"entry": this.plugs[aPlugType][iPlug],
							"count": now()
						};
						parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid;
					} else {
						this.debug("Muting " + entry.getName() + "' (uuid + " + uuid + ") ");
					}
				}
			}
		} catch(e) {
			logErr("Error loading plug: " + aPlugType + "::" + stringify(this.plugs[aPlugType][iPlug], void 0, "") + " | " + stringify(e));
		}
    }
};

nAttrMon.prototype.addPlug = function(aPlugType, aInputMeta, aObject, args) {
    if (isUnDef(this.plugs[aPlugType])) {
        this.plugs[aPlugType] = [];
    }

	if (isUnDef(aInputMeta.type)) aInputMeta.type = aPlugType;

    var plug = new nPlug(aInputMeta, args, aObject);

    var anyPlug = $from(this.plugs[aPlugType]).equals("aName", plug.getName()).equals("aCategory", plug.getCategory());
    if (anyPlug.any()) {
    	var i = this.plugs[aPlugType].indexOf(anyPlug.select()[0]);
    	this.plugs[aPlugType][i] = plug;
    	if (isDef(this.indexPlugThread[plug.getCategory() + "/" + plug.getName()]))
    		this.threadsSessions[this.indexPlugThread[plug.getCategory() + "/" + plug.getName()]].entry = plug;
    } else {
    	this.plugs[aPlugType].push(plug);
    }
    this.debug("Added plug " + plug.getName());
};

nAttrMon.prototype.addInput = function(aInputMeta, aInputObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGINPUTS])) {
		var plug = $from(nattrmon.plugs[this.PLUGINPUTS]).equals("aName", aInputMeta.name);
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGINPUTS + "::" + aInputMeta.name);
			plug.at(0).close();
			logWarn("Reloading plug " + this.PLUGINPUTS + "::" + aInputMeta.name);
		}
	}
	this.addPlug(this.PLUGINPUTS, aInputMeta, aInputObject, args);
};

nAttrMon.prototype.addOutput = function(aOutputMeta, aOutputObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGOUTPUTS])) {
		var plug = $from(nattrmon.plugs[this.PLUGOUTPUTS]).equals("aName", aOutputMeta.name);
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGOUTPUTS + "::" + aOutputMeta.name);
			plug.at(0).close();
			logWarn("Reloading plug " + this.PLUGOUTPUTS + "::" + aOutputMeta.name);
		}	
	}
	this.addPlug(this.PLUGOUTPUTS, aOutputMeta, aOutputObject, args);
};

nAttrMon.prototype.addValidation = function(aValidationMeta, aValidationObject, args) {
	if (isDef(nattrmon.plugs[this.PLUGVALIDATIONS])) {
		var plug = $from(nattrmon.plugs[this.PLUGVALIDATIONS]).equals("aName", aValidationMeta.name);
		if (plug.any()) {
			logWarn("Stopping plug " + this.PLUGVALIDATIONS + "::" + aValidationMeta.name);
			plug.at(0).close();
			logWarn("Reloading plug " + this.PLUGVALIDATIONS + "::" + aValidationMeta.name);
		}	
	}
	this.addPlug(this.PLUGVALIDATIONS, aValidationMeta, aValidationObject, args);
};

nAttrMon.prototype.loadPlugs = function() {
	var parent = this;

	var getIgnoreList = (d) => {
		var res = [];
		if (io.fileExists(d + "/.nattrmonignore")) {
			var t = io.readFileAsArray(d + "/.nattrmonignore")
			res = $from(t).notStarts("#").notEquals("").match("[a-zA-Z0-9]+").select((r) => {
				var f = javaRegExp(javaRegExp(d + "/" + r).replace("(.+)( +#+.*)", "$1")).replaceAll("\\\\#", "#").trim();
				return f;
			});
		} else {
			res = [];
		}

		if (io.fileExists(d + "/nattrmonignore.js")) {
			log("Executing '" + d + "/nattrmonignore.js'...");
			try {
				var fn = require(d + "/nattrmonignore.js");
				if (isUnDef(fn.getIgnoreList) || !isFunction(fn.getIgnoreList)) {
					logErr("nattrmonignore.js doesn't have a getIgnoreList function.");
				} else {
					var tmpRes = fn.getIgnoreList();
					tmpRes.forEach((r) => {
						var f = javaRegExp(javaRegExp(d + "/" + r).replace("(.+)( +#+.*)", "$1")).replaceAll("\\\\#", "#").trim();
						res.push(f);
					});
				}
			} catch(e) {
				logErr("Problem with nattrmonignore.js: " + String(e));
			}
		}

		return res;
	};

	var ignoreList = getIgnoreList(this.configPath);
	this.ignoreList = ignoreList;
	parent.debug("Ignore list: " + stringify(ignoreList));

	var newCoreObjects = [];
	if (isDef(getOPackPath("nAttrMon"))) newCoreObjects.push(getOPackPath("nAttrMon") + "/config/objects");
	if (io.fileExists(this.configPath + "/objects")) newCoreObjects.push(this.configPath + "/objects");
	if (isDef(__NAM_COREOBJECTS)) newCoreObjects = newCoreObjects.concat(__NAM_COREOBJECTS.split(",").map(r=>templify(r.trim(), getOPackPaths())));
	__NAM_COREOBJECTS = newCoreObjects.join(",");
	parent.debug("_NAM_COREOBJECTS resolved to '" + __NAM_COREOBJECTS + "'");

	if (!__NAM_COREOBJECTS_LAZYLOADING) {
		if (isDef(__NAM_COREOBJECTS)) {
			var pthis = this;
			__NAM_COREOBJECTS.split(",", co => {
				pthis.loadPlugDir(__NAM_COREOBJECTS, "objects", ignoreList);
			});
		} else {
			this.loadPlugDir(this.configPath + "/objects", "objects", ignoreList);
		}
	} else {
		this.objectsPath = {};
		var parent = this;
		if (isDef(__NAM_COREOBJECTS)) {
			__NAM_COREOBJECTS.split(",").forEach(co => {
				$from(listFilesRecursive(__NAM_COREOBJECTS))
				.equals("isFile", true)
				.sort("canonicalPath")
				.select(r => { 
					parent.objectsPath[r.filename] = r.filepath;
				});
			});

		} else {
			$from(listFilesRecursive(this.configPath + "/objects"))
			.equals("isFile", true)
			.sort("canonicalPath")
			.select(r => { 
				parent.objectsPath[r.filename] = r.filepath;
			});
		}
	}

	if (!__NAM_NOPLUGFILES) {
		var loadOrder = __NAM_PLUGSORDER.split(",")
		var loadedInputs = false, loadedOutputs = false, loadedValidations = false
		loadOrder.forEach(item => {
			switch(item.toLowerCase().trim()) {
			case "inputs":
				this.loadPlugDir(this.configPath + "/inputs", "inputs", ignoreList)
				loadedInputs = true	
				break
			case "outputs":
				this.loadPlugDir(this.configPath + "/outputs", "outputs", ignoreList)
				loadedOutputs = true
				break
			case "validations":
				this.loadPlugDir(this.configPath + "/validations", "validations", ignoreList)
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
	if (isUnDef(yy.args)) yy.args = {};
	if (isDef(yy.exec))
		switch (type) {
			case "input"     : yy.exec = new nInput(new Function("var scope = arguments[0]; var args = arguments[1]; " + yy.exec)); break;
			case "output"    : yy.exec = new nOutput(new Function("var scope = arguments[0]; var args = arguments[1]; " + yy.exec)); break;
			case "validation": yy.exec = new nValidation(new Function("var warns = arguments[0]; var scope = arguments[1]; var args = arguments[2]; " + yy.exec)); break;
		}
	if (isUnDef(yy.execArgs)) yy.execArgs = {};
	//if (!(isArray(yy.execArgs))) yy.execArgs = yy.execArgs;
	if (isDef(yy.execFrom)) {
	    var notFound = false;
		if (__NAM_COREOBJECTS_LAZYLOADING && type != "objects") {
			var aPath;
			if (isDef(__NAM_COREOBJECTS)) {
				__NAM_COREOBJECTS.split(",").forEach(co => {
					var pt = co + "/" + yy.execFrom + ".js";
					if (io.fileExists(pt)) aPath = pt;
				});
			} else {
				aPath = this.configPath + "/objects/" + yy.execFrom + ".js";
			}
			if (isUnDef(aPath)) {
				notFound = true;
			} else {
				if (isDef(aPath) && !(this.isOnIgnoreList(aPath))) {
					if (isDef(aPath)) {
						this.debug("Lazy loading object " + aPath);
						this.loadPlug(aPath, "objects", this.ignoreList);
					} 
				}
			}
		}
		if (!notFound) {
			var o = eval(yy.execFrom);
			yy.exec = Object.create(o.prototype);
			if (isMap(yy.execArgs) && isString(yy.execArgs.secKey)) yy.execArgs = __nam_getSec(yy.execArgs, yy.execArgs.secOut);
			o.apply(yy.exec, [yy.execArgs]);
		} else {
			logErr("Object '"+ yy.execFrom + "' couldn't be found (configPath='" + this.configPath + "'; COREOBJECTS='" + __NAM_COREOBJECTS + "')");
		}
	}

	return yy;
}

nAttrMon.prototype.loadPlugDir = function(aPlugDir, aPlugDesc, ignoreList) {
    var files = io.listFiles(aPlugDir).files;

    var dirs = [];
    var plugsjs = [];

    for(var i in files) {
		if (!files[i].filename.startsWith(".")) {
			if(files[i].isFile) {
				plugsjs.push(files[i].filepath);
			} else {
				dirs.push(files[i].filepath);
			}
		}
    }

    dirs = dirs.sort();
    plugsjs = plugsjs.sort();

    for (var i in dirs) {
		var inc = true;
		for(var ii in ignoreList) { 
			if (dirs[i].indexOf(ignoreList[ii]) == 0 || 
			    dirs[i].match(new RegExp("^" + ignoreList[ii] + "$"))) inc = false; }
        if (inc) { this.loadPlugDir(dirs[i], aPlugDesc, ignoreList); } else { 
			logWarn("ignoring " + dirs[i]); 
			this.ignoreList.push(dirs[i]);
		}
    }

    for (var i in plugsjs) {
		var inc = true;
		for(var ii in ignoreList) { 
			if (plugsjs[i].indexOf(ignoreList[ii]) == 0 || 
			    plugsjs[i].match(new RegExp("^" + ignoreList[ii] + "$"))) inc = false; }		
		if (inc) { this.loadPlug(plugsjs[i], aPlugDesc, ignoreList); } else { 
			logWarn("ignoring " + plugsjs[i]);
			this.ignoreList.push(plugsjs[i]);
		}
    }
};

nAttrMon.prototype.isOnIgnoreList = function(aPath, ignoreList) {
	_$(aPath, "path").isString().$_();

	var inc = false;
	for(var ii in ignoreList) { 
		if (aPath.indexOf(ignoreList[ii]) == 0 || 
			aPath.match(new RegExp("^" + ignoreList[ii] + "$"))) inc = true; }

	return inc;
};

nAttrMon.prototype.loadPlug = function (aPlugFile, aPlugDesc, ignoreList) {
	if (isUnDef(aPlugDesc)) aPlugDesc = "";

	if (aPlugFile.match(/\.js$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile);
		try {
			if (__NAM_COREOBJECTS_LAZYLOADING && aPlugDesc != "objects") {
				var str = io.readFileString(aPlugFile);
				try {
					var ars = str.match(/new (nInput|nOutput|nValidation)([^\(]+)\(/g);
					for (var ii in ars) {
						var ar = ars[ii].match(/new (nInput|nOutput|nValidation)([^\(]+)\(/);
						if (isDef(ar) && isDef(ar[1]) && isDef(ar[2])) {
							var p = this.objectsPath[ar[1] + ar[2] + ".js"];

							if (!(this.isOnIgnoreList(p))) {
								this.debug("Lazy loading object " + p);
								this.loadPlug(p, "objects", ignoreList);
							}
						}
					}
				} catch(e) {
					logErr("Problem on object lazy loading triggered by '" + aPlugFile + "': " + String(e));
				}
			}
			if (this.debugFlag && isDef(ow.loadDebug)) {
				ow.debug.load(aPlugFile)
			} else {
				af.load(aPlugFile)
			}
		} catch (e) {
			logErr("Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e);
		}
	}
	if (aPlugFile.match(/\.yaml$/) || aPlugFile.match(/\.json$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile);
		try {
			var y;
			if (aPlugFile.match(/\.yaml$/))
			   y = io.readFileYAML(aPlugFile, true);
			else
			   y = io.readFileJSON(aPlugFile);

			var parent = this;

			function __handlePlug(yyy, type, parent) {
				var yy = parent.loadObject(yyy, type);

				switch (type) {
					case "input": parent.addInput(yy, yy.exec); break;
					case "output": parent.addOutput(yy, yy.exec); break;
					case "validation": parent.addValidation(yy, yy.exec); break;
				}
			}

			var procY = yy => {
				if (isDef(yy.input))
					if (isArray(yy.input))
						yy.input.forEach(function (yo) { __handlePlug(yo, "input", parent) });
					else
						__handlePlug(yy.input, "input", parent);
				if (isDef(yy.output))
					if (isArray(yy.output))
						yy.output.forEach(function (yo) { __handlePlug(yo, "output", parent) });
					else
						__handlePlug(yy.output, "output", parent);
				if (isDef(yy.validation))
					if (isArray(yy.validation))
						yy.validation.forEach(function (yo) { __handlePlug(yo, "validation", parent) });
					else
						__handlePlug(yy.validation, "validation", parent);
			}

			if (isArray(y)) y.forEach(procY); else procY(y);

		} catch (e) {
			logErr("Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e);
		}
	}
}

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
				var kube = new Kube(aOptions.url, aOptions.user, aOptions.pass, aOptions.wsTimeout, aOptions.token)
				res = kube.exec(aOptions.namespace, aOptions.pod, cmd, this.timeout)
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
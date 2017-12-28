// Initialization
var LOGHK_HOWLONGAGOINMINUTES = 30 * 24 * 60; // How long to keep logs
var LOGAUDIT = true; // Set to false to turn it off
var LOGAUDIT_TEMPLATE = "AUDIT | User: {{request.user}} | Channel: {{name}} | Operation: {{op}} | Key: {{{key}}}";

// -------------------------------------------------------------------

// check version
af.getVersion() >= "20170101" || (print("Version " + af.getVersion() + ". You need OpenAF version 20170101 to run.")) || exit(-1);

var NATTRMON_HOME = getOPackPath("nAttrMon") || ".";
//var NATTRMON_HOME = ".";

// Auxiliary objects
load(NATTRMON_HOME + "/lib/nattribute.js");
load(NATTRMON_HOME + "/lib/nattributevalue.js");
load(NATTRMON_HOME + "/lib/nattributes.js");
load(NATTRMON_HOME + "/lib/nmonitoredobject.js");
load(NATTRMON_HOME + "/lib/nplug.js");
load(NATTRMON_HOME + "/lib/ninput.js");
load(NATTRMON_HOME + "/lib/noutput.js");
load(NATTRMON_HOME + "/lib/nwarning.js");
load(NATTRMON_HOME + "/lib/nwarnings.js");
load(NATTRMON_HOME + "/lib/nvalidation.js");

ow.loadServer();
ow.loadObj(); 
ow.loadFormat(); 
ow.loadTemplate();
ow.template.addFormatHelpers();
ow.template.addConditionalHelpers();
loadLodash(); 

// nAttrMon template helpers -----------------------------------------------------------------
// -------------------------------------------------------------------------------------------

ow.template.addHelper("attr", (a, p) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getAttributes().getAttributeByName(a);
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return res;
	} else {
		return null;
	}
});
ow.template.addHelper("cval", (a, p) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getCurrentValues(true).get({ name: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return res;
	} else {
		return null;
	}
});
ow.template.addHelper("lval", (a, p) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getLastValues(true).get({ name: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return res;
	} else {
		return null;
	}
});
ow.template.addHelper("warn", (a, p) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getWarnings(true).get({ title: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return res;
	} else {
		return null;
	}
});

ow.template.addHelper("debug", (s) => { sprint(s); });

// Main object ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var nAttrMon = function(aConfigPath, debugFlag) {
	plugin("Threads");

	this.chCurrentValues = "nattrmon::cvals";
	this.chLastValues = "nattrmon::lvals";

	$ch(this.chCurrentValues).create();
	$ch(this.chLastValues).create();
	this.currentValues    = $ch(this.chCurrentValues);
	this.lastValues       = $ch(this.chLastValues);

	this.configPath       = (isUnDef(aConfigPath)) ? "." : aConfigPath;
	this.listOfAttributes = new nAttributes();
	this.listOfWarnings   = new nWarnings();
	this.count            = now();
	this.countCheck       = 30000; // shouldn't be very aggresive
	this.debugFlag        = (isUnDef(debugFlag)) ? false : debugFlag;

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

	var nattrmon = this;

	// Start logging
	io.mkdir(aConfigPath + "/log");
	ow.ch.utils.setLogToFile({
		logFolder: aConfigPath + "/log",
		HKhowLongAgoInMinutes: LOGHK_HOWLONGAGOINMINUTES,
		numberOfEntriesToKeep: 10,
		setLogOff            : true
	});

	if (LOGAUDIT) {
		ow.ch.server.setLog(function(aMap) {
			aMap = merge(aMap, { key: stringify(jsonParse(aMap.request.uri.replace(/.+({[^}]+}).*/, "$1").replace(/&quot;/g, "\'")),undefined,"").replace(/\"/g, "") });
			tlog(LOGAUDIT_TEMPLATE, aMap);
		});
	}

	print(new Date() + " | Starting log to " + aConfigPath + "/log");

	// date checks
	this.currentValues.subscribe((new nAttributeValue()).convertDates);
	this.lastValues.subscribe((new nAttributeValue()).convertDates);
	this.listOfAttributes.getCh().subscribe((new nAttribute()).convertDates);
    this.listOfWarnings.getCh().subscribe((new nWarning()).convertDates);
   
    // persistence
	this.currentValues.storeAdd(this.getConfigPath() + "/nattrmon.cvals.snapshot", [ "name" ], true);
	this.lastValues.storeAdd(this.getConfigPath() + "/nattrmon.lvals.snapshot", [ "name" ], true);
	this.listOfAttributes.getCh().storeAdd(this.getConfigPath() + "/nattrmon.attrs.snapshot", [ "name" ], true);
	this.listOfWarnings.getCh().storeAdd(this.getConfigPath() + "/nattrmon.warns.snapshot", [ "title" ], true);
};

nAttrMon.prototype.getConfigPath = function() {
	return this.configPath;
};

// Snapshot functions
// ------------------

nAttrMon.prototype.genSnapshot = function() {
	var mainpath = this.getConfigPath();
	var snapshot = {
		currentValues: ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true),
		lastValues: ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true),
		listOfAttributes: this.listOfAttributes.getAttributes(true),
		listOfWarnings: this.listOfWarnings.getWarnings(true)
	}
	io.writeFileBytes(mainpath + "/nattrmon.snapshot", compress(snapshot));
}

// Session function
// ----------------

nAttrMon.prototype.setSessionData = function(aKey, aObject) {
	this.sessionData[aKey] = aObject;
}

nAttrMon.prototype.getSessionData = function(aKey) {
	return this.sessionData[aKey];
}

nAttrMon.prototype.hasSessionData = function(aKey) {
	if(isUnDef(this.getSessionData(aKey))) {
		return false;
	} else {
		return true;
	}
}

// Debug functions
// ---------------
nAttrMon.prototype.setDebug = function(aDebugFlag) {
	this.debugFlag = aDebugFlag;
}

// Monitored objects
// -----------------

nAttrMon.prototype.addMonitoredObject = function(aKey, anObject) {
	this.monitoredObjects[aKey] = new nMonitoredObject(aKey, anObject);
	return this.getMonitoredObject(aKey);
}

nAttrMon.prototype.getMonitoredObject = function(aKey) {
  	if (this.hasMonitoredObject(aKey))
		return this.monitoredObjects[aKey].getObject();
}

nAttrMon.prototype.hasMonitoredObject = function(aKey) {
	if(isUnDef(this.monitoredObjects[aKey])) {
		return false;
	} else {
		return true;
	}
}

nAttrMon.prototype.monitoredObjectsTest = function() {
	for(var o in this.monitoredObjects) {
		this.monitoredObjects[o].test();
	}
}

/**
 * [declareMonitoredObjectDirty description]
 * @param  {[type]} aKey [description]
 * @return {[type]}      [description]
 */
nAttrMon.prototype.declareMonitoredObjectDirty = function(aKey) {
	this.monitoredObjects[aKey].setDirty();
	this.monitoredObjects[aKey].test();
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
		return true;
	else
		return false;
}

/**
 * <odoc>
 * <key>nattrmon.addObjectPool(aKey, aOWObjPool, aCat)</key>
 * Given a aOWObjPool (created, but not started, from ow.obj.pool) starts it and adds it to nattrmon
 * with the provided aKey. Later objects can be requested and returned using nattrmon.leaseObject and
 * nattrmon.returnObject. Optionally you can provide a aCat category.
 * </odoc>
 */
nAttrMon.prototype.addObjectPool = function(aKey, aOWObjPool, aCat) {
	this.objPools[aKey] = aOWObjPool.start();
	this.objPoolsCat[aKey] = aCat;
	this.objPoolsAssociations[aKey] = {};
}

/**
 * <odoc>
 * <key>nattrmon.getObjectPool(aKey) : Object</key>
 * Returns the object pool for the provided aKey.
 * </odoc>
 */
nAttrMon.prototype.getObjectPool = function(aKey) {
	return this.objPools[aKey];
}

nAttrMon.prototype.delObjectPool = function(aKey) {
    this.objPools[aKey].stop();
	//deleteFromArray(this.objPools, this.objPools.indexOf(aKey));
	delete this.objPools[aKey];
	delete this.objPoolsCat[aKey];
	delete this.objPoolsAssociations[aKey];
}

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
}

/**
 * <odoc>
 * <key>nattrmon.leaseObject(aKey) : Object</key>
 * Ask the object pool associated with aKey for an object instance to be used.
 * </odoc>
 */
nAttrMon.prototype.leaseObject = function(aKey) {
	return this.objPools[aKey].checkOut();
}

/**
 * <odoc>
 * <key>nattrmon.returnObject(aKey, anObj, aStatus)</key>
 * Returns an object that was previsouly leased using nattrmon.leaseObject for the object pool associated with aKey
 * providing aStatus (false = obj should be thrown away).
 * </odoc>
 */
nAttrMon.prototype.returnObject = function(aKey, anObj, aStatus) {
	return this.objPools[aKey].checkIn(anObj, aStatus);
}

/**
 * <odoc>
 * <key>nattrmon.useObject(aKey, aFunction)</key>
 * Given aFunction will pass it, as an argument, an object instance to be used from the object pool associated with aKey.
 * If aFunction throws anException or returns false the provided object instance will be thrown away.
 * </odoc>
 */
nAttrMon.prototype.useObject = function(aKey, aFunction) {
	return this.objPools[aKey].use(aFunction);
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

// System functions
// ----------------

nAttrMon.prototype.debug = function(aMessage) {
	if(this.debugFlag) {
		ansiStart();
		log(ansiColor("BG_YELLOW,BLACK", "DEBUG | " + aMessage));
		ansiStop();
	}
}

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
	this.debug("nAttrMon exec input plugs");
	this.execPlugs(this.PLUGINPUTS);
	this.debug("nAttrMon exec output plugs");
	this.execPlugs(this.PLUGOUTPUTS);
	this.debug("nAttrMon exec validation plugs");
	this.execPlugs(this.PLUGVALIDATIONS);

	this.debug("nAttrMon restoring snapshot");
}

nAttrMon.prototype.stop = function() {
	this.debug("nAttrMon stoping.");
	for(var i in this.threads) {
		this.threads[i].stop(true);
	}

	for(var i in this.threads) {
		this.threads[i].waitForThreads(1000);
	}

	//this.genSnapshot();
	this.stopObjects();
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
	restartOpenAF();
}

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
}

nAttrMon.prototype.addValues = function(onlyOnEvent, aOrigValues) {
	var count;

	if (isUnDef(aOrigValues) || isUnDef(aOrigValues.attributes)) return;

	var aValues = aOrigValues.attributes;

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
					!(stringify((new nAttributeValue(av)).getValue()) == stringify(aValues[key])) ) {
					var newAttr = new nAttributeValue(key, aValues[key]);
					this.lastValues.set({"name": key}, (isDef(av) ? (new nAttributeValue(av)).getData() : (new nAttributeValue(key)).getData() )) ;
					//this.lastValues[key] = (isUnDef(this.currentValues[key])) ? new nAttributeValue() : this.currentValues[key].clone();
					this.currentValues.set({"name": key}, newAttr.getData());
					//this.currentValues[key] = newAttr;
				}
			} else {
				var av = this.currentValues.get({"name": key});
				var newAttr = new nAttributeValue(key, aValues[key]);
				this.lastValues.set({"name": key}, (isDef(av) ? (new nAttributeValue(av)).getData() : (new nAttributeValue(key)).getData() ));
				//this.lastValues[key] = (isUnDef(this.currentValues[key])) ? new nAttributeValue() : this.currentValues[key].clone();
				this.currentValues.set({"name": key}, newAttr.getData());
				//this.currentValues[key] = newAttr;
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
}

nAttrMon.prototype.execPlugs = function(aPlugType) {
    for(var iPlug in this.plugs[aPlugType]) {
    	var entry = this.plugs[aPlugType][iPlug];
    	var thread = new Threads();
    	var parent = this;
    	parent.thread = thread;

        var uuid = thread.addThread(function(uuid) {
        	try {
        		var etry = parent.threadsSessions[uuid].entry;
        		if (isDef(etry.getCron()) &&
        			!(ow.format.cron.isCronMatch(new Date(), etry.getCron()))) {
        			return false;
        		}
        		parent.debug("Executing '" + etry.getName() + "' (" + uuid + ")");
        		var res = etry.exec(parent);
    			parent.addValues(etry.onlyOnEvent, res);
				parent.threadsSessions[uuid].count = now();
				etry.touch();
    		} catch(e) {
    			logErr(etry.getName() + " | " + e);
    		}

    		return true;
		});
		this.debug("Creating a thread for " + entry.getName() + " with uuid = " + uuid);

        parent.threadsSessions[uuid] = {
    		"entry": this.plugs[aPlugType][iPlug],
    		"count": now()
    	};
    	parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid;

		if (entry.aTime > 0) {
			try {
				if (entry.waitForFinish) {
					this.debug("Starting with fixed rate for " + entry.getName() + " - " + entry.aTime);
					thread.startWithFixedRate(entry.aTime);
				} else {
					this.debug("Starting at fixed rate for " + entry.getName() + " - " + entry.aTime);
					thread.startAtFixedRate(entry.aTime);
				}
			} catch(e) {
				logErr("Problem starting thread for '" + entry.getName() + "' (uuid " + uuid + ") ");
			}
		} else {
			if (isDef(entry.chSubscribe)) {
				var subs = function(aUUID) { 
					return function(aCh, aOp, aK, aV) {					
						try {
							var etry = parent.threadsSessions[aUUID].entry;
							parent.debug("Subscriber " + aCh + " on '" + etry.getName() + "' (uuid " + aUUID + ") ");
							var res = etry.exec(parent, { ch: aCh, op: aOp, k: aK, v: aV });
							parent.addValues(etry.onlyOnEvent, res);
							parent.threadsSessions[aUUID].count = now();
							etry.touch();
						} catch(e) {
							logErr(etry.getName() + " | " + e);
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
				this.debug("Muting " + entry.getName() + "' (uuid + " + uuid + ") ");
			}
		}

     	this.threads.push(thread);
     	this.debug("Number of threads: " + this.threads.length);
    }
}

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
	this.loadPlugDir(this.configPath + "/objects", "objects");
	this.loadPlugDir(this.configPath + "/inputs", "inputs");
	this.loadPlugDir(this.configPath + "/validations", "validations");
	this.loadPlugDir(this.configPath + "/outputs", "outputs");
};

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
		var o = eval(yy.execFrom);
		yy.exec = Object.create(o.prototype);
		o.apply(yy.exec, [yy.execArgs]);
	}

	return yy;
}

nAttrMon.prototype.loadPlugDir = function(aPlugDir, aPlugDesc) {
    var files = io.listFiles(aPlugDir).files;

    var dirs = [];
    var plugsjs = [];

    for(var i in files) {
        if(files[i].isFile) {
            plugsjs.push(files[i].filepath);
        } else {
            dirs.push(files[i].filepath);
        }
    }

    dirs = dirs.sort();
    plugsjs = plugsjs.sort();

    for (var i in dirs) {
        this.loadPlugDir(dirs[i], aPlugDesc);
    }

    for (var i in plugsjs) {
		this.loadPlug(plugsjs[i], aPlugDesc);	
    }
}

nAttrMon.prototype.loadPlug = function (aPlugFile, aPlugDesc) {
	if (isUnDef(aPlugDesc)) aPlugDesc = "";

	if (aPlugFile.match(/\.js$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile);
		try {
			af.load(aPlugFile);
		} catch (e) {
			logErr("Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e);
		}
	}
	if (aPlugFile.match(/\.yaml$/) || aPlugFile.match(/\.json$/)) {
		if (aPlugDesc != "objects") log("Loading " + aPlugDesc + ": " + aPlugFile);
		try {
			var y;
			if (aPlugFile.match(/\.yaml$/))
			   y = io.readFileYAML(aPlugFile);
			else
			   y = io.readFile(aPlugFile);

			var parent = this;

			function __handlePlug(yyy, type, parent) {
				var yy = parent.loadObject(yyy, type);

				switch (type) {
					case "input": parent.addInput(yy, yy.exec); break;
					case "output": parent.addOutput(yy, yy.exec); break;
					case "validation": parent.addValidation(yy, yy.exec); break;
				}
			}

			if (isDef(y.input))
				if (isArray(y.input))
					y.input.forEach(function (yo) { __handlePlug(yo, "input", parent) });
				else
					__handlePlug(y.input, "input", parent);
			if (isDef(y.output))
				if (isArray(y.output))
					y.output.forEach(function (yo) { __handlePlug(yo, "output", parent) });
				else
					__handlePlug(y.output, "output", parent);
			if (isDef(y.validation))
				if (isArray(y.validation))
					y.validation.forEach(function (yo) { __handlePlug(yo, "validation", parent) });
				else
					__handlePlug(y.validation, "validation", parent);
		} catch (e) {
			logErr("Error loading " + aPlugDesc + " (" + aPlugFile + "): " + e);
		}
	}
}

// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var params = processExpr();
var nattrmon;

if (isUnDef(params.withDirectory)) {
	nattrmon = new nAttrMon(NATTRMON_HOME + "/config", params.debug);
} else {
	nattrmon = new nAttrMon(params.withDirectory, params.debug);
}

var __sleepperiod = 60000; // less aggressive
var __stuckfactor = 500;

// Option stop
if (isDef(params.stop)) {
        pidKill(ow.server.getPid(NATTRMON_HOME + "/nattrmon.pid"));
        exit(1);
}

ow.server.checkIn(NATTRMON_HOME + "/nattrmon.pid", function(aPid) {
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
log("nAttrMon started.");

ow.server.daemon(__sleepperiod, function() {
	// Check main health
	if ( (now() - nattrmon.count) >= (nattrmon.countCheck * __stuckfactor) ) {
		log("nAttrmon seems to be stuck.");
		log("nAttrMon restarting process!!");
		nattrmon.stop();
		restartOpenAF();
	}

	// Check all threads
	for(var uuid in nattrmon.threadsSessions) {
		if ( nattrmon.threadsSessions[uuid].entry.aTime > 0 && (now() - nattrmon.threadsSessions[uuid].count) >= (nattrmon.threadsSessions[uuid].entry.aTime * __stuckfactor) ) {
			log("nAttrmon found a stuck thread (" + uuid + " for '" + nattrmon.threadsSessions[uuid].entry.getName() + "')");
			log("nAttrMon restarting process!!");
			nattrmon.stop();
			restartOpenAF();
		}
	}
});
nattrmon.stop();

log("nAttrMon stopped.");
print(new Date() + " | Stopping.");

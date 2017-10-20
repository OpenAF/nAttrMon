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
loadUnderscore(); 

// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

/**
 * [nAttrMon description]
 * @param  {[type]} aConfigPath [description]
 * @return {[type]}             [description]
 */
var nAttrMon = function(aConfigPath, debugFlag) {
	plugin("Threads");

	this.chCurrentValues = "nattrmon::values";
	this.chLastValues = "nattrmon::lastValues";

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
	this.indexPlugThread = {};

	//this.restoreSnapshot();
	var nattrmon = this;
	this.currentValues.storeAdd(this.getConfigPath() + "/nattrmon.cvals.snapshot", [ "name" ], true);
	this.lastValues.storeAdd(this.getConfigPath() + "/nattrmon.lvals.snapshot", [ "name" ], true);
	this.listOfAttributes.getCh().storeAdd(this.getConfigPath() + "/nattrmon.attrs.snapshot", [ "name" ], true);
	this.listOfWarnings.getCh().storeAdd(this.getConfigPath() + "/nattrmon.warns.snapshot", [ "name" ], true);
}

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

nAttrMon.prototype.restoreSnapshot = function() {
	// Use JMix
	var mainpath = this.getConfigPath();
	try {
		var snapshot = uncompress(io.readFileBytes(mainpath + "/nattrmon.snapshot"));
		this.currentValues.setAll([ "name" ], ow.obj.fromObj2Array(snapshot.currentValues, "name"));
		this.lastValues.setAll([ "name" ], ow.obj.fromObj2Array(snapshot.lastValues, "name"));
		/*this.listOfAttributes = ow.obj.fromJson(snapshot.listOfAttributes)
		                          .withObject(nAttributes.prototype)
		                          .withObject(nAttribute.prototype, "attributes.*").build();*/
		this.listOfAttributes.addAttributes(snapshot.listOfAttributes);
		this.listOfWarnings.addWarnings(_.flatten(ow.loadObj().fromObj2Array(snapshot.listOfWarnings)));

		/*this.listOfWarnings = ow.obj.fromJson(snapshot.listOfWarnings)
		                          .withObject(nWarnings.prototype).build();	*7

		/*for (var i in this.listOfWarnings.warnings) {
			this.listOfWarnings.warnings[i] = ow.obj.fromJson(snapshot.listOfWarnings.warnings[i]).withObject(nWarning.prototype, "*").build();
		}*/

	} catch(e) {
		this.debug("Exception while restoring snapshot: " + e);
	}
}

/**
 * [getConfigPath description]
 * @return {[type]} [description]
 */
nAttrMon.prototype.getConfigPath = function() {
	return this.configPath;
}

/**
 * [setSessionData description]
 * @param {[type]} aKey    [description]
 * @param {[type]} aObject [description]
 */
nAttrMon.prototype.setSessionData = function(aKey, aObject) {
	this.sessionData[aKey] = aObject;
}

/**
 * [getSessionData description]
 * @param  {[type]} aKey [description]
 * @return {[type]}      [description]
 */
nAttrMon.prototype.getSessionData = function(aKey) {
	return this.sessionData[aKey];
}

/**
 * [hasSessionData description]
 * @param  {[type]}  aKey [description]
 * @return {Boolean}      [description]
 */
nAttrMon.prototype.hasSessionData = function(aKey) {
	if(isUnDef(this.getSessionData(aKey))) {
		return false;
	} else {
		return true;
	}
}

/**
 * [addMonitoredObject description]
 * @param {[type]} aKey     [description]
 * @param {[type]} anObject [description]
 */
nAttrMon.prototype.addMonitoredObject = function(aKey, anObject) {
	this.monitoredObjects[aKey] = new nMonitoredObject(aKey, anObject);
	return this.getMonitoredObject(aKey);
}

/**
 * [getMonitoredObject description]
 * @param  {[type]} aKey [description]
 * @return {[type]}      [description]
 */
nAttrMon.prototype.getMonitoredObject = function(aKey) {
  	if (this.hasMonitoredObject(aKey))
		return this.monitoredObjects[aKey].getObject();
}

/**
 * [hasMonitoredObject description]
 * @param  {[type]}  aKey [description]
 * @return {Boolean}      [description]
 */
nAttrMon.prototype.hasMonitoredObject = function(aKey) {
	if(isUnDef(this.monitoredObjects[aKey])) {
		return false;
	} else {
		return true;
	}
}

/**
 * [monitoredObjectsTest description]
 * @return {[type]} [description]
 */
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
 * [debug description]
 * @param  {[type]} aMessage [description]
 * @return {[type]}          [description]
 */
nAttrMon.prototype.debug = function(aMessage) {
	if(this.debugFlag) {
		log("DEBUG | " + aMessage);
	}
}

/**
 * [start description]
 * @return {[type]} [description]
 */
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

/**
 * [stop description]
 * @return {[type]} [description]
 */
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

/**
 * [restart description]
 * @return {[type]} [description]
 */
nAttrMon.prototype.restart = function() {
	this.debug("nAttrMon restarting");
	this.stop();
	restartOpenAF();
}

/**
 * [getAttributes description]
 * @return {[type]} [description]
 */
nAttrMon.prototype.getAttributes = function(justData) {
	if (justData)
		return this.listOfAttributes.getAttributes(justData);
	else
		return this.listOfAttributes;
}

/**
 * [setAttribute description]
 * @param {[type]} aName        [description]
 * @param {[type]} aDescription [description]
 */
nAttrMon.prototype.setAttribute = function(aName, aDescription, aType) {
	this.listOfAttributes.setAttribute(new nAttribute(aName, aDescription, aType));
}

/**
 * [setAttributes description]
 * @param {[type]} aStruct [description]
 */
nAttrMon.prototype.setAttributes = function(aStruct) {
	for(var attr in aStruct) {
		this.listOfAttributes.setAttribute(new nAttribute(attr, aStruct[attr]));
	}
}

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

/**
 * [getPlugs description]
 * @return {[type]}       [description]
 */
nAttrMon.prototype.getPlugs = function() {
	return this.plugs;
}

/**
 * [getCurrentValues description]
 * @return {[type]} [description]
 */
nAttrMon.prototype.getCurrentValues = function(full) {
	if (full) {
		return this.currentValues;
	} else {
		return ow.obj.fromArray2Obj(this.currentValues.getAll(), "name", true);
	}
}

/**
 * [getLastValues description]
 * @return {[type]} [description]
 */
nAttrMon.prototype.getLastValues = function(full) {
	if (full) {
		return this.lastValues;
	} else {
		return ow.obj.fromArray2Obj(this.lastValues.getAll(), "name", true);
	}
}

/**
 * [getHistoryValuesByTime description]
 * @param  {[type]} anAttributeName   [description]
 * @param  {[type]} howManySecondsAgo [description]
 * @return {[type]}                   [description]
 */
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

/**
 * [getHistoryValuesByEvents description]
 * @param  {[type]} anAttributeName  [description]
 * @param  {[type]} howManyEventsAgo [description]
 * @return {[type]}                  [description]
 */
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

/**
 * [addValues description]
 * @param {[type]} aValues [description]
 */
nAttrMon.prototype.addValues = function(onlyOnEvent, aValues) {
	var count;

	if (isUnDef(aValues)) return;

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

/**
 * [execPlugs description]
 * @param  {[type]} aPlugType [description]
 * @return {[type]}           [description]
 */
nAttrMon.prototype.execPlugs = function(aPlugType) {
    for(var iPlug in this.plugs[aPlugType]) {
    	var entry = this.plugs[aPlugType][iPlug];
    	var thread = new Threads();
    	var parent = this;
    	parent.thread = thread;

    	this.debug("Creating a thread for " + entry.getName());
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
    		} catch(e) {
    			logErr(etry.getName() + " | " + e);
    		}

    		return true;
    	});

        parent.threadsSessions[uuid] = {
    		"entry": this.plugs[aPlugType][iPlug],
    		"count": now()
    	};
    	parent.indexPlugThread[entry.getCategory() + "/" + entry.getName()] = uuid;

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

     	this.threads.push(thread);
     	this.debug("Number of threads: " + this.threads.length);
    }
}

/**
 * [addPlug description]
 * @param {[type]} aPlugType [description]
 * @param {[type]} aFunction [description]
 */
nAttrMon.prototype.addPlug = function(aPlugType, aInputMeta, aObject, args) {
    if (isUnDef(this.plugs[aPlugType])) {
        this.plugs[aPlugType] = [];
    }

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
}

/**
 * [addInput description]
 * @param {[type]} aInputMeta   [description]
 * @param {[type]} aInputObject [description]
 * @param {[type]} args         [description]
 */
nAttrMon.prototype.addInput = function(aInputMeta, aInputObject, args) {
	this.addPlug(this.PLUGINPUTS, aInputMeta, aInputObject, args);
}

/**
 * [addOutput description]
 * @param {[type]} aTime         [description]
 * @param {[type]} waitForFinish [description]
 * @param {[type]} onlyOnEvent   [description]
 * @param {[type]} aFunction     [description]
 */
nAttrMon.prototype.addOutput = function(aOutputMeta, aOutputObject, args) {
	this.addPlug(this.PLUGOUTPUTS, aOutputMeta, aOutputObject, args);
}

nAttrMon.prototype.addValidation = function(aValidationMeta, aValidationObject, args) {
	this.addPlug(this.PLUGVALIDATIONS, aValidationMeta, aValidationObject, args);
}

/**
 * [loadPlugs description]
 * @return {[type]} [description]
 */
nAttrMon.prototype.loadPlugs = function() {
	this.loadPlug(this.configPath + "/objects", "objects");
	this.loadPlug(this.configPath + "/inputs", "inputs");
	this.loadPlug(this.configPath + "/validations", "validations");
	this.loadPlug(this.configPath + "/outputs", "outputs");
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
			case "input": yy.exec = new nInput(new Function("var scope = arguments[0]; var args = arguments[1]; " + yy.exec)); break;
			case "output": yy.exec = new nOutput(new Function("var scope = arguments[0]; var args = arguments[1]; " + yy.exec)); break;
			case "validation": yy.exec = new nValidation(new Function("var warns = arguments[0]; var scope = arguments[1]; var args = arguments[2]; " + yy.exec)); break;
		}
	if (isUnDef(yy.execArgs)) yy.execArgs = [{}];
	if (!(isArray(yy.execArgs))) yy.execArgs = [yy.execArgs];
	if (isDef(yy.execFrom)) {
		var o = eval(yy.execFrom);
		yy.exec = Object.create(o.prototype);
		o.apply(yy.exec, yy.execArgs);
	}

	return yy;
}

/**
 * [loadPlug description]
 * @param  {[type]} aPlugDir  [description]
 * @param  {[type]} aPlugDesc [description]
 * @return {[type]}           [description]
 */
nAttrMon.prototype.loadPlug = function(aPlugDir, aPlugDesc) {
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
        this.loadPlug(dirs[i], aPlugDesc);
    }

    for (var i in plugsjs) {
    	if(plugsjs[i].match(/\.js$/)) {
	    	log("Loading " + aPlugDesc + ": " + plugsjs[i]);
	    	try {
	        	af.load(plugsjs[i]);
	        } catch(e) {
	        	logErr("Error loading " + aPlugDesc + " (" + plugsjs[i] + "): " + e);
	        }
    	}
        if(plugsjs[i].match(/\.yaml$/)) {
			log("Loading " + aPlugDesc + ": " + plugsjs[i]);
			try {
				var y = io.readFileYAML(plugsjs[i]);
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
						y.input.forEach(function(yo) { __handlePlug(yo, "input") });
					else	
						__handlePlug(y.input, "input");
				if (isDef(y.output)) 
					if (isArray(y.output))
						y.output.forEach(function(yo) { __handlePlug(yo, "output") });
					else	
						__handlePlug(y.output, "output");
				if (isDef(y.validation))
					if (isArray(y.validation))
						y.validation.forEach(function(yo) { __handlePlug(yo, "validation") });
					else	
						__handlePlug(y.validation, "validation");
			} catch(e) {
				logErr("Error loading " + aPlugDesc + " (" + plugsjs[i] + "): " + e);
			}
			}
    }
}


// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var params = processExpr();
var nattrmon;

if (isUnDef(params.withDirectory)) {
	nattrmon = new nAttrMon(NATTRMON_HOME + "/config");
} else {
	nattrmon = new nAttrMon(params.withDirectory);
}

var __sleepperiod = 60000; // less aggressive
var __stuckfactor = 500;


// Option start
//if (isDef(params.start)) {
//        restartOpenAF(["--script", NATTRMON_HOME + "/nattrmon.js"]);
//}

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
		if ( (now() - nattrmon.threadsSessions[uuid].count) >= (nattrmon.threadsSessions[uuid].entry.aTime * __stuckfactor) ) {
			log("nAttrmon found a stuck thread (" + uuid + " for '" + nattrmon.threadsSessions[uuid].entry.getName() + "')");
			log("nAttrMon restarting process!!");
			nattrmon.stop();
			restartOpenAF();
		}
	}
});
nattrmon.stop();

log("nAttrMon stopped.");

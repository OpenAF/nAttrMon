// check version
af.getVersion() >= "20170101" || (print("Version " + af.getVersion() + ". You need OpenAF version 20170101 to run.")) || exit(-1);

var NATTRMON_HOME = getOPackPath("nAttrMon") || ".";

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

var nAttrMon = function(aURL, localAttrs, localWarns) {
	this.currentValues    = $ch("cvals").createRemote(aURL + "/chs/cvals");
	this.lastValues       = $ch("lvals").createRemote(aURL + "/chs/lvals");
	this.monitoredObjects = {};
	this.objPools = {};
	this.sessionData = {};

	this.listOfAttributes = new nAttributes();
	if (!localAttrs) {
		$ch("attrs").createRemote(aURL + "/chs/attrs");
		this.listOfAttributes.chAttributes = "attrs";
	}
	this.listOfWarnings   = new nWarnings(); 
	if (!localWarns) {
		$ch("warns").createRemote(aURL + "/chs/warns");
		this.listOfWarnings.chWarnings = "warns";
	}
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

nAttrMon.prototype.setSessionData = function(aKey, aObject) {
	this.sessionData[aKey] = aObject;
}

nAttrMon.prototype.getSessionData = function(aKey) {
	return this.sessionData[aKey];
}

nAttrMon.prototype.hasSessionData = function(aKey) {
	if(isUndefined(this.getSessionData(aKey))) {
		return false;
	} else {
		return true;
	}
}

nAttrMon.prototype.addMonitoredObject = function(aKey, anObject) {
	this.monitoredObjects[aKey] = new nMonitoredObject(aKey, anObject);
	return this.getMonitoredObject(aKey);
}

nAttrMon.prototype.getMonitoredObject = function(aKey) {
  	if (this.hasMonitoredObject(aKey))
		return this.monitoredObjects[aKey].getObject();
}

nAttrMon.prototype.hasMonitoredObject = function(aKey) {
	if(isUndefined(this.monitoredObjects[aKey])) {
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

nAttrMon.prototype.declareMonitoredObjectDirty = function(aKey) {
	this.monitoredObjects[aKey].setDirty();
	this.monitoredObjects[aKey].test();
}

nAttrMon.prototype.isObjectPool = function(aKey) {
	if (isDefined(this.objPools[aKey]))
		return true;
	else
		return false;
}

nAttrMon.prototype.addObjectPool = function(aKey, aOWObjPool) {
	this.objPools[aKey] = aOWObjPool.start();
}

nAttrMon.prototype.getObjectPool = function(aKey) {
	return this.objPools[aKey];
}

nAttrMon.prototype.delObjectPool = function(aKey) {
        this.objPools[aKey].stop();
	deleteFromArray(this.objPools, this.objPools.indexOf(aKey));
}

nAttrMon.prototype.getObjectPoolKeys = function(aKey) {
	return Object.keys(this.objPools);
}

nAttrMon.prototype.leaseObject = function(aKey) {
	return this.objPools[aKey].checkOut();
}

nAttrMon.prototype.returnObject = function(aKey, anObj, aStatus) {
	return this.objPools[aKey].checkIn(anObj, aStatus);
}

nAttrMon.prototype.useObject = function(aKey, aFunction) {
	return this.objPools[aKey].use(aFunction);
}


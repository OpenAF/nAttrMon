// nAttrMon output plug functionality
// Copyright 2023 Nuno Aguiar

/**
 * [nOutput description]
 */
var nOutput = function(aFunction) {
	this.aFunction = aFunction;
	this.count = 0;
	this.lastSeen = {};
};

/**
 * [exec description]
 */
nOutput.prototype.exec = function(scope, args, meta) {
	var ret
	try {
		ret = this.aFunction(scope, args, meta)
	} catch(e) {
		logErr(meta.aName + " | " + __nam_err(e, true, true, this.aFunction.toString()))
	}
	this.count++;
	return { outputs: ret };
};

nOutput.prototype.see = function(aKey, anAttribute) {
	var found = false;
	if (isDefined(this.lastSeen[aKey]) && 
		this.lastSeen[aKey] != anAttribute.date) {
		found = true;
	} else {
		found = false;
	}
	this.lastSeen[aKey] = anAttribute.date;
	return found;
};
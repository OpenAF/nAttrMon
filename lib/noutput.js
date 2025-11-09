// nAttrMon output plug functionality
// Copyright 2023 Nuno Aguiar

// Output plug wrapper
// ----------------------------------------
// aFunction = function to execute for the plug
// ----------------------------------------
var nOutput = function(aFunction) {
	this.aFunction = aFunction
	this.count = 0
	this.lastSeen = {}
}

// Execute output plug
// ----------------------------------------
// scope = plug scope
// args  = plug arguments
// meta  = plug metadata
// Returns map with produced outputs
// ----------------------------------------
nOutput.prototype.exec = function(scope, args, meta) {
	var ret
	try {
		ret = this.aFunction(scope, args, meta)
	} catch(e) {
		logErr(meta.aName + " | " + __nam_err(e, true, true, this.aFunction.toString()))
	}
	this.count++
	return { outputs: ret }
}

// Track last seen attribute timestamps per key
// ----------------------------------------
// aKey         = attribute key
// anAttribute  = attribute metadata (expects date)
// Returns true if attribute was seen before with different timestamp
// ----------------------------------------
nOutput.prototype.see = function(aKey, anAttribute) {
	var found = false
	if (isDefined(this.lastSeen[aKey]) && 
		this.lastSeen[aKey] != anAttribute.date) {
		found = true
	} else {
		found = false
	}
	this.lastSeen[aKey] = anAttribute.date
	return found
}

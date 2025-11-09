// nAttrMon input plug functionality
// Copyright 2023 Nuno Aguiar

// Input plug wrapper
// ----------------------------------------
// aFunction = function to execute for the plug
// ----------------------------------------
var nInput = function(aFunction) {
	this.aFunction = aFunction
	this.count = 0
}

// Execute input plug
// ----------------------------------------
// scope = plug scope
// args  = plug arguments
// meta  = plug metadata
// Returns map with generated attributes
// ----------------------------------------
nInput.prototype.exec = function(scope, args, meta) {
	var ret
	try {
		ret = this.aFunction(scope, args)
	} catch(e) {
		logErr(meta.aName + " | " + __nam_err(e, true, true, this.aFunction.toString()))
	}
	this.count++
	return { attributes: ret }
}

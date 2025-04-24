// nAttrMon input plug functionality
// Copyright 2023 Nuno Aguiar

/**
 * [nInput description]
 */
var nInput = function(aFunction) {
	this.aFunction = aFunction;
	this.count = 0;
};

/**
 * [exec description]
 */
nInput.prototype.exec = function(scope, args, meta) {
	var ret
	try {
		ret = this.aFunction(scope, args)
	} catch(e) {
		logErr(meta.aName + " | " + __nam_err(e, true, true, this.aFunction.toString()))
	}
	this.count++;
	return { attributes: ret };
};
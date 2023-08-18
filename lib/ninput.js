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
nInput.prototype.exec = function(scope, args) {
	var ret = this.aFunction(scope, args);
	this.count++;
	return { attributes: ret };
};
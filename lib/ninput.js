/**
 * [nInput description]
 * @param  {[type]} aFunction [description]
 * @return {[type]}           [description]
 */
var nInput = function(aFunction) {
	this.aFunction = aFunction;
	this.count = 0;
};

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nInput.prototype.exec = function(scope, args) {
	var ret = this.aFunction(scope, args);
	this.count++;
	return { attributes: ret };
};
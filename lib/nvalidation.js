/**
 * [nValidation description]
 * @param  {[type]} aFunction [description]
 * @return {[type]}           [description]
 */
var nValidation = function (aFunction) {
	this.aFunction = aFunction;
	this.count = 0;
	this.warnings = [];
	this.warns = {};
}

nValidation.prototype.__refresh = function () {
	this.warns = {};
	this.warnings = nattrmon.getWarnings();

	for (var level in this.warnings) {
		if (isDef(level) && level != "") {
			for (var name in this.warnings[level]) {
				this.warns[this.warnings[level][name].title] = this.warnings[level][name];
			}
		}
	}
};

nValidation.prototype.closeWarning = function (aTitle) {
	var ret = [];

	this.__refresh();

	if (!isUnDef(this.warns[aTitle])) {
		var temp = new nWarning(this.warns[aTitle]);
		temp.close();
		ret.push(temp);
	}

	nattrmon.setWarnings(ret);
};

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nValidation.prototype.exec = function (scope, args) {
	this.__refresh();

	var ret = this.aFunction(this.warns, scope, args);
	if (isUnDef(args) || isUnDef(args.__dontCommit) || args.__dontCommit == false) {
		nattrmon.setWarnings(ret);
		this.warnings = ret;
	}
	this.count++;
	
	return { warnings: ret };
};
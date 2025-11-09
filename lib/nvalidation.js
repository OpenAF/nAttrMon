// nAttrMon validation plug functionality
// Copyright 2023 Nuno Aguiar

// Validation plug wrapper
// ----------------------------------------
// aFunction = function to execute for validations
// ----------------------------------------
var nValidation = function (aFunction) {
	this.aFunction = aFunction
	this.count = 0
	this.warnings = []
	this.warns = {}
}

// Refresh cached warnings for validation use
// ----------------------------------------
// No parameters
// ----------------------------------------
nValidation.prototype.__refresh = function () {
	this.warns = {}
	this.warnings = nattrmon.getWarnings()

	for (var level in this.warnings) {
		if (isDef(level) && level != "") {
			for (var name in this.warnings[level]) {
				this.warns[this.warnings[level][name].title] = this.warnings[level][name]
			}
		}
	}
}

// Close warning by title
// ----------------------------------------
// aTitle = warning title
// Returns list of closed warnings
// ----------------------------------------
nValidation.prototype.closeWarning = function (aTitle) {
	var ret = []

	this.__refresh()

	if (!isUnDef(this.warns[aTitle])) {
		var temp = new nWarning(this.warns[aTitle])
		temp.close()
		ret.push(temp)
	}

	nattrmon.setWarnings(ret)
}

// Execute validation plug
// ----------------------------------------
// scope = plug scope
// args  = plug arguments
// meta  = plug metadata
// Returns map with warnings
// ----------------------------------------
nValidation.prototype.exec = function (scope, args, meta) {
	this.__refresh()

	var ret
	try {
		ret = this.aFunction(this.warns, scope, args)
	} catch(e) {
		logErr(meta.aName + " | " + __nam_err(e, true, true, this.aFunction.toString()))
	}
	if (isUnDef(args) || isUnDef(args.__dontCommit) || args.__dontCommit == false) {
		nattrmon.setWarnings(ret)
		this.warnings = ret
	}
	this.count++
	
	return { warnings: ret }
}

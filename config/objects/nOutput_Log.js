
/**
 */
var nOutput_Log = function(aMap) {
	if (isUnDef(aMap) || !isObject(aMap)) aMap = {};
	this.afilename = (isUnDef(aMap.filename)) ? "nattrmon.log" : aMap.filename;
	this.lastTime = {};

	this.outputTemplate = (isUnDef(aMap.outputTemplate)) ? "{{date}} | {{name}} | {{value}}" : aMap.outputTemplate;

	nOutput.call(this, this.output);
};
inherit(nOutput_Log, nOutput);

/**
 */
nOutput_Log.prototype.output = function(scope, args) {
	var stuffdone = false;

	var makeLine = (attr) => {
		if (isObject(attr.val)) attr.value = stringify(attr.val, void 0, ""); else attr.value = attr.val;
		return templify(this.outputTemplate, attr);
	};

	var writeLine = (line) => {
		io.writeFileString(this.afilename, line + "\n", void 0, true);
	};

	var cvals = scope.getCurrentValues();
	if (isDef(args.k) && isDef(args.v)) {
		writeLine(makeLine(cvals[args.k.name]));
	} else {
		for(var key in cvals) {
			var attribute = cvals[key];
	
			if (args.onlyOnEvent) {
				if (isUnDef(this.lastTime[key]) || attribute.date != this.lastTime[key]) {
					writeLine(makeLine(attribute));
					this.lastTime[key] = attribute.date;
				}
			} else {
				writeLine(makeLine(attribute));	
			}
		}
	}
};
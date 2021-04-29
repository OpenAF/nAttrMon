// Author: who

/**
 * <odoc>
 * <key>nattrmon.nOutput_SomeObject(aMap)</key>
 * Provide some explanation of the objective of your output object.
 * \
 * On aMap expects:\
 * \
 *    - include        (Array)   Array of regex attributes/warnings to include on output.\
 *    - exclude        (Array)   Array of regex attributes/warnings to exclude from output.\
 *    - considerSetAll (Boolean) Should process attributes/warnings in bulk.\
 * \
 * </odoc>
 */
var nOutput_SomeObject = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.include = aMap.include;
	this.exclude = aMap.exclude;

    if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";
	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true;

    nOutput.call(this, this.output);
};
inherit(nOutput_SomeObject, nOutput);

nOutput_SomeObject.prototype.output = function(scope, args) {
	if (args.op != "setall" && args.op != "set") return;
	if (args.op == "setall" && !this.considerSetAll) return;

	var k, v, ch = args.ch;
	if (args.op == "set") {
		k = [args.k];
		v = [args.v];
	} else {
		k = args.k;
		v = args.v;
	}

    v.forEach(value => {
		var isok = isDef(this.include) ? false : true;
		var isWarns = (ch == "nattrmon::warnings" || ch == "nattrmon::warnings::buffer");
		var kk = (isWarns) ? value.title : value.name;

        if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0;
        if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0;
        if (isok) {
            // TODO
        }
    });
};
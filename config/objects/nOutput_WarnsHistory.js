// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_WarnsHistory(aMap)</key>
 * This output will keep an OpenAF channel with a history of changes in warning status.
 * \
 * On aMap expects:\
 * \
 *    - chName         (String)  The warnings history channel name (defaults to nattrmon::warningsHistory).\
 *    - chType         (String)  The warnings history channel type (defaults to simple).\
 *    - chParams       (Map)     The warnings history channel parameters (defaults to {}).\
 *    - historyMax     (Number)  Maximum number of entries to keep per warning title/creation date (defaults to 50, disabled if negative).\
 *    - maxEntries     (Number)  Maximum number of warning title + creation date pairs to keep (defaults to 100, disabled if negative).\
 *    - include        (Array)   Array of regex warnings to include on output.\
 *    - exclude        (Array)   Array of regex warnings to exclude from output.\
 *    - considerSetAll (Boolean) Should process warnings in bulk (defaults to true).\
 * \
 * </odoc>
 */
 var nOutput_WarnsHistory = function(aMap) {
    if (isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.include = aMap.include;
	this.exclude = aMap.exclude;

    if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";
	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true;

    this.chName     = _$(aMap.chName, "chName").isString().default("nattrmon::warningsHistory");
    this.chType     = _$(aMap.chType, "chType").isString().default(__);
    this.chParams   = _$(aMap.chParams, "chParams").isMap().default({});
    this.historyMax = _$(aMap.historyMax, "historyMax").isNumber().default(50);
    this.maxEntries = _$(aMap.maxEntries, "maxEntries").isNumber().default(100);

    var o = {
        type   : this.chType,
        options: this.chParams
    };
    $ch(this.chName).create(1, o.type, __nam_getChExtraOptions(o).options);

    nOutput.call(this, this.output);
};
inherit(nOutput_WarnsHistory, nOutput);

nOutput_WarnsHistory.prototype.output = function(scope, args) {
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
            var prev = $ch(this.chName).get({ title: value.title, createdate: value.createdate });
            var newV = clone(value);
            delete newV.title;
            delete newV.simpletitle
            if (isUnDef(prev) || Object.keys(prev).length == 0 || !isArray(prev.history)) {
                $ch(this.chName).set({ title: value.title, createdate: value.createdate }, { title: value.title, createdate: value.createdate, history: [ newV ] });
            } else {
                if (prev.history.filter(r => compare(r, newV)).length == 0) prev.history.push(newV);
                // Per entry housekeeping
                if (this.historyMax >= 0) {
                    while (prev.history.length > this.historyMax) {
                        prev.history.shift();
                    }
                }
                $ch(this.chName).set({ title: value.title, createdate: value.createdate }, prev);
            }
        }
    });

    // General housekeeping
    if (this.maxEntries >= 0) {
        while($ch(this.chName).size() > this.maxEntries) $ch(this.chName).shift();
    }
};
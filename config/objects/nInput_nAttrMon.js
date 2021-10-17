// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nInput_nAttrMon(aMap)</key>
 * Provides internal nAttrMon monitoring.
 * On aMap expects:\
 * \
 *    - attrTemplate (String) The attribute template where to store the result (use variable name for sub attributes).\
 * \
 * </odoc>
 */
 var nInput_nAttrMon = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "nAttrMon/{{name}}";

    nInput.call(this, this.input);
};
inherit(nInput_nAttrMon, nInput);

nInput_nAttrMon.prototype.input = function(scope, args) {
    var ret = {};

    ow.loadMetrics();
    var d = ow.metrics.getAll();

    var nam, namps, thr;

    if (isDef(d.mem)) {
        ret[templify(this.params.attrTemplate, { name: "Memory" })] = d.mem;
    }

    if (isDef(d.nattrmon)) {
        nam = d.nattrmon;
        namps = clone(d.nattrmon.poolsStats.poolsStats);
        delete nam.poolsStats;

        ret[templify(this.params.attrTemplate, { name: "nAttrMon" })] = nam;
        ret[templify(this.params.attrTemplate, { name: "PoolsStats" })] = namps;
    }

    if (isDef(d.threads)) {
        thr = d.threads;
        delete thr.list;

        ret[templify(this.params.attrTemplate, { name: "Threads" })] = thr;
    }

    ret[templify(this.params.attrTemplate, { name: "PS" })] = $ch("nattrmon::ps").getAll();

    ret[templify(this.params.attrTemplate, { name: "Plugs" })] = $ch("nattrmon::plugs").getAll();

    return ret;
};
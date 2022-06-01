// Author: who

/**
 * <odoc>
 * <key>nattrmon.nInput_JavaGC(aMap)</key>
 * Provide some explanation of the objective of your input object.
 * On aMap expects:\
 * \
 *    - someVariable (Type) Description of variable.\
 *    - attrTemplate (String) The attribute template where to store the result.\
 * \
 * </odoc>
 */
var nInput_JavaGC = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap
    } else {
        this.params = {}
    }

    ow.loadJava()
    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Java/{{_name}}"

    nInput.call(this, this.input)
};
inherit(nInput_JavaGC, nInput)

nInput_JavaGC.prototype.get = function(keyData, extra) {
    extra = _$(extra, "extra").isMap().default(__)
    // Get metrics based on keyData or, if no chKeys is provided, check this.params
    var res = {}

    // TODO
    res.gcSummary    = isString(keyData) ? { key: keyData } : {}
    res.gcCollectors = isString(keyData) ? { key: keyData } : {}
    res.gcThreads    = isString(keyData) ? { key: keyData } : {}
    
    ow.java.getLocalJavaPIDs().forEach(p => {
        var data = ow.java.parseHSPerf(p.path)
        res.gcSummary.push({
          key             : p.pid,
          vendor          : data.java.property.java.vm.vendor,
          jre             : data.java.property.java.vm.name,
          version         : data.java.property.java.vm.version,
          totalRunningTime: data.sun.rt.__totalRunningTime,
          percAppTime     : data.sun.rt.__percAppTime,
          gcCause         : data.sun.gc.cause,
          gcLastCause     : data.sun.gc.lastCause
        })
        
        res.gcCollectors = res.gcCollectors.concat(data.sun.gc.collector.map(c => ({
          key         : p.pid,
          name        : c.name,
          invocations : c.invocations,
          lastExecTime: c.__lastExecTime,
          avgExecTime : c.__avgExecTime
        })))
        
        data.java.threads.key = p.pid
        res.gcThreads.push(data.java.threads)
      })

    return merge(res, extra)
}

nInput_JavaGC.prototype.input = function(scope, args) {
    var ret = {}

    /*ret[templify(this.params.attrTemplate)] = {
        something: true
    };*/
    var gcSummary    = templify(this.params.attrTemplate, { _name: "GC Summary" })
    var gcCollectors = templify(this.params.attrTemplate, { _name: "GC Collectors" })
    var gcThreads    = templify(this.params.attrTemplate, { _name: "Threads" })

	if (isDef(this.params.chKeys)) {
        var arrGCSummary = [], arrGCCollector = [], arrGCThreads = []
        $ch(this.params.chKeys).forEach((k, v) => {
            var data = this.get(merge(k, v))
            arrGCSummary.push(data.gcSummary)
            arrGCCollectors.push(data.gcCollectors)
            arrGCThreads.push(data.gcThreads)
        })
        ret[gcSummary]    = arrGCSummary
        ret[gcCollectors] = arrGCCollectors
        ret[gcThreads]    = arrGCThreads
    } else {
        var data = this.get()
        ret[gcSummary]    = data.gcSummary
        ret[gcCollectors] = data.gcCollectors
        ret[gcThreads]    = data.gcThreads
    }

    return ret
};
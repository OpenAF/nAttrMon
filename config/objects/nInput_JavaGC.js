// Author: who

/**
 * <odoc>
 * <key>nattrmon.nInput_JavaGC(aMap)</key>
 * Retrieves GC information from hotspot JVMs running locally, on a host reachable through SSH or in a Kubernetes pod.
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
    extra   = _$(extra, "extra").isMap().default(__)
    keyData = _$(keyData, "keyData").isMap().default({ })
    // Get metrics based on keyData or, if no chKeys is provided, check this.params

    var fnProc = (key, data) => {
        var res = {}

        // TODO
        res.gcSummary    = {}
        res.gcCollectors = []
        res.gcThreads    = {}

        res.gcSummary = {
            key             : key,
            vendor          : data.java.property.java.vm.vendor,
            jre             : data.java.property.java.vm.name,
            version         : data.java.property.java.vm.version,
            totalRunningTime: data.sun.rt.__totalRunningTime,
            percAppTime     : data.sun.rt.__percAppTime,
            gcCause         : data.sun.gc.cause,
            gcLastCause     : data.sun.gc.lastCause
        }
        
        res.gcCollectors = res.gcCollectors.concat(data.sun.gc.collector.map(c => ({
            key         : key,
            name        : c.name,
            invocations : c.invocations,
            lastExecTime: c.__lastExecTime,
            avgExecTime : c.__avgExecTime
        })))
        
        res.gcThreads = merge({ key: key }, data.java.threads)

        return res
    }

    var _res = nattrmon.shExec(keyData.type, keyData).exec(keyData.cmd)

    if (isDef(_res) && isDef(_res.stdout)) {
        res = fnProc(keyData.key, ow.java.parseHSPerf( af.fromBase64(af.fromString2Bytes(_res.stdout)) ))
    }

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
        var arrGCSummary = [], arrGCCollectors = [], arrGCThreads = []
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
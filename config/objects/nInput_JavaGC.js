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
    res.gcSummary    = []
    res.gcCollectors = []
    res.gcThreads    = []
    res.gcSpaces     = []
    res.gcMem        = []
    
    ow.java.getLocalJavaPIDs().forEach(p => {
        var data = ow.java.parseHSPerf(p.path)
        var cmdH = sha512(data.sun.rt.javaCommand).substring(0, 7)

        res.gcSummary.push({
          key               : cmdH,
          pid               : p.pid,
          cmd               : data.sun.rt.javaCommand,
          vendor            : data.java.property.java.vm.vendor,
          jre               : data.java.property.java.vm.name,
          version           : data.java.property.java.vm.version,
          totalRunningTimeMs: data.sun.rt.__totalRunningTime,
          percAppTime       : data.sun.rt.__percAppTime,
          gcCause           : data.sun.gc.cause,
          gcLastCause       : data.sun.gc.lastCause
        })
        
        res.gcCollectors = res.gcCollectors.concat(data.sun.gc.collector.map(c => ({
          key                : cmdH,
          pid                : p.pid, 
          name               : c.name,
          invocations        : c.invocations,
          lastInvocationMsAgo: isDate(c.__lastExitDate) ? now() - c.__lastExitDate.getTime() : __,
          lastExecTimeMs     : c.__lastExecTime,
          avgExecTimeMs      : c.__avgExecTime
        })))
        
        var r = { max: 0, total: 0, used: 0, free: 0 }
        data.sun.gc.generation.forEach(gen => {
          gen.space.forEach(space => {
            res.gcSpaces.push({
                key: cmdH,
                pid: p.pid,
                gen: gen.name,
                space: space.name,
                used : space.used > 0 ? space.used : 0,
                total: space.capacity > 0 ? space.capacity : 0,
                max  : space.maxCapacity > 0 ? space.maxCapacity : 0
            })

            r.max   = (r.max < Number(space.maxCapacity)) ? Number(space.maxCapacity) : r.max
            r.used  = r.used + Number(space.used)
            r.total = isNumber(space.capacity) ? r.total + Number(space.capacity) : r.total
          })
        })

        res.gcMem.push({
            key: cmdH,
            pid: p.pid,
            total: r.total,
            used: r.used,
            free: r.total - r.used,
            metaMax   : data.sun.gc.metaspace.maxCapacity,
            metaTotal : data.sun.gc.metaspace.capacity,
            metaUsed  : data.sun.gc.metaspace.used,
            metaFree  : data.sun.gc.metaspace.capacity - data.sun.gc.metaspace.used
        })

        var _t = { 
            key: cmdH,
            pid: p.pid
        }
        Object.keys(data.java.threads).forEach(k => _t[k] = data.java.threads[k])
        res.gcThreads.push(_t)
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
    var gcSpaces     = templify(this.params.attrTemplate, { _name: "GC Spaces" })
    var gcMem        = templify(this.params.attrTemplate, { _name: "Memory" })

	if (isDef(this.params.chKeys)) {
        var arrGCSummary = [], arrGCCollectors = [], arrGCThreads = [], arrGCSpaces = []
        $ch(this.params.chKeys).forEach((k, v) => {
            var data = this.get(merge(k, v))
            arrGCSummary.push(data.gcSummary)
            arrGCCollectors.push(data.gcCollectors)
            arrGCThreads.push(data.gcThreads)
            arrGCSpaces.push(data.gcSpaces)
            arrGCMem.push(data.gcMem)
        })
        ret[gcSummary]    = arrGCSummary
        ret[gcCollectors] = arrGCCollectors
        ret[gcThreads]    = arrGCThreads
        ret[gcSpaces]     = arrGCSpaces
        ret[gcMem]        = arrGCMem
    } else {
        var data = this.get()
        ret[gcSummary]    = data.gcSummary
        ret[gcCollectors] = data.gcCollectors
        ret[gcThreads]    = data.gcThreads
        ret[gcSpaces]     = data.gcSpaces
        ret[gcMem]        = data.gcMem
    }

    return ret
};
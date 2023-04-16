// Author: who

/**
 * <odoc>
 * <key>nattrmon.nInput_JMX(aMap)</key>
 * Provide some explanation of the objective of your input object.
 * On aMap expects:\
 * \
 *    - someVariable (Type) Description of variable.\
 *    - attrTemplate (String) The attribute template where to store the result.\
 * \
 * </odoc>
 */
var nInput_JMX = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap
    } else {
        this.params = {}
    }

    plugin("JMX")

    this.params.objects = _$(this.params.objects, "objects").isArray().default([
        { object: "java.lang:type=OperatingSystem" },
        { object: "java.lang:type=Runtime", path: "{SpecName:SpecName,SpecVendor:SpecVendor,SpecVersion:SpecVersion,ManagementSpecVersion:ManagementSpecVersion,InputArguments:InputArguments,BootClassPathSupported:BootClassPathSupported,VmName:VmName,VmVendor:VmVendor,VmVersion:VmVersion,Uptime:Uptime,StartTime:StartTime,Name:Name,ClassPath:ClassPath}" },
        { object: "java.lang:type=Memory" },
        { object: "java.lang:type=Compilation" },
        { object: "java.lang:type=Threading", path: "{CurrentThreadAllocatedBytes:CurrentThreadAllocatedBytes,ThreadCount:ThreadCount,TotalStartedThreadCount:TotalStartedThreadCount,CurrentThreadCpuTime:CurrentThreadCpuTime,CurrentThreadUserTime:CurrentThreadUserTime,PeakThreadCount:PeakThreadCount,DaemonThreadCount:DaemonThreadCount}" },
        { object: "java.lang:type=MemoryManager,name=Metaspace Manager" },
        { object: "java.lang:type=MemoryPool,name=Metaspace" }
    ])

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Java/JMX{{#if type}} {{type}}{{#if name}} {{name}}{{/if}}{{/if}}"

    nInput.call(this, this.input)
}
inherit(nInput_JMX, nInput)

nInput_JMX.prototype.get = function(keyData) {
    // Get metrics based on keyData or, if no chKeys is provided, check this.params
    const getObj = (_jmx, aObj) => {
        var data = {}
    
        const _tt = (_o, p) => {
            if (p == "ObjectName") return
            if (!isJavaObject(_o)) {
                $$(data).set(p, _o)
                return
            }
            if (_o instanceof java.lang.String)  {
                $$(data).set(p, String(_o))
                return
            }
            if (_o instanceof java.lang.Number)  {
                $$(data).set(p, Number(_o))
                return
            }
            if (_o instanceof java.lang.Boolean) {
                $$(data).set(p, Boolean(_o))
                return
            }
            if (_o instanceof javax.management.openmbean.CompositeDataSupport) {
                var _cm = af.fromJavaArray(_o.getCompositeType().keySet().toArray())
                _cm.forEach(m => _tt(_o.get(m), p + "." + m) )
                return
            }
            if (_o instanceof javax.management.openmbean.TabularDataSupport) {
                var _cm = af.fromJavaArray(_o.keySet().toArray())
                $$(data).set(p, [])
                _cm.forEach((m1, i) => _tt(_o.get(af.fromJavaArray(m1)), p + "[" + i + "]" ) )
                return
            }
            if (isJavaObject(_o)) {
                if (String(_o.getClass()).startsWith("class [")) {
                    $$(data).set(p, [])
                    af.fromJavaArray(_o).forEach((m, i) => {
                        _tt(m, p + "[" + i + "]")
                    })
                    return
                }
            }
            $$(data).set(p, _o)
        }
    
        try {
            var _obj = _jmx.getObject(aObj)
            var _map = af.fromJavaMap(_obj.getAttributes())
            if (isArray(_map.attributes)) {
                _map.attributes.forEach(attr => {
                    try {
                        _tt(_obj.get(attr.name), attr.name)
                    } catch(ee) {
                        if (String(ee).indexOf("java.lang.UnsupportedOperationException") < 0) logWarn("nInput_JMX | " + aObj + " | " + attr.name + " | " + ee)
                    }
                })
                return data
            }
        } catch(e) {
            if (String(e).indexOf("java.lang.UnsupportedOperationException") < 0) logWarn("nInput_JMX | " + aObj + " | " + e)
        }
    }

    var res = []

    keyData.key  = _$(keyData.key, "key").isString().default(__)
    keyData.url  = _$(keyData.url, "url").$_()
    keyData.user = _$(keyData.user, "user").isString().default(__)
    keyData.pass = _$(keyData.pass, "pass").isString().default(__)
    keyData.provider = _$(keyData.provider, "provider").isString().default(__)

    this.params.objects.forEach(obj => {
        var jmx = new JMX(keyData.url, keyData.user, keyData.pass, keyData.provider)
        var data = getObj(jmx, obj.object)

        var type, name
        obj.object.substring(obj.object.indexOf(":") + 1).split(",").forEach(r => {
            var ar = r.split("=")
            if (ar[0] == "type") type = ar[1]
            if (ar[0] == "name") name = ar[1]
        })
        
        if (isDef(obj.selector)) data = ow.obj.filter(data, obj.selector)
        if (isDef(obj.path))     data = $path(data, obj.path)

        var _key = templify((isDef(keyData.attrTemplate) ? keyData.attrTemplate : this.params.attrTemplate), { type: type, name: name })
        res.push(merge({
            key          : keyData.key,
            _attrTemplate: _key
        }, data))
    })

    return res
}

nInput_JMX.prototype.input = function(scope, args) {
    var ret = {}, arr = []

	if (isDef(this.params.chKeys)) {
        $ch(this.params.chKeys).forEach((k, v) => {
            arr.push(this.get(merge(k, v)))
        })
    } else {
        arr = this.get(this.params)
    }

    arr.forEach(r => {
        var aT = r._attrTemplate
        delete r._attrTemplate
        ret[aT] = r
    })

    return ret
}
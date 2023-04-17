// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nInput_OpenMetrics(aMap)</key>
 * Connects to an external OpenMetrics and retrives the corresponding metrics.
 * On aMap expects:\
 * \
 *    - chKeys       (a channel name for the keys defined in nInput_Init)\
 *    - attrTemplate (a template for the name of the attribute)\
 *    - url\
 *    - headers\
 *    - metricsURI\
 *    - login\
 *    - pass\
 *    - connectionTimeout\
 *    - includePrefix\
 *    - excludePrefix\
 *    - includeRE\
 *    - excludeRE\
 *    - replace (replace.pattern & replace.replacement)\
 * \
 * </odoc>
 */
var nInput_OpenMetrics = function(aMap) {
    ow.loadMetrics()

    if (isObject(aMap)) {
        this.params = aMap
    } else {
        this.params = {}
    }

    // Define default attribute template
    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "OpenMetrics"

    nInput.call(this, this.input)
};
inherit(nInput_OpenMetrics, nInput);

// Retrive openmetrics data
nInput_OpenMetrics.prototype._get = function(aMap) {
    _$(aMap, "_get map").isMap().$_()
    _$(aMap.key, "key").isString().default("")
    var metricsURI = _$(aMap.metricsURI, "key '" + aMap.key + "' metrics uri").isString().default("/metrics");

    var lst, ret = {}, parent = this

    // Ensure user agent, by default, looks like curl
    var rh = { "User-Agent": "curl" }

    // Set necessary HTTP parameters
    if (isMap(aMap.headers)) {
        rh = merge(rh, aMap.headers)
    }

    // Retrieve metrics
    var lst = $rest({ 
        requestHeaders: rh, 
        login: aMap.login,
        pass: aMap.pass,
        connectionTimeout: aMap.connectionTimeout,
    }).get(aMap.url + metricsURI)

    // Verify output
    if (isUnDef(lst) || (isString(lst) && lst.indexOf("<html") > 0)) {
        throw "Can't retrieve metrics from " + aMap.url + metricsURI
    } else {
        if (isMap(lst) && isDef(lst.error)) throw lst.error
        // Convert metrics into a JSON array
        var lret = ow.metrics.fromOpenMetrics2Array(lst)

        if (isArray(lret)) {
            // Iterate from the generated JSON array
            lret.forEach(m => {
                // Filter metrics
                var _go = true
                if (isArray(aMap.excludePrefix)) {
                    aMap.excludePrefix.forEach(r => {
                        if (_go && m.metric.startsWith(r)) _go = false
                    })
                }
                if (isArray(aMap.includePrefix)) {
                    _go = false
                    aMap.includePrefix.forEach(r => {
                        if (!_go && m.metric.startsWith(r)) _go = true
                    })
                }
                if (isArray(aMap.excludeRE)) {
                    aMap.excludeRE.forEach(r => {
                        if (_go && m.metric.match(new RegExp(r))) _go = false
                    })
                }
                if (isArray(aMap.includeRE)) {
                    _go = false
                    aMap.includeRE.forEach(r => {
                        if (!_go && m.metric.match(new RegExp(r))) _go = true
                    })
                }
                if (!_go) return

                // Replace metrics name
                if (isArray(aMap.replace)) {
                    aMap.replace.forEach(r => {
                        if (isDef(r.pattern) && isDef(r.replacement)) {
                            m.metric = m.metric.replace(new RegExp(r.pattern), r.replacement)
                        }
                    })
                }

                // Prepare values for an output map
                
                var _r = { key: aMap.key }
                // If there are labels turn them into a map
                if (isMap(m.labels)) {
                    _r = merge(_r, m.labels)
                }
                // If no keys or labels exist simple put the value
                if (Object.keys(_r).length > 0) 
                    _r.value = m.value
                else
                    _r = m.value

                // Ready to store
                ret[m.metric] = _r
            })
        } else {
            throw "Can't parse metrics from " + aMap.url + metricsURI
        }

        return ret
    }
}

nInput_OpenMetrics.prototype.input = function(scope, args) {
    var ret = {}, res = []

    try {
        // Let's check if chKeys is being used
        if (isDef(this.params.chKeys)) {
            this.params.keys = $ch(this.params.chKeys).getKeys().map(r => r.key)

            // for each key
            for(var i in this.params.keys) {
                try {
                    // get the data from the chKeys
                    var v = $ch(this.params.chKeys).get({ key: this.params.keys[i] })
                    // Apply $sec transform
                    v = __nam_getSec(v)

                    // Call _get to get the corresponding array of results per storage class
                    res = res.concat(this._get(v))
                } catch(e1) {
                    logErr("OpenMetrics error (key=" + this.params.keys[i] + "): "+ stringify(e))
                }
            }
        } else {
            // If no chKeys are being used it's expected to have the same info in params
            res = this._get(this.params)
        }
    } catch(e) {
        logErr("OpenMetrics error: "+ stringify(e))
    }

    // Assign to the attribute template name the array of results
    ret[templify(this.params.attrTemplate)] = res

    return ret
}
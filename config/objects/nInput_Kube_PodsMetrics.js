// Author: Nuno Aguiar 

/**
 * <odoc>
 * <key>nattrmon.nInput_Kube_PodsMetrics(aMap)</key>
 * Provides a summary list of the current kubernetes pods and their current metrics. 
 * On aMap expects:\
 * \
 *    - kubeURL       (String)  If kubeconfig is not present the k8s URL.\
 *    - kubeUser      (String)  If kubeconfig is not present the k8s user.\
 *    - kubePass      (String)  If kubeconfig is not present the k8s pass.\
 *    - kubeToken     (String)  If kubeconfig is not present the k8s token.\
 *    - kubeNamespace (String)  If set will restrict to list pods from a specific namespace.\ 
 *    - podName       (String)  Regular expression to filter the pod name.\
 *    - attrTemplate  (String)  The attribute template where to store the result.\
 * \
 * </odoc>
 */
var nInput_Kube_PodsMetrics = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap
    } else {
        this.params = {}
    }
    this.params.kubeNamespace = _$(this.params.kubeNamespace, "kubeNamespace").isString().default(__)   
    this.params.podName       = _$(this.params.podName, "podName").isString().default(".+")

    if (isUnDef(getOPackPath("Kube"))) throw "Please install the latest Kube opack (opack install Kube)."

    loadLib("kube.js")
    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Kube/Pods Metrics"

    nInput.call(this, this.input);
};
inherit(nInput_Kube_PodsMetrics, nInput);

nInput_Kube_PodsMetrics.prototype.input = function(scope, args) {
    var ret = {}

    var kube = new Kube(this.params.kubeURL, this.params.kubeUser, this.params.kubePass, __, this.params.kubeToken)
    var o = kube.getPodsMetrics(this.params.kubeNamespace)
    var res = []

    var _fromSIAbbrev = function(aStr) {
        _$(aStr).isString().$_()
        aStr = aStr.trim()
        var arr = aStr.match(/(-?[0-9\.]+)\s*([a-zA-Z]+)/), unit, value
        if (isNull(arr)) return aStr
        if (arr.length >= 2) {
            unit  = String(arr[2])
            value = Number(arr[1])
        } else {
            unit  = ""
            value = parseFloat(aStr)
        }
    
        var hUnits = ["da","h","k","M","G","T","P","E","Z","Y","R","Q"]
        var lUnits = ["d","c","m","μ","n","p","f","a","z","y","r","q"]
        var vUnits = [1,2,3,6,9,12,15,18,21,24,27,30]
    
        var res = value
        var hUi = hUnits.indexOf(unit)
        if (hUi >= 0) {
            res = res * Math.pow(10, vUnits[lUi])
        } else {
            lUi = lUnits.indexOf(unit)
            if (lUi >= 0) {
                res = res * Math.pow(10, - vUnits[lUi])
            }
        }
    
        return res
    }

    var _r = n => {
        if (n == 0) return n
        return ow.format.round(n, 7)
    }

    $from(o)
    .match("metadata.name", this.params.podName)
    .select(r => {
        $from(r.containers)
        .select(s => {
            var cA = $from(s.usage).equals("key", "cpu").select(t => _r(_fromSIAbbrev(String(t.value.amount) + t.value.format)))
            var mA = $from(s.usage).equals("key", "memory").select(t => (Number(t.value.amount) > 0 ? ow.format.fromBytesAbbreviation(String(t.value.amount) + t.value.format) : ""))
            res.push({
                namespace: r.metadata.namespace, 
                name     : s.name,
                pod      : r.metadata.name,
                cpuAmount: (isArray(cA) && cA.length > 0 ? cA[0] : "n/a"),
                memAmount: (isArray(mA) && mA.length > 0 ? mA[0] : "n/a")
            })
        })
    })

    ret[templify(this.params.attrTemplate, this.params)] = res
    return ret
}

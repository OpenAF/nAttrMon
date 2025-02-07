// Author: Nuno Aguiar 

/**
 * <odoc>
 * <key>nattrmon.nInput_Kube_Pods(aMap)</key>
 * Provides a summary list of the current kubernetes pods and their current status. 
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
var nInput_Kube_Pods = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }
    this.params.kubeNamespace = _$(this.params.kubeNamespace, "kubeNamespace").isString().default(__);    
    this.params.podName       = _$(this.params.podName, "podName").isString().default(__);

    if (isUnDef(getOPackPath("Kube"))) throw "Please install the latest Kube opack (opack install Kube).";

    loadLib("kube.js");
    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Kube/Pods";

    nInput.call(this, this.input);
};
inherit(nInput_Kube_Pods, nInput);

nInput_Kube_Pods.prototype.input = function(scope, args) {
    var ret = {};

    //var kube = new Kube(this.params.kubeURL, this.params.kubeUser, this.params.kubePass, __, this.params.kubeToken);
    var o = $kube({
         url: this.params.kubeURL,
         user: this.params.kubeUser,
         pass: this.params.kubePass,
         token: this.params.kubeToken
    }).getFPO(this.params.kubeNamespace).items
    //kube.close()
    var res = o.map(r=>({
       namespace   : r.metadata.namespace,
       name        : r.metadata.name,
       generateName: r.metadata.generateName,
       creationDate: r.metadata.creationTimestamp,
       status      : r.status.phase,
       podIP       : r.status.podIP,
       hostIP      : r.status.hostIP
    }))

    if (isDef(this.params.podName)) res = $from(res).match("name", this.params.podName).select();

    ret[templify(this.params.attrTemplate, this.params)] = res;
    return ret;
};

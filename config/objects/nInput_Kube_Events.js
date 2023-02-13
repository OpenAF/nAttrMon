// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nInput_Kube_Events(aMap)</key>
 * Tries to retrieve the current kubernetes events and map it to an attribute.
 * On aMap expects:\
 * \
 *    - full         (Boolean) If full=true it will map the entire event information.\
 *    - kubeURL      (String)  If kubeconfig is not present the k8s URL.\
 *    - kubeUser     (String)  If kubeconfig is not present the k8s user.\
 *    - kubePass     (String)  If kubeconfig is not present the k8s pass.\
 *    - kubeToken    (String)  If kubeconfig is not present the k8s token.\
 *    - attrTemplate (String)  The attribute template where to store the result.\
 * \
 * </odoc>
 */
 var nInput_Kube_Events = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.params.full = _$(this.params.full, "full").isBoolean().default(false);

    if (isUnDef(getOPackPath("Kube"))) throw "Please install the latest Kube opack (opack install Kube).";

    loadLib("kube.js");
    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Kube/Events";

    nInput.call(this, this.input);
};
inherit(nInput_Kube_Events, nInput);

nInput_Kube_Events.prototype.input = function(scope, args) {
    var ret = {};

    var kube = new Kube(this.params.kubeURL, this.params.kubeUser, this.params.kubePass, __, this.params.kubeToken);    
    if (!this.params.full) {
        ret[templify(this.params.attrTemplate)] = kube.getEvents().map(r => ({
            startTime         : (isDef(r.FirstTimestamp) ? r.FirstTimestamp : "n/a"),
            endTime           : (isDef(r.LastTimestamp) ? r.LastTimestamp: "n/a"), 
            type              : (isDef(r.Type) ? r.Type : "n/a"),
            count             : (isDef(r.Count) ? r.Count : "n/a"),
            sourceComponent   : (isDef(r.Source) ? (isDef(r.Source.Component) ? r.Source.Component : "n/a") : "n/a"),
            sourceHost        : (isDef(r.Source) ? (isDef(r.Source.Host) ? r.Source.Host : "n/a") : "n/a"),
            reportingComponent: (isDef(r.ReportingComponent) ? r.ReportingComponent : "n/a"),
            message           : (isDef(r.Message) ? r.Message : "n/a"),
            reason            : (isDef(r.Reason) ? r.Reason : "n/a")
        }));
    } else {
        ret[templify(this.params.attrTemplate, this.params)] = kube.getEvents();
    }
    
    kube.close();

    return ret;
};
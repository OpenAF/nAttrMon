// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nInput_SSLCerts(aMap)</key>
 * Provide information and dates regarding the SSL/TLS certificates of the urls or host/address provided
 * On aMap expects:\
 * \
 *    - urls    (a map of attribute names, each with a mandatory url and optionally a timeout)\
 *    - ports   (a map of attribute names, each with a mandatory address and port  and optionally a timeout)\
 *    - chKeys  (a channel name for the urls or address/port equivalent entries)\
 * \
 * </odoc>
 */
 var nInput_SSLCerts = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    ow.loadNet()

    this.params.url     = _$(this.params.url, "url").isString().default(__)
    this.params.address = _$(this.params.address, "address").isString().default(__)
    this.params.port    = _$(this.params.port, "port").isNumber().default(__)

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Endpoints/SSL certificates";

    nInput.call(this, this.input);
};
inherit(nInput_SSLCerts, nInput);

nInput_SSLCerts.prototype.get = function(anEntry) {
    var res = {}
    anEntry = __nam_getSec(anEntry)

    if (isUnDef(anEntry.timeout)) anEntry.timeout = 1500

    if (isDef(anEntry.url) && isUnDef(anEntry.address) && isUnDef(anEntry.port)) {
        var _url = new java.net.URL(anEntry.url)
        anEntry.address = String(_url.getHost())
        anEntry.port    = Number((_url.getPort() == -1 ? _url.getDefaultPort() : _url.getPort()))
    }

    if (isDef(anEntry.address) && isDef(anEntry.port)) {
        try {
            var certs = ow.net.getTLSCertificates(anEntry.address, anEntry.port, __, __, __, anEntry.timeout)
            if (certs.length < 1) throw "Not certificates retrieved"

            res.issuerDN  = certs[0].issuerDN
            res.subject   = certs[0].subjectDN
            res.notBefore = certs[0].notBefore
            res.notAfter  = certs[0].notAfter 
        } catch(e) {
            res.errorMessage = String(e);
        }
    }

    return res
}

nInput_SSLCerts.prototype.input = function(scope, args) {
    var ret = {};

    if (isDef(this.params.urls)) {
        for(var attribute in this.params.urls) {
            var entry = this.params.urls[attribute];
            ret[templify(attribute, entry)] = this.get(entry);
        }
    }

    if (isDef(this.params.chKeys)) {
        $ch(this.params.chKeys).forEach((k, v) => {
            var attr;
            if (isUnDef(this.params.attribute)) {
                if (isDef(k.key))       attr = k.key;
                if (isString(k))        attr = k;
                if (isDef(k.attribute)) attr = k.attribute;
            } else {
                if (isDef(k.attribute))
                    attr = k.attribute
                else
                    attr = this.params.attribute
            }

            if (isDef(attr)) {
                ret[templify(attr, k)] = this.get(v);
            }
        });
    }

    return ret;
};
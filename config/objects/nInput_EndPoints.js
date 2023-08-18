/**
 * <odoc>
 * <key>nattrmon.nInput_EndPoints(aMap) : nInput</key>
 * Tests a HTTP/HTTPs endpoint or a TCP port for reachability/expected availability. aMap is composed of:\
 *    - urls           (a map of attribute names, each with a mandatory url and optional method (e.g. GET, PUT, POST, ...) and optional includeLatency (boolean), expected responseCode (e.g. 200, 401, ...), expected responseContentType (e.g. text/plain, ...), expected responseRegExp (content regular expression match), expected responseJsonMatch and debug boolean flag)\
 *    - ports          (a map of attribute names, each with a mandatory address and port and optionally a timeout and optional includeLatency (boolean))\
 *    - chUrls         (a channel name for the urls equivalent entries)\
 *    - chPorts        (a channel name for the ports equivalent entries)\
 * </odoc>
 */
var nInput_EndPoints = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    nInput.call(this, this.input);
};
inherit(nInput_EndPoints, nInput);

nInput_EndPoints.prototype.testURL = function(anEntry) {
    anEntry = __nam_getSec(anEntry)
    if (isDef(anEntry.url)) {
        var canDoIt = false, lat;
        var h = new ow.obj.http();
        var method = (isDef(anEntry.method)) ? anEntry.method.toUpperCase() : "GET";
        var errorMessage = "n/a";
        try {
            if (isDef(anEntry.login) && isDef(anEntry.password)) h.login(anEntry.login, anEntry.password);
            var res = h.exec(anEntry.url, method, void 0, void 0, void 0, anEntry.timeout);

            if (anEntry.debug) print(anEntry.url + "\n" + stringify(res));

            if (isDef(anEntry.responseCode)        && anEntry.responseCode != res.responseCode) 
               throw "Response code got " + res.responseCode + " (expected " +  anEntry.responseCode + ")";
            if (isDef(anEntry.responseContentType) && anEntry.responseContentType.toLowerCase() != res.contentType.toLowerCase()) 
               throw "Content type got '" + res.contentType + "' (expected '" + anEntry.responseContentType + "')";
            if (isDef(anEntry.responseRegExp)      && !(new RegExp(anEntry.responseRegExp)).test(res.response)) 
               throw "Response got '" + res.response + "' (expected match with regular expression '" + anEntry.responseRegExp + "')";
            if (isDef(anEntry.responseJsonMatch)   && !($stream([jsonParse(res.response)]).anyMatch(anEntry.responseJsonMatch)))
               throw "Couldn't find a match for " + stringify(anEntry.responseJsonMatch, void 0, "") + " on JSON response " + stringify(jsonParse(res.response), void 0, "");

            if (isDef(anEntry.includeLatency) && anEntry.includeLatency) lat = ow.format.testURLLatency(anEntry.url, anEntry.timeout);
            canDoIt = true;
        } catch(e) {
            errorMessage = String(e);
            canDoIt = false;
        }

        var _res = {
            result: canDoIt,
            errorMessage: errorMessage,
            latencyInMs: lat
        }
        if (isDef(anEntry.key)) _res.key = anEntry.key
        return _res
    }
};

nInput_EndPoints.prototype.testPort = function(anEntry) {
    anEntry = __nam_getSec(anEntry)
    if (isUnDef(anEntry.timeout)) anEntry.timeout = 1500;

    if (isDef(anEntry.url) && isUnDef(anEntry.address) && isUnDef(anEntry.port)) {
        var _url = new java.net.URL(anEntry.url)
        anEntry.address = _url.getHost()
        anEntry.port    = (_url.getPort() == -1 ? _url.getDefaultPort() : _url.getPort())
    }

    if (isDef(anEntry.address) && isDef(anEntry.port)) {
        var canDoIt = false;
        var errorMessage = "n/a";
        var lat;

        try {
            var s = new java.net.Socket();
            s.connect(new java.net.InetSocketAddress(anEntry.address, anEntry.port), anEntry.timeout);
            s.close();
            if (isDef(anEntry.includeLatency) && anEntry.includeLatency) lat = ow.format.testPortLatency(anEntry.address, anEntry.port, anEntry.timeout);
            canDoIt = true;
        } catch(e) {
            errorMessage = String(e);
            canDoIt = false;
        }

        var _res = {
            result: canDoIt,
            errorMessage: errorMessage,
            latencyInMs: lat
        }
        if (isDef(anEntry.key)) _res.key = anEntry.key
        return _res
    }
};

nInput_EndPoints.prototype.input = function(scope, args) {
    var ret = {};

    if (isDef(this.params.urls)) {
        for(var attribute in this.params.urls) {
            var entry = this.params.urls[attribute];
            ret[templify(attribute, entry)] = this.testURL(entry);
        }
    }

    if (isDef(this.params.chUrls)) {
        $ch(this.params.chUrls).forEach((k, v) => {
            var attr;
            // For legacy compatibility
            if (isDef(this.params.attribute)) this.params.attrTemplate = this.params.attribute
            if (isUnDef(this.params.attrTemplate)) {
                if (isDef(k.key))       attr = k.key;
                if (isString(k))        attr = k;
                if (isDef(k.attribute)) attr = k.attribute; 
            } else {
                if (isDef(k.attribute))
                    attr = k.attribute
                else
                    attr = this.params.attrTemplate
            }

            if (isDef(attr)) {
                if (isUnDef(ret[templify(attr, k)])) ret[templify(attr, k)] = []
                ret[templify(attr, k)].push(this.testURL(v))
            }
        });
    }

    if (isDef(this.params.ports)) {
        for(var attribute in this.params.ports) {
            var entry = this.params.ports[attribute];
            ret[templify(attribute, entry)] = this.testPort(entry);
        }
    }

    if (isDef(this.params.chPorts)) {
        $ch(this.params.chPorts).forEach((k, v) => {
            var attr;
            // For legacy compatibility
            if (isDef(this.params.attribute)) this.params.attrTemplate = this.params.attribute
            if (isUnDef(this.params.attrTemplate)) {
                if (isDef(k.key))       attr = k.key;
                if (isString(k))        attr = k;
                if (isDef(k.attribute)) attr = k.attribute;
            } else {
                if (isDef(k.attribute))
                    attr = k.attribute
                else
                    attr = this.params.attrTemplate
            }

            if (isDef(attr)) {
                if (isUnDef(ret[templify(attr, k)])) ret[templify(attr, k)] = []
                ret[templify(attr, k)].push(this.testPort(v))
            }
        })
    }

    return ret;
};
var nOutput_HTTP_HealthZ = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

    ow.loadMetrics();

	var aPort;
	if (isObject(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
        this.includeHealthZ  = _$(aMap.includeHealthZ, "includeHealthZ").isBoolean().default(true);
        this.includeLiveZ    = _$(aMap.includeLiveZ, "includeLiveZ").isBoolean().default(true);
        this.includeReadyZ   = _$(aMap.includeReadyZ, "includeReadyZ").isBoolean().default(true);
	} else {
		aPort = aMap;
	}

	// Set server if doesn't exist
	var hS = "httpd";

	if (isDef(aMap.httpSession)) hS = aMap.httpSession;

    if (nattrmon.hasSessionData(hS)) {
        if (isNumber(aPort) && aPort != nattrmon.getSessionData(hS).getPort()) {
            nattrmon.setSessionData(hS,
                ow.server.httpd.start(aPort, aMap.host, aMap.keyStore, aMap.keyPassword));
        }
    } else {
        nattrmon.setSessionData(hS,
            ow.server.httpd.start(isUnDef(aPort) ? 8090 : aPort, aMap.host, aMap.keyStore, aMap.keyPassword));
    }

	// Get server
	var httpd = nattrmon.getSessionData(hS);

	var auditAccess = (aReq, aReply) => {
		var data = merge(aReq, { 
			reply: {
				status  : aReply.status,
				mimetype: aReply.mimetype
			}
	    });
		try { 
			tlog(this.auditTemplate, data);
		} catch(e) {
			logErr("Error on auditing access: " + String(e));
		}
	}

    var _parse = (e, n) => {
        return ow.obj.fromObj2Array(e).map(r => {
            var d = (new Date(r.date)).getTime();
            delete r.date;
            var m = {}; m[r.name] = r.val;
            return ow.metrics.fromObj2OpenMetrics(m, n, d);
        }).join("");
    }

	// Add function to server
	//httpd.addEcho("/echo");
    var parent = this;
    var routes = {};
    if (parent.includeHealthZ) {
        routes["/healthz"] = function(req) {
            var hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
            auditAccess(req, hres);
            return hres;
        }
    }
    if (parent.includeLiveZ) {
        routes["/livez"] = function(req) {
            var hres;
            try {
                $ch(nattrmon.chPS).size();
                hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
            } catch(e) {
                hres = ow.server.httpd.reply("Internal Server Error", 500, "text/plain", {});
            } 
            auditAccess(req, hres);
            return hres;
        }
    }
    if (parent.includeReadyZ) {
        routes["/readyz"] = function(req) {
            if (nattrmon.alive) {
                var hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
                auditAccess(req, hres);
                return hres;
            } else {
                var hres = ow.server.httpd.reply("Not ready", 503, "text/plain", {});
                auditAccess(req, hres);
                return hres;
            }
        }
    }
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, routes), function (r) {
		var hres = ow.server.httpd.reply("", 200, "text/plain", {});
		auditAccess(r, hres);
		return hres;
	});

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP_HealthZ, nOutput);

nOutput_HTTP_HealthZ.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
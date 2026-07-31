var nOutput_HTTP_HealthZ = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

    ow.loadMetrics();

	var aPort = 8090;
    if (isNumber(aMap)) aMap = { port: aMap }; 
    if (isUnDef(aMap) || isNull(aMap)) aMap = { port: aPort };
	if (isMap(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
        this.includeHealthZ  = _$(aMap.includeHealthZ, "includeHealthZ").isBoolean().default(true);
        this.includeLiveZ    = _$(aMap.includeLiveZ, "includeLiveZ").isBoolean().default(true);
        this.includeReadyZ   = _$(aMap.includeReadyZ, "includeReadyZ").isBoolean().default(true);
	} else {
		aMap = {};
	}

	var _route = nattrmon.getHttpRouteHelpers(aMap, aPort);
	var relativePath = _route.relativePath;

	// Set server if doesn't exist
	var hS = "httpd";

	if (isDef(aMap.httpSession)) hS = aMap.httpSession;

	// Get server
	var httpd = nattrmon.ensureHttpSession(hS, aPort, aMap.host, aMap.keyStore, aMap.keyPassword);
	var parent = this;

	var preProcess = nattrmon.getHttpPreProcessFn(aMap, httpd, parent, "nOutput_HTTP_HealthZ");
    var routePath = _route.routePath;

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
		routes[routePath("/healthz")] = function(req) {
			try {
				var hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
				return preProcess(req, hres);
			} catch(e) {
				logErr("nOutput_HTTP_HealthZ | Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
        }
    }
    if (parent.includeLiveZ) {
		routes[routePath("/livez")] = function(req) {
            var hres;
			try {
				try {
					$ch(nattrmon.chPS).size();
					hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
				} catch(e) {
					hres = ow.server.httpd.reply("Internal Server Error", 500, "text/plain", {});
				} 
				return preProcess(req, hres);
			} catch(e) {
				logErr("nOutput_HTTP_HealthZ | Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
        }
    }
    if (parent.includeReadyZ) {
		routes[routePath("/readyz")] = function(req) {
			try {
				if (nattrmon.alive) {
					var hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
					return preProcess(req, hres);
				} else {
					var hres = ow.server.httpd.reply("Not ready", 503, "text/plain", {});
					return preProcess(req, hres);
				}
			} catch(e) {
				logErr("nOutput_HTTP_HealthZ | Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
        }
    }
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, routes), function (r) {
		try {
			var hres = ow.server.httpd.reply("", 200, "text/plain", {});
			return preProcess(r, hres);
		} catch(e) {
			logErr("nOutput_HTTP_HealthZ | Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
	});

	log("Output_HTTP_HealthZ | Output HTTP HealthZ created on " + aPort + " with relativePath '" + relativePath + "'");

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP_HealthZ, nOutput);

nOutput_HTTP_HealthZ.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
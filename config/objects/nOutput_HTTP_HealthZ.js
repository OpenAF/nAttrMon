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

    var hauth_perms, hauth_func;
	var hauth_type = _$(aMap.authType, "hauthType").isString().default("none");
	if (isDef(aMap.auth)) hauth_perms = aMap.auth;
	if (isDef(aMap.authLocal)) hauth_perms = aMap.authLocal;
	if (isDef(aMap.authCustom)) hauth_func = aMap.authCustom;

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
	var parent = this;

    var fnAuth = function(u, p, s, r) { 
		u = String(u);
	    p = String(p);

		if (isDef(hauth_func) && isString(hauth_func)) {
		  return (new Function('u', 'p', 's', 'r', hauth_func))(u, p, s, r);
		} else {
		  if (isDef(hauth_perms) && isDef(hauth_perms[u])) {
			if (p == Packages.openaf.AFCmdBase.afc.dIP(hauth_perms[u].p)) {
			  r.channelPermission = (isDef(hauth_perms[u].m) ? hauth_perms[u].m : "r");
			  return true;
			} else {
			  return false;
			}
		  } else {
			return false;
		  }
		}
	};
    
	var preProcess = (aReq, aReply) => {
		var res = aReply, user = "";
		res.header = _$(res.header).default({});
		if (isDef(hauth_perms) && hauth_type != "none") {
			if (hauth_type == "basic") {
				res = ow.server.httpd.authBasic("nattrmon", httpd, aReq, (u, p, s, r) => {
					if (!isString(u) || !isString(p)) return false;
					user = String(u);
					return fnAuth(user, p, s, r); 
				}, () => { try {
					var data = merge(aReq, { 
						reply: {
							status  : aReply.status,
							mimetype: aReply.mimetype
						},
						user: "'" + user + "'"
					});
					try { 
						tlog(parent.auditTemplate, data);
					} catch(e) {
						logErr("Error on auditing access: " + String(e));
					}
					return aReply; } catch(e) {sprintErr(e)}
				}, hss => {
					if (user != "") tlogWarn(parent.auditTemplate, merge(aReq, {
						method: "AUTH_FAILED",
						user  : "'" + user + "'",
						reply : { status: 401, mimetype: "text/plain" }
					}));
					return hss.reply("Not authorized.", "text/plain", ow.server.httpd.codes.UNAUTHORIZED);
				});
			}
			res.header["Set-Cookie"] = "nattrmon_auth=1";
		} else {
			res.header["Set-Cookie"] = "nattrmon_auth=0";
			var data = merge(aReq, { 
				reply: {
					status  : aReply.status,
					mimetype: aReply.mimetype
				}, 
				user : ""
			});
			try { 
				tlog(parent.auditTemplate, data);
			} catch(e) {
				logErr("Error on auditing access: " + String(e));
			}
		}

		return res;
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
			try {
				var hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
				return preProcess(req, hres);
			} catch(e) {
				logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
        }
    }
    if (parent.includeLiveZ) {
        routes["/livez"] = function(req) {
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
				logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
        }
    }
    if (parent.includeReadyZ) {
        routes["/readyz"] = function(req) {
			try {
				if (nattrmon.alive) {
					var hres = ow.server.httpd.reply("OK", 200, "text/plain", {});
					return preProcess(req, hres);
				} else {
					var hres = ow.server.httpd.reply("Not ready", 503, "text/plain", {});
					return preProcess(req, hres);
				}
			} catch(e) {
				logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
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
			logErr("Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
	});

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP_HealthZ, nOutput);

nOutput_HTTP_HealthZ.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
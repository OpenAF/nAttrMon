// aTitle, aRefreshTime, aPort
var nOutput_HTTP = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aTitle = isDef(aMap.title) ? aMap.title : "Untitled";
	var aPort = isDef(aMap.port) ? aMap.port : 8090;
	var aRefreshTime = isDef(aMap.refreshTime) ? aMap.refreshTime : 2500;
	var path = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath()).canonicalPath;

	this.audit = (isDef(aMap.audit) ? aMap.audit : true);
	this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);

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
	this.title = aTitle;
	
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

	// Set session data
	nattrmon.setSessionData("httpd.summary.custom", {
		"title": aTitle,
		"refresh": aRefreshTime
	});

	var preProcess = (aReq, aReply) => {
		var res = aReply, user = "";
		res.header = _$(res.header).default({});
		if (isDef(hauth_perms) && hauth_type != "none") {
			if (hauth_type == "basic") {
				res = ow.server.httpd.authBasic("nattrmon", httpd, aReq, (u, p, s, r) => {
					if (isString(u)) user = u;
					if (!isString(u) || !isString(p)) return false;
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

	// Add function to server
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
		"/f": function (r) {
			try {
				if (r.uri == "/f") r.uri = "/index.html"
				var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/f", r.uri)		
				return preProcess(r, hres)
			} catch(e) {
				logErr("Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		},
		"/meta": function (req) {
			try {
				var ret = {}
				ret = nattrmon.getSessionData("httpd.summary.custom")

				var hres = httpd.replyOKJSON(beautifier(ret))
				return preProcess(req, hres)
			} catch(e) {
				logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		},
		"/": function (r) {
			try {
				if (r.uri == "/") r.uri = "/index.html"
				var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", r.uri)			
				return preProcess(r, hres)
			} catch(e) {
				logErr("Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		}
	}), function (r) {
		try {
			if (r.uri == "/") r.uri = "/index.html";
			var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", r.uri);
			return preProcess(r, hres);
		} catch(e) {
			logErr("Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
	});

	nattrmon.setSessionData("httpd.summary.custom", {
		"title": this.title,
		"refresh": aRefreshTime
	});

	log("Output_HTTP | Output HTTP created on " + aPort);

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP, nOutput);

nOutput_HTTP.prototype.output = function (scope, args, meta) {
	/*scope.setSessionData("httpd.summary.custom", {
		"title": this.title,
		"refresh": meta.getTime()
	});*/
};

nOutput_HTTP.prototype.close = function () {
	nattrmon.getSessionData(hS).stop();
};

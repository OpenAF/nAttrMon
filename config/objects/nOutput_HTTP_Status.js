var nOutput_HTTP_Status = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aPort = 8090;
    if (isNumber(aMap)) aMap = { port: aMap }; 
    if (isUnDef(aMap) || isNull(aMap)) aMap = { port: aPort };
	if (isMap(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
	} else {
		aMap = {};
	}

	// BEGIN - FROM nOutput_HTMLStatus
	this.path           = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath()).canonicalPath;
    this.levelsIncluded = _$(aMap.levelsIncluded, "levelsIncluded").isArray().default([ "HIGH", "MEDIUM", "LOW", "INFO"]);
    this.redLevels      = _$(aMap.redLevels, "redLevels").isArray().default(["HIGH"]);
    this.yellowLevels   = _$(aMap.yellowLevels, "yellowLevels").isArray().default(["MEDIUM"]);
    this.greenLevels    = _$(aMap.greenLevels, "greenLevels").isArray().default(["LOW", "INFO"]);
    this.controls       = _$(aMap.controls, "controls").isArray().default(__);
	this.redText        = _$(aMap.redText, "redText").isString().default("NOT OK");
    this.yellowText     = _$(aMap.yellowText, "yellowText").isString().default("Issues");
    this.greenText      = _$(aMap.greenText, "greenText").isString().default("OK");

    this.levelsIncluded = this.levelsIncluded.map(r => r.toUpperCase());
    this.redLevels      = this.redLevels.map(r => r.toUpperCase());
    this.yellowLevels   = this.yellowLevels.map(r => r.toUpperCase());
    this.greenLevels    = this.greenLevels.map(r => r.toUpperCase());
	// END - FROM nOutput_HTMLStatus

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

	// Add function to server
	//httpd.addEcho("/echo");
    var parent = this;
    var routes = {};
    routes["/status"] = function(req) {
		try {
			var hres = ow.server.httpd.reply(parent.status(), 200, "text/html", {});
			return preProcess(req, hres);
		} catch(e) {
			logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
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
inherit(nOutput_HTTP_Status, nOutput);

nOutput_HTTP_Status.prototype.status = function() {
	var warns = [];
    var data = nattrmon.getWarnings();
	// BEGIN - FROM nOutput_HTMLStatus
    
    Object.keys(data).forEach(l => {
        switch(l.toUpperCase()) {
        case "HIGH"  : warns = warns.concat(data[nWarning.LEVEL_HIGH]); break;
        case "MEDIUM": warns = warns.concat(data[nWarning.LEVEL_MEDIUM]); break;
        case "LOW"   : warns = warns.concat(data[nWarning.LEVEL_LOW]); break;
        case "INFO"  : warns = warns.concat(data[nWarning.LEVEL_INFO]); break;
        case "CLOSED": warns = warns.concat(data[nWarning.LEVEL_CLOSED]); break;
        }
    });

    var cwarns = [];
    if (isUnDef(this.controls)) {
        cwarns = warns;
    } else {
        this.controls.forEach(ctl => {
            warns.forEach(l => {
                if (l.title.match(new RegExp(ctl))) {
                    cwarns.push(l);
                }
            });
        });
    }
                  
	var apath  = this.path + "/objects.assets/noutputstatus";
    var red    = templify(io.readFileString(apath + "/red.md"),    { redText: this.redText });
    var yellow = templify(io.readFileString(apath + "/yellow.md"), { yellowText: this.yellowText });
    var green  = templify(io.readFileString(apath + "/green.md"),  { greenText: this.greenText });

    var out = $from(cwarns)
              .sort("title")
              .select(r => {
                var status = green;
                if (this.greenLevels.indexOf(r.level.toUpperCase()) >= 0)  status = green; 
                if (this.yellowLevels.indexOf(r.level.toUpperCase()) >= 0) status = yellow; 
                if (this.redLevels.indexOf(r.level.toUpperCase()) >= 0)    status = red;
                return {
                    control: r.title,
                    status : status
                };
              });

    var md = templify(io.readFileString(apath + "/status.md"), {
        statuses: out,
		date    : (new Date()).toISOString()
    })
	// END - FROM nOutput_HTMLStatus
    return ow.template.html.genStaticVersion4MD(md);
}

nOutput_HTTP_Status.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
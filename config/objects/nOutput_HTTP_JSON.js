var nOutput_HTTP_JSON = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aPort = 8090;
	if (isMap(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
	} else {
		if (isNumber(aMap)) aPort = Number(aMap);
		aMap = {};
		this.audit = true;
		this.auditTemplate = AUDIT_TEMPLATE;
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

    var fnAuth = function(u, p, s, r) {
		if (isDef(hauth_func) && isString(hauth_func)) {
		  return (new Function('u', 'p', 's', 'r', hauth_func))(u, p, s, r);
		} else {
		  if (isDef(hauth_perms) && isDef(hauth_perms[u])) {
			if (p == hauth_perms[u].p) {
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

		var res = aReply;
		res.header = _$(res.header).default({});
		if (isDef(hauth_perms) && hauth_type != "none") {
			if (hauth_type == "basic") {
				res = ow.server.httpd.authBasic("nattrmon", httpd, aReq, fnAuth, () => {
					return aReply;
				}, hss => {
					return hss.reply("Not authorized.", "text/plain", ow.server.httpd.codes.UNAUTHORIZED);
				});
			}
			res.header["Set-Cookie"] = "nattrmon_auth=1";
		} else {
			res.header["Set-Cookie"] = "nattrmon_auth=0";
		}

		return res;
	}

	// Add function to server
	//httpd.addEcho("/echo");
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
		"/json": function (req) {
			switch (req.params.op) {
				case "histtime":
					res = {
						"history": nattrmon.getHistoryValuesByTime(req.params.attr, req.params.seconds)
					};
					break;
				case "histevent":
					res = {
						"history": nattrmon.getHistoryValuesByEvents(req.params.attr, req.params.events)
					};
					break;
				case "plugs":
					var tmp = $ch("nattrmon::plugs").getAll();
					res = {
						plugs: {
							inputs: $from(tmp).equals("meta.type", "inputs").select(),
							validations: $from(tmp).equals("meta.type", "validations").select(),
							outputs: $from(tmp).equals("meta.type", "outputs").select(),
						}
					};
					break;
				default:
					var attrs, warns, 
						cvals = nattrmon.getCurrentValues(), 
						lvals = nattrmon.getLastValues();
					if (isDef(req.params.ct)) {
						attrs = $from(nattrmon.getAttributes(true)).contains("category", req.params.ct).select();
						warns = $stream($from(nattrmon.getWarnings(true).getCh().getAll()).contains("category", req.params.ct).select()).groupBy("level");
						$from(nattrmon.getAttributes(true)).notContains("category", req.params.ct).select((r) => { delete cvals[r.name]; });
						$from(nattrmon.getAttributes(true)).notContains("category", req.params.ct).select((r) => { delete lvals[r.name]; });
					} else {
						attrs = nattrmon.getAttributes(true);
						warns = nattrmon.getWarnings();
					}
					res = {
						"warnings": warns,
						"attributes": ow.obj.fromArray2Obj(attrs, "name", true),
						"values": cvals,
						"lastvalues": lvals
					}
					break;
			}
			var hres = httpd.replyOKJSON(stringify(res));
			return preProcess(req, hres);
		}
	}), function (r) {
		var hres = httpd.replyOKJSON(stringify({}));
		return preProcess(r, hres);
	});

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP_JSON, nOutput);

nOutput_HTTP_JSON.prototype.refresh = function (scope) {
	// Set session data
	scope.setSessionData("httpd.json.data", {
		"warnings": scope.getWarnings(),
		"attributes": ow.obj.fromArray2Obj(scope.getAttributes(true), "name", true),
		"values": scope.getCurrentValues(),
		"lastvalues": scope.getLastValues()
	});
};

nOutput_HTTP_JSON.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
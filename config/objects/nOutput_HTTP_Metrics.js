var nOutput_HTTP_Metrics = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

    ow.loadMetrics();

	var aPort = 8090;
	if (isNumber(aMap)) aMap = { port: aMap }; 
	if (isUnDef(aMap) || isNull(aMap)) aMap = { port: aPort };
	if (isMap(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
        this.includeSelf  = _$(aMap.includeSelf, "includeSelf").isBoolean().default(false);
        this.includeCVals = _$(aMap.includeCVals, "includeCVals").isBoolean().default(true);
        this.includeLVals = _$(aMap.includeLVals, "includeLVals").isBoolean().default(false);
        this.includeWarns = _$(aMap.includeWarns, "includeWarns").isBoolean().default(true);

        this.nameSelf  = _$(aMap.nameSelf, "nameSelf").isString().default("nattrmon");
        this.nameCVals = _$(aMap.nameCVals, "nameCVals").isString().default("nattrmon_cval");
        this.nameLVals = _$(aMap.nameLVals, "nameLVals").isString().default("nattrmon_lval");
        this.nameWarns = _$(aMap.nameWarns, "nameWarns").isString().default("nattrmon_warn");
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
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
		"/metrics": function (req) {
            var res = "";
			switch (req.params.op) {
            default:
                if (parent.includeSelf)  res += ow.metrics.fromObj2OpenMetrics(ow.metrics.getAll(), parent.nameSelf);
                if (parent.includeCVals) res += _parse(nattrmon.getCurrentValues(), parent.nameCVals);
                if (parent.includeLVals) res += _parse(nattrmon.getLastValues(), parent.nameLVals);
                if (parent.includeWarns) res += _parse(nattrmon.getWarnings(), parent.nameWarns);
                break;
			}
			var hres = ow.server.httpd.reply(res, 200, "text/plain", {});
            hres.data = String(hres.data).replace(/\n+/g, "\n");
			return preProcess(req, hres);
		}
	}), function (r) {
		var hres = ow.server.httpd.reply("", 200, "text/plain", {});
		return preProcess(r, hres);
	});

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP_Metrics, nOutput);

nOutput_HTTP_Metrics.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
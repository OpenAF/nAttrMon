var nOutput_HTTP_Metrics = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

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

		this.chName   = _$(aMap.chName, "chName").isString().default(__);
		this.chType   = _$(aMap.chType, "chType").isString().default(__);
		this.chParams = _$(aMap.chParams, "chParams").isMap().default(__);
		this.chPeriod = _$(aMap.chPeriod, "chPeriod").isNumber().default(5000);

		this.format   = _$(aMap.format, "format").isString().default(__)

		if (isDef(this.chName) && this.chPeriod > 0) $ch(this.chName).create(1, this.chType, this.chParams);
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

	ow.metrics.add("nattrmon", () => {
		var _a = nattrmon.getAttributes(true); 
		var _c = nattrmon.getCurrentValues(true);
		var _l = nattrmon.getLastValues(true);
		var _w = nattrmon.getWarnings();

		var stats = { poolsStats: [] };

        for(var i in nattrmon.objPools) {
          var pool = nattrmon.objPools[i];

          stats.poolsStats.push({
            poolName: i,
            min: pool.__min,
            max: pool.__max,
            increment: pool.__inc,
            timeout: pool.__timeout,
            keepAliveTime: pool.__keepaliveTime,
            poolSize: pool.__pool.length,
            freeObjects: pool.__currentFree,
            currentSize: pool.__currentSize
          });
        }

		var res = {
			numAttrs      : _a.length,
			numCVals      : _c.size(),
			numLVals      : _l.size(),
			numWarnsHigh  : isDef(_w[nWarning.LEVEL_HIGH])   ? Object.keys(_w[nWarning.LEVEL_HIGH]).length : 0,
			numWarnsMedium: isDef(_w[nWarning.LEVEL_MEDIUM]) ? Object.keys(_w[nWarning.LEVEL_MEDIUM]).length : 0,
			numWarnsLow   : isDef(_w[nWarning.LEVEL_LOW])    ? Object.keys(_w[nWarning.LEVEL_LOW]).length : 0,
			numWarnsInfo  : isDef(_w[nWarning.LEVEL_INFO])   ? Object.keys(_w[nWarning.LEVEL_INFO]).length : 0,
			numWarnsClosed: isDef(_w[nWarning.LEVEL_CLOSED]) ? Object.keys(_w[nWarning.LEVEL_CLOSED]).length : 0,
			lastCheck     : (_a.length <= 0 ? -1 : (new Date( $from( _a ).sort("-lastcheck").at(0).lastcheck )).getTime()),
			lastWarnHigh  : _w[nWarning.LEVEL_HIGH].length > 0   ? (new Date( $from(_w[nWarning.LEVEL_HIGH]).sort("-lastupdate").at(0).lastupdate )).getTime() : -1,
			lastWarnMedium: _w[nWarning.LEVEL_MEDIUM].length > 0 ? (new Date( $from(_w[nWarning.LEVEL_MEDIUM]).sort("-lastupdate").at(0).lastupdate )).getTime() : -1,
			lastWarnLow   : _w[nWarning.LEVEL_LOW].length > 0    ? (new Date( $from(_w[nWarning.LEVEL_LOW]).sort("-lastupdate").at(0).lastupdate )).getTime() : -1,
			lastWarnInfo  : _w[nWarning.LEVEL_INFO].length > 0   ? (new Date( $from(_w[nWarning.LEVEL_INFO]).sort("-lastupdate").at(0).lastupdate )).getTime() : -1,
			lastWarnClosed: _w[nWarning.LEVEL_CLOSED].length > 0 ? (new Date( $from(_w[nWarning.LEVEL_CLOSED]).sort("-lastupdate").at(0).lastupdate )).getTime() : -1,
			plugsExecuting: $ch(nattrmon.chPS).size(),
			poolsStats    : stats
		};

		res.numWarns = res.numWarnsHigh + res.numWarnsMedium + res.numWarnsLow + res.numWarnsInfo + res.numWarnsClosed;
		res.lastWarn = -1;
		if (res.lastWarnHigh > res.lastWarn)   res.lastWarn = res.lastWarnHigh;
		if (res.lastWarnMedium > res.lastWarn) res.lastWarn = res.lastWarnMedium;
		if (res.lastWarnLow > res.lastWarn)    res.lastWarn = res.lastWarnLow;
		if (res.lastWarnInfo > res.lastWarn)   res.lastWarn = res.lastWarnInfo;
		if (res.lastWarnClosed > res.lastWarn) res.lastWarn = res.lastWarnClosed;
		return res;
	});

	if (isDef(this.chName) && this.chPeriod > 0) ow.metrics.startCollecting(this.chName, this.chPeriod);

	// Add function to server
	//httpd.addEcho("/echo");
    var parent = this;
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
		"/metrics": function (req) {
			try {
				var res = "";
				var fmt = _$(req.params.format).default(parent.format)
				switch (fmt) {
				case "json":
					var _res = {}
					if (isDef(req.params.type)) {
						switch(req.params.type) {
						case "self" : _res = ow.metrics.getAll(); break
						case "cvals": _res = nattrmon.getCurrentValues(); break
						case "lvals": _res = nattrmon.getLastValues(); break
						case "warns": _res = nattrmon.getWarnings(); break
						}
					} else {
						if (parent.includeSelf)  _res[parent.nameSelf] = ow.metrics.getAll()
						if (parent.includeCVals) _res[parent.nameCVals] = nattrmon.getCurrentValues()
						if (parent.includeLVals) _res[parent.nameLVals] = nattrmon.getLastValues()
						if (parent.includeWarns) _res[parent.nameWarns] = nattrmon.getWarnings()
					}
					res = stringify(_res, __, "")
					break;
				default:
					if (isDef(req.params.type)) {
						switch(req.params.type) {
						case "self" : res += ow.metrics.fromObj2OpenMetrics(ow.metrics.getAll(), parent.nameSelf); break
						case "cvals": res += _parse(nattrmon.getCurrentValues(), parent.nameCVals); break
						case "lvals": res += _parse(nattrmon.getLastValues(), parent.nameLVals); break
						case "warns": res += _parse(nattrmon.getWarnings(), parent.nameWarns); break
						}
					} else {
						if (parent.includeSelf)  res += ow.metrics.fromObj2OpenMetrics(ow.metrics.getAll(), parent.nameSelf);
						if (parent.includeCVals) res += _parse(nattrmon.getCurrentValues(), parent.nameCVals);
						if (parent.includeLVals) res += _parse(nattrmon.getLastValues(), parent.nameLVals);
						if (parent.includeWarns) res += _parse(nattrmon.getWarnings(), parent.nameWarns);
					}
					break;
				}
				var hres = ow.server.httpd.reply(res, 200, "text/plain", {});
				hres.data = String(hres.data).replace(/\n+/g, "\n");
				return preProcess(req, hres);
			} catch(e) {
				logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		}
	}), function (r) {
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
inherit(nOutput_HTTP_Metrics, nOutput);

nOutput_HTTP_Metrics.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
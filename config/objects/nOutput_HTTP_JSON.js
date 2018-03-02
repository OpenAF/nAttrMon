var nOutput_HTTP_JSON = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aPort;
	if (isObject(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
	} else {
		aPort = aMap;
	}

	// Set server if doesn't exist
	if (isDef(aPort) || !nattrmon.hasSessionData("httpd")) {
		nattrmon.setSessionData("httpd",
			ow.server.httpd.start(isUnDef(aPort) ? 8090 : aPort, aMap.host));
	}

	// Get server
	var httpd = nattrmon.getSessionData("httpd");

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
			auditAccess(req, hres);
			return hres;
		}
	}), function (r) {
		var hres = httpd.replyOKJSON(stringify({}));
		auditAccess(r, hres);
		return hres;
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
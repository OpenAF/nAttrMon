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
	if (!nattrmon.hasSessionData("httpd")) {
		plugin("HTTPServer");
		nattrmon.setSessionData("httpd",
			new HTTPd(isUndefined(aPort) ? 8090 : aPort), aMap.host);
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
					res = {
						"warnings": nattrmon.getWarnings(),
						"attributes": ow.obj.fromArray2Obj(nattrmon.getAttributes(true), "name", true),
						"values": nattrmon.getCurrentValues(),
						"lastvalues": nattrmon.getLastValues()
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
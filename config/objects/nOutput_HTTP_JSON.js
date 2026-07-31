var nOutput_HTTP_JSON = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

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

	var _route = nattrmon.getHttpRouteHelpers(aMap, aPort);
	var relativePath = _route.relativePath;

	// Set server if doesn't exist
	var hS = "httpd";

	if (isDef(aMap.httpSession)) hS = aMap.httpSession;

	// Get server
	var httpd = nattrmon.ensureHttpSession(hS, aPort, aMap.host, aMap.keyStore, aMap.keyPassword);
	var parent = this;

	var preProcess = nattrmon.getHttpPreProcessFn(aMap, httpd, parent, "nOutput_HTTP_JSON");
	var routePath = _route.routePath;

	var routes = {};

	// Add function to server
	//httpd.addEcho("/echo");
	routes[routePath("/json")] = function (req) {
			try {
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
			} catch(e) {
				logErr("nOutput_HTTP_JSON |Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
	};

	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, routes), function (r) {
		try {
			var hres = httpd.replyOKJSON(stringify({}));
			return preProcess(r, hres);
		} catch(e) {
			logErr("nOutput_HTTP_JSON |Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
	});

	log("Output_HTTP_JSON | Output HTTP JSON created on " + aPort + " with relativePath '" + relativePath + "'");

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
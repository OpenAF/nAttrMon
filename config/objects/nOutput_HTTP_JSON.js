var nOutput_HTTP_JSON = function (aMap) {
	var aPort;
	if (isObject(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
	} else {
		aPort = aMap;
	}

	// Set server if doesn't exist
	if (!nattrmon.hasSessionData("httpd")) {
		plugin("HTTPServer");
		nattrmon.setSessionData("httpd",
			new HTTPd(isUndefined(aPort) ? 17878 : aPort));
	}

	// Get server
	var httpd = nattrmon.getSessionData("httpd");

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
					res = {
						plugs: $ch("nattrmon::plugs").getAll()
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
			return httpd.replyOKJSON(stringify(res));
		}
	}), function (r) {
		return httpd.replyOKJSON(stringify({}));
	});

	nOutput.call(this, this.output);
}
inherit(nOutput_HTTP_JSON, nOutput);

nOutput_HTTP_JSON.prototype.refresh = function (scope) {
	// Set session data
	scope.setSessionData("httpd.json.data", {
		"warnings": scope.getWarnings(),
		"attributes": ow.obj.fromArray2Obj(scope.getAttributes(true), "name", true),
		"values": scope.getCurrentValues(),
		"lastvalues": scope.getLastValues()
	});
}

nOutput_HTTP_JSON.prototype.output = function (scope, args) {
	//this.refresh(scope);
}
var nOutput_HTTP = function(aTitle, aRefreshTime, aPort) {
	// Set server if doesn't exist
	if (!nattrmon.hasSessionData("httpd")) {
		plugin("HTTPServer");
		var hs = new HTTPd(isUndefined(aPort) ? 8090 : aPort);
		nattrmon.setSessionData("httpd", hs);
	}

	// Get server
	var httpd = nattrmon.getSessionData("httpd");
	this.title = (isUndefined(aTitle) ? "Untitled" : aTitle);

	// Set session data
	nattrmon.setSessionData("httpd.summary.custom", {
		"title"  : (isUndefined(aTitle) ? "Untitled" : aTitle),
		"refresh": (isUndefined(aRefreshTime) ? 1000 : aRefreshTime)
	});

	// Add function to server
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
           "/f": function(r) {
              if (r.uri == "/f") r.uri = "/index.html";
              return ow.server.httpd.replyFile(httpd, nattrmon.getConfigPath() + "/objects.assets/noutputhttp", "/f", r.uri);
           },
           "/meta": function(req) {
	//httpd.addFileBrowse("/f", nattrmon.getConfigPath() + "/objects.assets/noutputhttp");
	//httpd.setDefault("/f");
	//httpd.add("/meta", function(req) {
		var ret = {};

		ret = nattrmon.getSessionData("httpd.summary.custom");

		return httpd.replyOKJSON(beautifier(ret));
           }
	}), function(r) {
            if (r.uri == "/") r.uri = "/index.html";
            return ow.server.httpd.replyFile(httpd, nattrmon.getConfigPath() + "/objects.assets/noutputhttp", "/", r.uri);
        });
	/*httpd.addXDTServer("/xdt",
		function(auth) {
			if (auth.getUser() == 'nattrmon' &&
				auth.getPass() == 'nattrmon')
				return true;
			else
				return false;
		},
		function(sid, ops, pin, req) {
			var pout = {};

			switch(ops) {
			case "GetAttributes":
				pout = { "attributes": nattrmon.getAttributes(true) };
				break;
			case "GetAttributesValues":
				pout = { "values": nattrmon.getCurrentValues() };
				break;
			case "GetAttributesValuesMap":
				pout = { "values": [] };
				var attrs = nattrmon.getCurrentValues();
				for(i in attrs) {
					pout.values.push({
						"name": i,
						"val" : attrs[i].val,
						"date": attrs[i].date
					});
				}
				break;
			case "GetAttributesLastValues":
				pout = { "values": nattrmon.getLastValues() };
				break;
			case "GetAttributesLastValuesMap":
				pout = { "values": [] };
				var attrs = nattrmon.getLastValues();
				for(i in attrs) {
					pout.values.push({
						"name": i,
						"val" : attrs[i].val,
						"date": attrs[i].date
					});
				}
				break;
			case "GetAttributeHistoryByEvents":
				try {
					pout.history = nattrmon.getHistoryValuesByEvents(pin.attr, pin.events);
				} catch(e) {
					pout.result = 0;
					pout.message = e.message;
				}
				break;
			case "GetAttributeHistoryByTime":
				try {
					pout.history = nattrmon.getHistoryValuesByTime(pin.attr, pin.seconds);
				} catch(e) {
					pout.result = 0;
					pout.message = e.message;
				}
				break;
			case "Restart":
				try {
					nattrmon.restart();
					pout.result = 1;
				} catch(e) {
					pout.result = 0;
					pout.message = e.message;
				}
				break;
			case "ReloadPlugs":
				try {
					nattrmon.genSnapshot();
					nattrmon.stopObjects();
					nattrmon.loadPlugs();
					nattrmon.restoreSnapshot();
					pout.result = 1;
				} catch(e) {
					pout.result = 0;
					pout.message = e.message;
				}
				break;
                case "GetWarnings":
                        try {
                                pout = { "warnings": nattrmon.getWarnings() };
                                pout.result = 1;
                        } catch(e) {
                                pout.result = 0;
                                pout.message = e.message;
                        }
                        break;
                case "CloseWarnings":
                        try {
                                var w = nattrmon.getWarnings();
                                w.High = {}; w.Medium = {}; w.Low = {};
                                pout = { "warnings": nattrmon.getWarnings() };
                                pout.result = 1;
                        } catch(e) {
                                pout.result = 0;
                                pout.message = e.message;
                        }
                        break;				
			case "Help":
			default:
				pout = {
					"Available ops": {
						"Help": "",
						"GetAttributes": "",
						"GetAttributesValues": "",
						"GetAttributesValuesMap": "",
						"GetAttributesLastValues": "",
						"GetAttributesLastValuesMap": "",
						"GetAttributeHistoryByTime":  "{\"attr\": \"myAttribute\", \"seconds\": 1}",
						"GetAttributeHistoryByEvents": "{\"attr\": \"myAttribute\", \"events\": 1}",
						"GetWarnings": "",
						"CloseWarnings": "",
						"ReloadPlugs": "",
						"Restart": ""
					}
				}
				break;
			}
			return pout;
		});*/
	
	nOutput.call(this, this.output);
}
inherit(nOutput_HTTP, nOutput);

nOutput_HTTP.prototype.output = function(scope, args, meta) {
	scope.setSessionData("httpd.summary.custom", {
		"title": this.title,
		"refresh": meta.getTime()
	});
}

nOutput_HTTP.prototype.close = function() {
	nattrmon.getSessionData("httpd").stop();
}

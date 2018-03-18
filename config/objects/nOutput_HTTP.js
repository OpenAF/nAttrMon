// aTitle, aRefreshTime, aPort
var nOutput_HTTP = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aTitle = isDef(aMap.title) ? aMap.title : "Untitled";
	var aPort = isDef(aMap.port) ? aMap.port : 8090;
	var aRefreshTime = isDef(aMap.refreshTime) ? aMap.refreshTime : 1000;
	var path = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath()).canonicalPath;

	this.audit = (isDef(aMap.audit) ? aMap.audit : true);
	this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);

	// Set server if doesn't exist
	var hS = "httpd";

	if (isDef(aMap.httpSession)) hS = aMap.httpSession;
	if (!nattrmon.hasSessionData(hS)) {
		var hs = ow.server.httpd.start(aPort, aMap.host, aMap.keyStore, aMap.keyPassword);
		nattrmon.setSessionData(hS, hs);
	}

	// Get server
	var httpd = nattrmon.getSessionData(hS);
	this.title = aTitle;

	// Set session data
	nattrmon.setSessionData("httpd.summary.custom", {
		"title": aTitle,
		"refresh": aRefreshTime
	});

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
	};

	// Add function to server
	ow.server.httpd.route(httpd, ow.server.httpd.mapRoutesWithLibs(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
		"/f": function (r) {
			if (r.uri == "/f") r.uri = "/index.html";
			var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/f", r.uri);			
			auditAccess(r, hres);
			return hres;
		},
		"/meta": function (req) {
			var ret = {};

			ret = nattrmon.getSessionData("httpd.summary.custom");

			var hres = httpd.replyOKJSON(beautifier(ret));
			auditAccess(req, hres);
			return hres;
		},
		"/": function (r) {
			if (r.uri == "/") r.uri = "/index.html";
			var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", r.uri);			
			auditAccess(r, hres);
			return hres;
		},
	}), function (r) {
		if (r.uri == "/") r.uri = "/index.html";
		var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", r.uri);
		auditAccess(r, hres);
		return hres;
	}));

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

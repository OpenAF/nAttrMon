// aTitle, aRefreshTime, aPort
var nOutput_HTTP = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aTitle = isDef(aMap.title) ? aMap.title : "Untitled";
	var aPort = isDef(aMap.port) ? aMap.port : 8090;
	var aRefreshTime = isDef(aMap.refreshTime) ? aMap.refreshTime : 2500;
	var path = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath("objects.assets/noutputhttp")).canonicalPath;
	var _route = nattrmon.getHttpRouteHelpers(aMap, aPort);
	var relativePath = _route.relativePath;

	this.audit = (isDef(aMap.audit) ? aMap.audit : true);
	this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);

	// Set server if doesn't exist
	var hS = "httpd";

	if (isDef(aMap.httpSession)) hS = aMap.httpSession;

	// Get server
	var httpd = nattrmon.ensureHttpSession(hS, aPort, aMap.host, aMap.keyStore, aMap.keyPassword);
	this.hS = hS;
	this.httpd = httpd;
	var parent = this;
	this.title = aTitle;

	// Set session data
	nattrmon.setSessionData("httpd.summary.custom", {
		"title": aTitle,
		"refresh": aRefreshTime
	});

	var preProcess = nattrmon.getHttpPreProcessFn(aMap, httpd, parent, "nOutput_HTTP");
	var routePath = _route.routePath;
	var stripBasePath = _route.stripBasePath;

	var routes = {};

	routes[routePath("/f")] = function (r) {
			try {
				var localUri = stripBasePath(r.uri);
				if (localUri == "/f") localUri = "/index.html"
				var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/f", localUri)
				return preProcess(r, hres)
			} catch(e) {
				logErr("nOutput_HTTP | Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		};

	routes[routePath("/meta")] = function (req) {
			try {
				var ret = {}
				ret = nattrmon.getSessionData("httpd.summary.custom")

				var hres = httpd.replyOKJSON(beautifier(ret))
				return preProcess(req, hres)
			} catch(e) {
				logErr("nOutput_HTTP | Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		};

	routes[routePath("/")] = function (r) {
			try {
				var localUri = stripBasePath(r.uri);
				if (localUri == "/") localUri = "/index.html"
				var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", localUri)
				return preProcess(r, hres)
			} catch(e) {
				logErr("nOutput_HTTP | Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
				if (isJavaException(e)) e.javaException.printStackTrace()
				return ow.server.httpd.reply("Error (check logs)", 500)
			}
		};

	if (!_route.useNativePrefix && relativePath !== "/") routes[relativePath + "/"] = routes[routePath("/")];

	// Add function to server
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, ow.server.httpd.mapRoutesWithLibs(httpd, routes), function (r) {
		try {
			var localUri = stripBasePath(r.uri);
			if (localUri == "/") localUri = "/index.html";
			var hres = ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", localUri);
			return preProcess(r, hres);
		} catch(e) {
			logErr("nOutput_HTTP | Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
	}));

	try {
		nattrmon.setSessionData("httpd.summary.custom", {
			"title": this.title,
			"refresh": aRefreshTime
		});
	} catch(e) {
		logErr("nOutput_HTTP | Error in setSessionData " + String(e))
		if (isJavaException(e)) e.javaException.printStackTrace()
	}

	log("Output_HTTP | Output HTTP created on " + aPort + " with relativePath '" + relativePath + "'");

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
	try {
		// Multiple output plugs (JSON, Channels, Metrics, HealthZ, ...) can share the same
		// httpd session (keyed by hS). Only stop the server this instance started/reused if
		// the session no longer points at it -- e.g. a port-change reload repointed the
		// session to a new server, orphaning this one. On a same-port reload the session
		// still points at this same server (reused, not restarted, by the just-constructed
		// replacement instance), so it must be left running for that instance and any siblings.
		if (isDef(this.httpd) && nattrmon.getSessionData(this.hS) !== this.httpd) {
			this.httpd.stop();
		}
	} catch (e) {
		logErr("nOutput_HTTP | Close exception: " + stringify(e))
		if (isJavaException(e)) e.javaException.printStackTrace()
	}
};

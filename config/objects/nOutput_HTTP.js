// aTitle, aRefreshTime, aPort
var nOutput_HTTP = function (aMap) {

	var aTitle = isDef(aMap.title) ? aMap.title : "Untitled";
	var aPort = isDef(aMap.port) ? aMap.port : 8090;
	var aRefreshTime = isDef(aMap.refreshTime) ? aMap.refreshTime : 1000;
	var path = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath()).canonicalPath;

	// Set server if doesn't exist
	if (!nattrmon.hasSessionData("httpd")) {
		plugin("HTTPServer");
		var hs = new HTTPd(aPort, aMap.host);
		nattrmon.setSessionData("httpd", hs);
	}

	// Get server
	var httpd = nattrmon.getSessionData("httpd");
	this.title = aTitle;

	// Set session data
	nattrmon.setSessionData("httpd.summary.custom", {
		"title": aTitle,
		"refresh": aRefreshTime
	});

	// Add function to server
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, {
		"/f": function (r) {
			if (r.uri == "/f") r.uri = "/index.html";
			return ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/f", r.uri);
		},
		"/meta": function (req) {
			var ret = {};

			ret = nattrmon.getSessionData("httpd.summary.custom");

			return httpd.replyOKJSON(beautifier(ret));
		}
	}), function (r) {
		if (r.uri == "/") r.uri = "/index.html";
		return ow.server.httpd.replyFile(httpd, path + "/objects.assets/noutputhttp", "/", r.uri);
	});

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
	nattrmon.getSessionData("httpd").stop();
};

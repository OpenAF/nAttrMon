var nOutput_HTTP_Status = function (aMap) {
	var AUDIT_TEMPLATE = "AUDIT HTTP | {{method}} {{uri}} {{{user}}} {{reply.status}} {{reply.mimetype}} ({{header.remote-addr}}; {{header.user-agent}})";

	var aPort = 8090;
    if (isNumber(aMap)) aMap = { port: aMap }; 
    if (isUnDef(aMap) || isNull(aMap)) aMap = { port: aPort };
	if (isMap(aMap)) {
		if (isDef(aMap.port)) aPort = aMap.port;
		this.audit = (isDef(aMap.audit) ? aMap.audit : true);
		this.auditTemplate = (isDef(aMap.auditTemplate) ? aMap.auditTemplate : AUDIT_TEMPLATE);
	} else {
		aMap = {};
	}

	var _route = nattrmon.getHttpRouteHelpers(aMap, aPort);
	var relativePath = _route.relativePath;

	// BEGIN - FROM nOutput_HTMLStatus
	this.path           = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath("objects.assets/noutputstatus")).canonicalPath;
    this.levelsIncluded = _$(aMap.levelsIncluded, "levelsIncluded").isArray().default([ "HIGH", "MEDIUM", "LOW", "INFO"]);
    this.redLevels      = _$(aMap.redLevels, "redLevels").isArray().default(["HIGH"]);
    this.yellowLevels   = _$(aMap.yellowLevels, "yellowLevels").isArray().default(["MEDIUM"]);
    this.greenLevels    = _$(aMap.greenLevels, "greenLevels").isArray().default(["LOW", "INFO"]);
    this.controls       = _$(aMap.controls, "controls").isArray().default(__);
	this.redText        = _$(aMap.redText, "redText").isString().default("NOT OK");
    this.yellowText     = _$(aMap.yellowText, "yellowText").isString().default("Issues");
    this.greenText      = _$(aMap.greenText, "greenText").isString().default("OK");

    this.levelsIncluded = this.levelsIncluded.map(r => r.toUpperCase());
    this.redLevels      = this.redLevels.map(r => r.toUpperCase());
    this.yellowLevels   = this.yellowLevels.map(r => r.toUpperCase());
    this.greenLevels    = this.greenLevels.map(r => r.toUpperCase());
	// END - FROM nOutput_HTMLStatus

	// Set server if doesn't exist
	var hS = "httpd";

	if (isDef(aMap.httpSession)) hS = aMap.httpSession;

	// Get server
	var httpd = nattrmon.ensureHttpSession(hS, aPort, aMap.host, aMap.keyStore, aMap.keyPassword);
	var parent = this;

	var preProcess = nattrmon.getHttpPreProcessFn(aMap, httpd, parent, "nOutput_HTTP_Status");
    var routePath = _route.routePath;

	// Add function to server
	//httpd.addEcho("/echo");
    var parent = this;
    var routes = {};
	routes[routePath("/status")] = function(req) {
		try {
			var hres = ow.server.httpd.reply(parent.status(), 200, "text/html", {});
			return preProcess(req, hres);
		} catch(e) {
			logErr("Error in HTTP request: " + stringify(req, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
    }
	ow.server.httpd.route(httpd, ow.server.httpd.mapWithExistingRoutes(httpd, routes), function (r) {
		try {
			var hres = ow.server.httpd.reply("", 200, "text/plain", {});
			return preProcess(r, hres);
		} catch(e) {
			logErr("Error in HTTP request: " + stringify(r, __, "") + "; exception: " + String(e))
			if (isJavaException(e)) e.javaException.printStackTrace()
			return ow.server.httpd.reply("Error (check logs)", 500)
		}
	});

	log("Output_HTTP_Status | Output HTTP Status created on " + aPort + " with relativePath '" + relativePath + "'");

	nOutput.call(this, this.output);
};
inherit(nOutput_HTTP_Status, nOutput);

nOutput_HTTP_Status.prototype.status = function() {
	var warns = [];
    var data = nattrmon.getWarnings();
	// BEGIN - FROM nOutput_HTMLStatus
    
    Object.keys(data).forEach(l => {
        switch(l.toUpperCase()) {
        case "HIGH"  : warns = warns.concat(data[nWarning.LEVEL_HIGH]); break;
        case "MEDIUM": warns = warns.concat(data[nWarning.LEVEL_MEDIUM]); break;
        case "LOW"   : warns = warns.concat(data[nWarning.LEVEL_LOW]); break;
        case "INFO"  : warns = warns.concat(data[nWarning.LEVEL_INFO]); break;
        case "CLOSED": warns = warns.concat(data[nWarning.LEVEL_CLOSED]); break;
        }
    });

    var cwarns = [];
    if (isUnDef(this.controls)) {
        cwarns = warns;
    } else {
        this.controls.forEach(ctl => {
            warns.forEach(l => {
                if (l.title.match(new RegExp(ctl))) {
                    cwarns.push(l);
                }
            });
        });
    }
                  
	var apath  = this.path + "/objects.assets/noutputstatus";
    var red    = templify(io.readFileString(apath + "/red.md"),    { redText: this.redText });
    var yellow = templify(io.readFileString(apath + "/yellow.md"), { yellowText: this.yellowText });
    var green  = templify(io.readFileString(apath + "/green.md"),  { greenText: this.greenText });

    var out = $from(cwarns)
              .sort("title")
              .select(r => {
                var status = green;
                if (this.greenLevels.indexOf(r.level.toUpperCase()) >= 0)  status = green; 
                if (this.yellowLevels.indexOf(r.level.toUpperCase()) >= 0) status = yellow; 
                if (this.redLevels.indexOf(r.level.toUpperCase()) >= 0)    status = red;
                return {
                    control: r.title,
                    status : status
                };
              });

    var md = templify(io.readFileString(apath + "/status.md"), {
        statuses: out,
		date    : (new Date()).toISOString()
    })
	// END - FROM nOutput_HTMLStatus
    return ow.template.html.genStaticVersion4MD(md);
}

nOutput_HTTP_Status.prototype.output = function (scope, args) {
	//this.refresh(scope);
};
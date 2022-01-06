var nOutput_EmailWarnings_duplicatePrevent = [];

// anArrayOfEmails, aSubject, aFrom, aMailServer, aPort
// 
var nOutput_EmailWarnings = function(aMap) {
	plugin("Email");

	this.addresses = [];
	if (isArray(aMap.to)) {
		aMap.to.forEach((v) => {
			this.addresses.push(String(v));
		});
	} else {
		this.addresses.push(String(aMap.to));
	}
	this.subject = (isUnDef(aMap.subject)) ? "nAttrMon" : aMap.subject;
	this.from = (isUnDef(aMap.from)) ? "nattrmon@openaf.io" : aMap.from;
	this.mailserver = (isUnDef(aMap.server)) ? "my.mail.server.com" : aMap.server;
	this.port = (isUnDef(aMap.port)) ? void 0 : aMap.port;
	this.credentials = (isUnDef(aMap.credentials)) ? void 0 : aMap.credentials;
	this.warnTypes = (isUnDef(aMap.warnTypes)) ? [ "High" ] : aMap.warnTypes;
	this.warnTypesShow = (isUnDef(aMap.warnTypesShow)) ? [ "High", "Medium", "Low", "Info" ] : aMap.warnTypesShow;
	this.descriptionLimit = _$(aMap.descriptionLimit).isNumber("descriptionLimit should be a number").default(-1);
	this.groupBySimilarity = _$(aMap.groupBySimilarity).isNumber("groupBySimilarity should be a number").default(void 0);
	this.alertUntilBySimilarity = _$(aMap.alertUntilBySimilarity).isNumber("alertUntilBySimilarity should be a number").default(void 0);
	this.tls = aMap.tls;
	this.secure = _$(aMap.secure).isBoolean("secure should be boolean").default(false);
	if (isBoolean(aMap.useTLS)) this.useTLS = aMap.useTLS; // Old bug support
	this.debug = aMap.debug;
	this.include = aMap.include;
	this.exclude = aMap.exclude;
	this.includeRE = aMap.includeRE;
	this.excludeRE = aMap.excludeRE;

	this.template = nattrmon.configPath + "/objects.assets/noutputemailwarnings/" + ((isUnDef(aMap.template)) ? "warningEmailTemplate.hbs" : aMap.template);
	if (!(io.fileExists(this.template))) {
		logErr("Template " + this.template + " doesn't exist.");
		this.template = nattrmon.configPath + "/objects.assets/noutputemailwarnings/warningEmailTemplate.hbs";
	}		

	this.templateImages = _$(aMap.templateImages).isMap("templateImages should be a map.").default({});
	this.templateImages["logo"] = "logo.png";

	this.htmlTemplate = ow.template.loadHBSs({
		"nOutput_EmailWarnings": this.template
	});

	this.lock = false;

	this.first = (isUnDef(aMap.dontAvoidStartEmails)) ? true : !aMap.dontAvoidStartEmails;
	this.startTime = new Date();
	this.firstGrace = (isUnDef(aMap.firstGrace)) ? void 0 : aMap.firstGrace;	

	if (this.debug) sprint(this);
	nOutput.call(this, this.output);
};
inherit(nOutput_EmailWarnings, nOutput);

nOutput_EmailWarnings.prototype.output = function (scope, args, meta) {
	if(isUnDef(meta.chSubscribe) || (meta.chSubscribe != "nattrmon::warnings") && (meta.chSubscribe != "nattrmon::warnings::buffer")) 
		throw "nOutput_EmailWarnings only supports chSubscribe: nattrmon::warnings";

	if (args.op != "set" && args.op != "setall") return;

	var owarns = scope.getWarnings(false);

	// Avoids the first email right out of starting  
	if (this.first) {
		if (isDef(this.firstGrace)) {
			if (ow.format.dateDiff.inSeconds(this.startTime) >= this.firstGrace) this.first = false;
		} else {
			this.first = false;
		}
		return;
	}

	this.instanceId = sha1(meta.aName);
	var ws = (isArray(args.v) ? args.v : [ args.v ]);

	var ws = nattrmon.getWarnings(true).getCh().getAll();
	var email, count = 0, data, doIt = true;

	var shouldEmail = false;
	for(var wsi in ws) {
		var shouldEval = true;
		if (isUnDef(ws[wsi]) || isUnDef(ws[wsi].level) || isUnDef(ws[wsi].title)) continue;
		if (isUnDef(owarns[ws[wsi].level]) || $from(owarns[ws[wsi].level]).equals("title", ws[wsi].title).count() == 0) continue;
		if (isDef(this.include) && isArray(this.include) && this.include.indexOf(ws[wsi].title) < 0) { shouldEval = false; }
		if (isDef(this.exclude) && isArray(this.exclude) && this.exclude.indexOf(ws[wsi].title) >= 0) { shouldEval = false; }
		if (isDef(this.includeRE) && isArray(this.includeRE)) {
			shouldEval = false;
			for(var irei in this.includeRE) {
				if (ws[wsi].title.match(this.includeRE[irei])) { shouldEval = true; }
			}
		}
		if (isDef(this.excludeRE) && isArray(this.excludeRE)) {
			shouldEval = true;
			for(var erei in this.excludeRE) {
				if (ws[wsi].title.match(this.excludeRE[erei])) { shouldEval = false; }
			}			
		}		
		if (shouldEval && !nattrmon.isNotified(ws[wsi].title, ws[wsi].level + this.instanceId) && this.warnTypes.indexOf(ws[wsi].level) >= 0) {
			shouldEmail = true;
		}
	}

	if (shouldEmail) {
		sync(() => {
			if (this.lock == false) {
				this.lock = true;
				doIt = true;
			} else {
				doIt = false;
			}
		}, this.lock);

		if (doIt) {
			if (isDef(this.useTLS)) {
				email = new Email(this.mailserver, this.from, this.secure, this.useTLS, true);
			} else {
				email = new Email(this.mailserver, this.from, (isDef(this.credentials) && !this.tls) || this.secure, this.tls, true);
			}
			if (isDef(this.port)) email.setPort(this.port);
			if (isDef(this.credentials)) {
				email.setCredentials(this.credentials.user, this.credentials.password);
			}
			if (isDef(this.debug) && this.debug) email.getEmailObj().setDebug(true);

			data = {
				subject: this.subject,
				warns: []
			};

			for (var i in {
					"High"  : 1,
					"Medium": 2,
					"Low"   : 3,
					"Info"  : 4
				}) {
				
				var list = [];

				for (var j in owarns[i]) {
					if (isDef(owarns[i][j])) {
						var shouldEval = true;
						if (isDef(this.include) && isArray(this.include) && this.include.indexOf(owarns[i][j].title) < 0) shouldEval = false;
						if (isDef(this.exclude) && isArray(this.exclude) && this.exclude.indexOf(owarns[i][j].title) >= 0) shouldEval = false;
						if (isDef(this.includeRE) && isArray(this.includeRE)) {
							shouldEval = false;
							for(var irei in this.includeRE) {
								if (owarns[i][j].title.match(this.includeRE[irei])) { shouldEval = true; }
							}
						}
						if (isDef(this.excludeRE) && isArray(this.excludeRE)) {
							shouldEval = true;
							for(var erei in this.excludeRE) {
								if (owarns[i][j].title.match(this.excludeRE[erei])) { shouldEval = false; }
							}			
						}		

						if (shouldEval) {
							if (isDef(this.descriptionLimit) && this.descriptionLimit > 0) {
								owarns[i][j].description = String(owarns[i][j].description).substr(0, this.descriptionLimit - 1) + "...";
							}
	
							if (isDef(this.groupBySimilarity) && this.groupBySimilarity > 0 &&
						        isDef(owarns[i][j].description) && String(owarns[i][j].description).length > 0) {
								var parent = this;
								var resDupls = $from($from(owarns[i]).notEquals("description", void 0).select((r) => {
									if (String(owarns[i][j].description) != "" && r.description != void 0 && r.description != "")
										return { 
											t: r.title, 
											d: ow.format.string.distance(String(owarns[i][j].description), String(r.description)),
											n: nattrmon.isNotified(r.title, r.level + parent.instanceId)
										};
									else
										return {
											t: r.title,
											d: ow.format.string.distance(owarns[i][j].title, r.title),
											n: nattrmon.isNotified(r.title, r.level + parent.instanceId)
										};
								}))
								.less("d", (String(owarns[i][j].description).length * (this.groupBySimilarity/100)))
								.notEquals("t", owarns[i][j].title)
								.select();

								if (resDupls.length > 0) owarns[i][j].extraMessage = "(plus " + resDupls.length + " equivalent warnings)";

								$from(resDupls).equals("n", false).select((v) => {
									nattrmon.setNotified(v.t, parent.instanceId);
								});

								if (isDef(this.alertUntilBySimilarity) && this.alertUntilBySimilarity > 0) {
								 	if ($from(resDupls).equals("n", true).count() >= this.alertUntilBySimilarity) {
										nattrmon.setNotified(owarns[i][j].title, owarns[i][j].level + this.instanceId);
									}
								}
							}

							if (!nattrmon.isNotified(owarns[i][j].title, owarns[i][j].level + this.instanceId) && 
								this.warnTypesShow.indexOf(owarns[i][j].level) >= 0) {
									list.push(owarns[i][j]);
									nattrmon.setNotified(owarns[i][j].title, owarns[i][j].level + this.instanceId);
									count++;
							} 
						}
					}
				}

				data.warns.push({
					level: i,
					list: list
				});
			}

			sync(() => {
				if (this.lock == true) this.lock = false;
			}, this.lock);
		} else {
			return;
		}
	}

	if (count == 0) return;
	//email.embedFile(nattrmon.configPath + "/objects.assets/noutputemailwarnings/logo.png", "logo");
	for(var ii in this.templateImages) {
		email.embedFile(nattrmon.configPath + "/objects.assets/noutputemailwarnings/" + this.templateImages[ii], ii);
	}
	var message = this.htmlTemplate("nOutput_EmailWarnings", data);

	email.setHTML(message);
	try {	
		if (this.debug) sprint(message);
		email.send(this.subject, message, this.addresses, [], [], this.from);

		log("Email sent to " + this.addresses.join(","));
	} catch(e) {
		if (this.debug) e.javaException.printStackTrace();
		throw e;
	}
};
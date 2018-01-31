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
	this.tls = aMap.tls;
	this.debug = aMap.debug;

	this.first = (isUnDef(aMap.dontAvoidStartEmails)) ? true : aMap.dontAvoidStartEmails;

	if (this.debug) sprint(this);
	nOutput.call(this, this.output);
};
inherit(nOutput_EmailWarnings, nOutput);

nOutput_EmailWarnings.prototype.output = function (scope, args, meta) {
	if(isUnDef(meta.chSubscribe) && meta.chSubscribe == "nattrmon::warnings") 
		throw "nOutput_EmailWarnings only supports chSubscribe: nattrmon::warnings";

	var owarns = scope.getWarnings(false);
	var instanceId = sha1(meta.aName);

	// Avoids the first email right out of starting  
	if (this.first) {
		this.first = false;
		return;
	}

	var email = new Email(this.mailserver, this.from, (isDef(this.credentials) && !this.tls), this.tls, true);
	if (isDef(this.port)) email.setPort(this.port);
	if (isDef(this.credentials)) {
		email.setCredentials(this.credentials.user, this.credentials.password);
	}
	if (isDef(this.debug) && this.debug) email.getEmailObj().setDebug(true);

	var count = 0;
	var mhash = this.aSubject + this.from.toSource();

	var part = "<h2>" + this.subject + "</h2>";
	for (var i in {
			"High"  : 1,
			"Medium": 2,
			"Low"   : 3,
			"Info"  : 4
		}) {
		part += "<h3>" + i + "</h3><table>";
		for (var j in owarns[i]) {
			if (!nattrmon.isNotified(owarns[i][j].title, instanceId) && 
			    this.warnTypes.indexOf(owarns[i][j].level) >= 0) {
				
				var color = "";

				if (i == 'High')   color = "red";
				if (i == 'Medium') color = "yellow";

				part = part + "<tr><td bgcolor=\"" + color + "\"><b>" + owarns[i][j].title + "</b></td><td><i>" + owarns[i][j].description + "</i></td><td><small><b>Updated</b>:<br>" + owarns[i][j].lastupdate + "</small></td><td><small><b>Created:</b><br>" + owarns[i][j].createdate + "</small></td></tr>";
				mhash += owarns[i][j].title + owarns[i][j].description;

				nattrmon.setNotified(owarns[i][j].title, instanceId);
				count++;
			}
		}
		part += "</table>";
	}

	if (count == 0) return;
	var message = templify(nOutput_EmailWarnings.htmlTemplate, { part: part });

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

nOutput_EmailWarnings.htmlTemplate = "<html><style type=\"text/css\">\
body {background-color: #ffffff; color: #000000; }\
body, td, th, h1, h2 {font-family: 'Segoe UI Light','Segoe UI',-apple-system-font,'Lucida Grande',Verdana,Arial,Helvetica,serif ; font-style: normal; }\
pre {margin: 0px; font-family: monospace;}\
a:link    {color: #0000AA; text-decoration: none; background-color: #ffffff; }\
a:visited {color: #0000AA;  text-decoration: none; background-color: #ffffff; }\
a:hover {text-decoration: underline;}\
table {border-collapse: collapse; margin-left: 25px; border: 0px }\
th { text-align: center !important; border: 0px }\
td, th { border: 0px; font-family: -apple-system-font, sans-serif; font-size: 85%; vertical-align: baseline; padding-left: 10px; padding-right: 10px; }\
h1 {font-size: 150%; }\
h2 {font-size: 125%; }\
p {font-weight: normal; font-size: 100%; font-family: 'Segoe UI Light','Segoe UI',-apple-system-font,'Lucida Grande',Verdana,Arial,Helvetica,serif; font-style: normal; color: #999999; }\
ul {font-size: 90%;}\
h3 {text-align: left; font-size: 100%; color: #999999; border-bottom: 1px dotted #ffa500; }\
.p {text-align: left;}\
.b { font-style: normal; color: #999999; }\
.e {background-color: #ffffff; font-weight: bold; color: #000000; text-align: right; padding-left: 30px; }\
.h {background-color: #9999cc; font-weight: bold; color: #000000;}\
.v {background-color: #ffffff; color: #999999; font-family: 'Segoe UI Light','Segoe UI',-apple-system-font,'Lucida Grande',Verdana,Arial,Helvetica,serif; font-weight: normal;  text-align: left; padding-top: 15px; font-size: 115%; border-bottom: 1px solid #ffa500; }\
.vr {background-color: #cccccc; text-align: right; color: #000000;}\
img {float: right; border: 0px;}\
hr {background-color: #cccccc; border: 0px; height: 1px; color: #000000;}\
.pagelist  { color: #999999;}\
a.pagelist { color: #990000;}\
</style><body>\
{{{part}}}\
</body></html>";
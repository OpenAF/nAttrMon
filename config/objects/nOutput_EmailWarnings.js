var nOutput_EmailWarnings_duplicatePrevent = [];

var nOutput_EmailWarnings = function(anArrayOfEmails, aSubject, aFrom, aMailServer, aPort) {
    plugin("Email");

    if (isObject(anArrayOfEmails)) {
      this.addresses = anArrayOfEmails.to;
      this.subject = (isUndefined(anArrayOfEmails.subject)) ? "nAttrMon" : anArrayOfEmails.subject;
      this.from = (isUndefined(anArrayOfEmails.from)) ? "nattrmon@wdtcloud.com" : anArrayOfEmails.from; 
      this.mailserver = (isUndefined(anArrayOfEmails.server)) ? "rnsmtp.connectiv.local" : anArrayOfEmails.server; 
      this.port = (isUnDef(anArrayOfEmails.port)) ? undefined : anArrayOfEmails.port;
      this.credentials = (isUnDef(anArrayOfEmails.credentials)) ? undefined : anArrayOfEmails.credentials;
      this.tls = anArrayOfEmails.tls;
      this.debug = anArrayOfEmails.debug;
    } else {
      this.addresses = anArrayOfEmails;
      this.subject = (isUndefined(aSubject)) ? "nAttrMon" : aSubject;
      this.from = (isUndefined(aFrom)) ? "nattrmon@wdtcloud.com" : aFrom;
      this.mailserver = (isUndefined(aMailServer)) ? "rnsmtp.connectiv.local" : aMailServer;
      this.port = aPort;
    }

    this.first = true;

    nOutput.call(this, this.output);
}
inherit(nOutput_EmailWarnings, nOutput);

nOutput_EmailWarnings.prototype.addDuplicatePrevent = function(aHash) {
	nOutput_EmailWarnings_duplicatePrevent.push(sha1(aHash) + "");
	if (nOutput_EmailWarnings_duplicatePrevent.length > 50) {
		nOutput_EmailWarnings_duplicatePrevent.reverse().pop();
	}
}

nOutput_EmailWarnings.prototype.isDuplicate = function(aHash) {
	if (nOutput_EmailWarnings_duplicatePrevent.indexOf(sha1(aHash) + "") > 0)
		return true;
	else
		return false;
}

nOutput_EmailWarnings.prototype.output = function(scope, args, meta) {
	var owarns = scope.getWarnings(false);
	var warns = clone(owarns);
 	var highs = warns[nWarning.LEVEL_HIGH];
        var instanceId = sha1(meta.aName);

    // Avoids the first email right out of starting  
    if (this.first) {
       this.first = false;
       return;
    }   
 
    if (isUndefined(highs) || 
    	highs.length == 0 ||
    	$from(highs).equals("notified." + instanceId, true).count() == highs.length) return;

	var email = new Email(this.mailserver, this.from, (isDef(this.credentials) && !this.tls), this.tls, true);
        if (isDef(this.port)) email.setPort(this.port);
        if (isDef(this.credentials)) {
		//email.setSecure(true, this.tls);
		email.setCredentials(this.credentials.user, this.credentials.password);
	}
    	if (isDef(this.debug) && this.debug) email.getEmailObj().setDebug(true);

	var count = 0;
	var mhash = this.aSubject + this.from.toSource();

        var part = "<h2>" + this.subject + "</h2>";
        for(var i in {"High":1, "Medium":2, "Low":3}) {
			part += "<h3>" + i + "</h3><table>";
			for(var j in warns[i]) {
				if(isUndefined(owarns[i][j]["notified"][instanceId]) || 
				   !owarns[i][j]["notified"][instanceId]) {
					var color = "";
	                
	                if(i == 'High') color = "red";
	                if(i == 'Medium') color = "yellow";

					part = part + "<tr><td bgcolor=\"" + color + "\"><b>" + warns[i][j].title + "</b></td><td><i>" + warns[i][j].description + "</i></td><td><small><b>Updated</b>:<br>" + warns[i][j].lastupdate + "</small></td><td><small><b>Created:</b><br>" + warns[i][j].createdate + "</small></td></tr>";
					mhash += warns[i][j].title + warns[i][j].description;

					var nwarn = nattrmon.getWarnings(true).getWarningByName(owarns[i][j].title); 
 					nwarn["notified"][instanceId] = true;
                                        nattrmon.getWarnings(true).setWarningByName(nwarn.title, nwarn);
 
					count++;
				}
			}
			part += "</table>";
        }

    if (count == 0) return;
	var message = nOutput_EmailWarnings.htmlTemplate.replace(/%%REPLACE_HERE%%/, part);

	if (this.isDuplicate(mhash))
		return;
	else
		this.addDuplicatePrevent(mhash);

        /*email.setFrom(this.from);
        email.addTo(this.addresses);
        email.setSubject(this.subject);
        email.setMessage(message);*/
 	    email.setHTML(message);
        email.send(this.subject, message, this.addresses, [], [], this.from);

	log("Email sent to " + this.addresses.join(","));
}

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
%%REPLACE_HERE%%\
</body></html>";

// Author: nuno.aguiar@wedotechnologies.com

// Channel permissions
// [BEGIN] -----------
var cauth_perms = {
	"nattrmon": {
		p: "nattrmon",  // password
		m: "r"          // permissions (r, rw)
	}
}
// [END] -------------

var httpd = nattrmon.getSessionData("httpd");

if (isDef(httpd)) {
	// Channel authentication
	var chAuth = function(u, p, s, r) {
		if (isDef(cauth_perms[u])) {
			if (p == cauth_perms[u].p) {
				r.channelPermission = (isDef(cauth_perms[u].m) ? cauth_perms[u].m : "r");
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	nattrmon.currentValues.expose(httpd, "/chs/cvals", chAuth);
	nattrmon.lastValues.expose(httpd, "/chs/lvals", chAuth);
	$ch("nattrmon::attributes").expose(httpd, "/chs/attrs", chAuth);
	$ch("nattrmon::warnings").expose(httpd, "/chs/warns", chAuth);
        //httpd.setDefault("/f");

} else {
	throw "Need a http output defined.";
}

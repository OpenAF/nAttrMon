// Author: nuno.aguiar@wedotechnologies.com

// Channel permissions
// [BEGIN] -----------
var cauth_perms = {
	"nattrmon": {
		p: "nattrmon",  // password
		m: "r"          // permissions (r, rw)
	},
	"change": {
		p: "me",
		m: "rw"
	}
};
// [END] -------------

nattrmon.addOutput(
    { "name"          : "Output Channels",
      "waitForFinish" : false,
      "onlyOnEvent"   : false,
    },
	new nOutput_Channels({
		cAuth: cauth_perms
	})
);
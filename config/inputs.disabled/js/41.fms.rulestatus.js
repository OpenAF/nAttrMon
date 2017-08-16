nattrmon.addInput(
	{ "name"         : "Fraud rules status",
	"timeInterval" : 30000,
	"waitForFinish": true,
	"onlyOnEvent"  : true,
	"cron"         : "15 */1 * * *"
	},
	new nInput_FMSRulesStatus("FMS")
);
nattrmon.addInput(
	{ "name"         : "Fraud rules status",
	"cron"         : "*/30 * * * *",
	"waitForFinish": true,
	"onlyOnEvent"  : true,
	"cron"         : "15 */1 * * *"
	},
	new nInput_FMSRulesStatus("FMS")
); 
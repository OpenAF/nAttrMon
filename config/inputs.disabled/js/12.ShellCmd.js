nattrmon.addInput({
	"name":	"Commands Script",
	"cron": "*/30 * * * *",
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_Shell({
		cmd: "/some/shell/command", 
		jsonParse: true, 
		attrTemplate: "Commands/Script"
	})
);

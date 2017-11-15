nattrmon.addInput({
	"name":	"Commands Script",
	"timeInterval": 1800000,
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_Shell({
		cmd: "/some/shell/command", 
		jsonParse: true, 
		attrTemplate: "Commands/Script"
	})
);

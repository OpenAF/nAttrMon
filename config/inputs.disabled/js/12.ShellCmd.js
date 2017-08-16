nattrmon.addInput({
	"name":	"Commands Script",
	"timeInterval": 1800000,
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_Shell("/some/shell/command", true, "Commands/Script")
);

nattrmon.addInput({
	"name":	"Server status/OS",
	"timeInterval": 60000,
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_OSInfo()
);

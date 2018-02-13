nattrmon.addInput({
	"name":	"Server status/OS",
	"cron": "*/1 * * * *",
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_OSInfo()
);

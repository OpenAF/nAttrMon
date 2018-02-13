nattrmon.addInput({
	"name":	"Filesystem",
	"cron": "*/30 * * * *",
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_Filesystem([
     "/some/path/1",
     "/some/path/2"
  ])
);

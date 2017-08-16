nattrmon.addInput({
	"name":	"Filesystem",
	"timeInterval": 30000,
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_Filesystem([
     "/some/path/1",
     "/some/path/2"
  ])
);

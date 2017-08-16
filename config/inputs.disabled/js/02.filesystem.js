nattrmon.addInput({
	"name":	"Filesystem",
	"timeInterval": 60000,
	"waitForFinish": true,
	"onlyOnEvent": true
  },
  new nInput_Filesystem([
     "/dev/sda1",
     "/dev/sdb1",
     "/dev/sdc1"
  ])
);

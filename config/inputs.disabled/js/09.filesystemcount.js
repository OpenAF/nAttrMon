nattrmon.addInput(
   {
	"name":	"Filesystem check",
	"cron": "*/1 * * * *",
	"waitForFinish": true,
	"onlyOnEvent": true
   },
   new nInput_FilesystemCount("Filesystem/Records", [
  	{"name": "Received", "folder": "/opt/wedo/data/loading/usage/received", "pattern": ".*" },
  	{"name": "Input", "folder": "/opt/wedo/data/loading/usage/in", "pattern": ".*\.dat" },
  	{"name": "Done", "folder": "/opt/wedo/data/loading/usage/done", "pattern": ".*\.dat" },
  	{"name": "Error", "folder": "/opt/wedo/data/loading/usage/err", "pattern": ".*\.dat" }
   ])
);

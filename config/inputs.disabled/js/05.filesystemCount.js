nattrmon.addInput(
   {
      "name"         : "Filesystem check",
      "cron"         : "*/10 * * * * *",
      "waitForFinish": true,
      "onlyOnEvent"  : true
   },
   new nInput_FilesystemCount("Filesystem/Test", [
      { "name": "Main d:/", "folder": "d:/", "pattern": ".*\.txt" },
      { "name": "Sub d:/wrk", "folder": "d:/wrk", "pattern": ".*" }
   ])
);

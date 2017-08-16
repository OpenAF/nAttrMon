nattrmon.addInput(
   {
      "name"         : "Filesystem check",
      "timeInterval" : 2000,
      "waitForFinish": true,
      "onlyOnEvent"  : true
   },
   new nInput_LogErrorAgg("Filesystem/Logs", [
      { "name": "Main log d:/log.txt", "file": "d:/log.txt", "pattern": ".+ERROR\\s+(\\S+).+" },
   ])
);

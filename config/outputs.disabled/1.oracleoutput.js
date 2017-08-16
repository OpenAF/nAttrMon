nattrmon.addOutput(
    { "name"          : "Oracle history",
      "timeInterval"  : NATTRMON_HTTP_PERIOD,
      "waitForFinish" : true,
      "onlyOnEvent"   : true
    },
    new nOutput_Oracle("APPADM")
);

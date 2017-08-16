nattrmon.addOutput(
    { "name"          : "H2 history",
      "timeInterval"  : NATTRMON_HTTP_PERIOD,
      "waitForFinish" : true,
      "onlyOnEvent"   : true
    },
    //new nOutput_H2()
    new nOutput_H2(NATTRMON_HOME + "/config/nattrmon_db")
);

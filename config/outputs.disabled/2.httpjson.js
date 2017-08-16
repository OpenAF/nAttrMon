
// Add output
nattrmon.addOutput(
    { "name"          : "Output JSON",
      "timeInterval"  : NATTRMON_HTTP_PERIOD,
      "waitForFinish" : false,
      "onlyOnEvent"   : false,
    },
	new nOutput_HTTP_JSON()
);

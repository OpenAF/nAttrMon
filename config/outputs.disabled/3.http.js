// -------------------------------------------------------------------
// Add output
nattrmon.addOutput(
// FILL HERE BEGIN -----------------------------------------------
    { "name"          : "Output Summary",
      "timeInterval"  : NATTRMON_HTTP_PERIOD,
      "waitForFinish" : false,
      "onlyOnEvent"   : false,
    },
    // FILL HERE END -------------------------------------------------
	new nOutput_HTTP(NATTRMON_HTTP_TITLE,NATTRMON_HTTP_PERIOD)
);

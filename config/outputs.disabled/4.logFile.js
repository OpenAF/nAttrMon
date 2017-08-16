nattrmon.addOutput(
	{ "name"          : "Output log file",
      "timeInterval"  : 500,
      "waitForFinish" : true,
      "onlyOnEvent"   : true,
    },
	new nOutput_Stdout()
);
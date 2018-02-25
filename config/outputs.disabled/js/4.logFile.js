nattrmon.addOutput(
	{ "name"          : "Output log file",
      //"timeInterval"  : 1000,
      "chSubscribe"   : "nattrmon::cvals",
      "waitForFinish" : true,
      "onlyOnEvent"   : true,   // Could be false when using timeInterval
    },
	new nOutput_Log({
    //"outputTemplate": "{{name}} -- {{value}}",
    "filename"      : "nattrmon.1.log"
  })
);
// Add output
nattrmon.addOutput(
    { "name"          : "Output Warnings by email",
      "timeInterval"  : NATTRMON_HTTP_PERIOD,
      "waitForFinish" : false,
      "onlyOnEvent"   : false,
    },
    new nOutput_EmailWarnings(["some.one@wedotechnologies.com", "some.two@wedotechnologies.com"], "[nattrmon] Warnings", "some.email@some.com", "mail.server.com"));

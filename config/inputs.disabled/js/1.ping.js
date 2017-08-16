for(var i in raidServers) {
   nattrmon.addInput(
      {
         "name"         : "Ping servers",
         "timeInverval" : 2000,
         "waitForFinish": false,
         "onlyOnEvent"  : true
      },
      new nInput_AFPing(i, "Server status/" + raidServers[i].name + " alive")
   );
}
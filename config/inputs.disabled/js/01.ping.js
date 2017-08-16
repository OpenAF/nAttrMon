for(var i in raidServers) {
   nattrmon.addInput(
      {
         "name"         : "Ping servers " + raidServers[i].name,
         "timeInterval" : 2000,
         "waitForFinish": false,
         "onlyOnEvent"  : true
      },
      new nInput_AFPing(raidServers[i].url, "Server status/" + raidServers[i].name + " alive")
   );
}
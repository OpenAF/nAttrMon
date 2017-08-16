for(var i in raidServers) {
   nattrmon.addInput(
     { "name"         : "Server memory " + raidServers[i].name,
       "timeInterval" : 2000,
       "waitForFinish": true,
       "onlyOnEvent"  : true },
     new nInput_RAIDMemory(i, "Server status/" + raidServers[i].name + " memory ")
   );
}

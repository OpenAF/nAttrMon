for(var i in raidServers) {
   nattrmon.addInput(
     { "name"         : "Server IM memory " + raidServers[i].name,
       "timeInterval" : 2000,
       "waitForFinish": true,
       "onlyOnEvent"  : true },
     new nInput_IMMemory(i, "Server status/" + raidServers[i].name + " IM memory ")
   );
}

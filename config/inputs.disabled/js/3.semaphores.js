for(var i in raidServers) {
   nattrmon.addInput(
     { "name"         : "Semaphores " + raidServers[i].name,
       "timeInterval" : 2000,
       "waitForFinish": true,
       "onlyOnEvent"  : true },
     new nInput_Semaphores(i, "Semaphores " + raidServers[i].name + "/" + raidServers[i].name + " ")
   );
}

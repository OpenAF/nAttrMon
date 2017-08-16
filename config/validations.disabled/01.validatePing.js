for(var i in raidServers) {
  nattrmon.addValidation(
     { "name"         : "Ping validation",
       "timeInterval" : 1000,
       "waitForFinish": true,
       "onlyOnEvent"  : true
     },
     new nValidation_AFPing(i, 
     	                    "Server status/" + raidServers[i].name + " alive", 
     	                    "Server " + raidServers[i].name + " down!", 
     	                    "A AF ping to the " + raidServers[i].name + " server failed. Server could be down or not responsive. Check the server status and restart if needed.")
  );
}
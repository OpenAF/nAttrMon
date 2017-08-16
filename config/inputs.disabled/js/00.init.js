// INSTRUCTIONS
// ------------
// 1. Change by adding or removing servers from the raidServers array. 
// 2. Add DB objects from raidServers if needed on the end of the file.
// 3. Fill out also the 0.doc.js file to add descriptions and links to attributes.

var raidServers = { 
  "Some_CM": {
     "name": "Some CM",
     "url" : "http://adm:9ADE26D7D93535B95E71B107A4D8B4FCD9CBF33999315F853F9771C4C2F853E4@1.2.3.4:1234/xdt"
  }, 
  "Some_RAS": {
     "name": "Some RAS",
     "url" : "http://adm:9ADE26D7D93535B95E71B107A4D8B4FCD9CBF33999315F853F9771C4C2F853E4@1.2.3.4:1234/xdt"
  }
};


// Don't change BEGIN --------------------------------------------------
// ---------------------------------------------------------------------

// Creating objects to access each server
for(var i in raidServers) {
  nattrmon.addObjectPool(i, ow.obj.pool.AF(raidServers[i].url));
}

// Creating objects to access databases
/*
nattrmon.addMonitoredObject("Some_DAT", function() {
  return getRAIDDB(nattrmon.getMonitoredObject("Some_CM"), 'Dat');
});

nattrmon.addMonitoredObject("Some_ADMAPP", function() {
  return new DB(getRAIDDBURL(nattrmon.getMonitoredObject("Some_RAS"), 'Dat'), 'some', '9ADE26D7D93535B95E71B107A4D8B4FCD9CBF33999315F853F9771C4C2F853E4');
});
*/

// Add, remove or change as many DB connections you need following the example (Some_CM is the server you
// define on raidServers. APPADM (the first argument) will by the name of this DB connection.
nattrmon.useObject("Some_CM", function(aAF) {
   nattrmon.addObjectPool("APPADM", ow.obj.pool.DB(getRAIDDBURL(aAF, "Adm"), "APPADM", "APPADM"));
});

//Don't change END ----------------------------------------------------
//---------------------------------------------------------------------



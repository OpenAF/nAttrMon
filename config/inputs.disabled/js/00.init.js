// Set attributes descriptions
// 
/*
nattrmon.setAttributes({
	"Database/Tablespaces"         : "This table provides the current usage for RAID tablespaces. A small amount of space in one of them might become the reason for issues."
});
*/

// Set the RAID servers to monitor
$ch("raidServers").create();
$ch("raidServers").set("PRDFMS", {
   key: "PRDFMS",
   url: "http://adm:F1DF06B3904@127.0.0.1:7100/xdt"
});


// ---------------------------------------------------------------------
// ---------------------------------------------------------------------

// Creating objects to access each server
$ch("raidServers").forEach(function(aK, aV) {
   nattrmon.addObjectPool(aV.key, ow.obj.pool.AF(aV.url));
});

// Creating objects to access databases
nattrmon.useObject("PRDFMS", function(aAF) {
   var pool = ow.obj.pool.RAIDDB(aAF, "App");
   pool.setMax(3);   // A max of 3 connections
   //pool.setTimeout(30000);
   nattrmon.addObjectPool("FMSAPP", pool);
   nattrmon.associateObjectPool("PRDFMS", "FMSAPP", "db.app");

   var poolAA = ow.obj.pool.DB(getRAIDDBURL(aAF, 'Adm'), 'APPADM', '10B98CD0337F4ECBB41');
   poolAA.setMax(3);   // A max of 3 connections
   nattrmon.addObjectPool("APPADM", poolAA);
   nattrmon.associateObjectPool("PRDFMS", "APPADM", "db.appadm");
});

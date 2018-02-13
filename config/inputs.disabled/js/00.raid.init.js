
// 1. Prepare a RAID servers channel 
$ch("raidServers").create();
$ch("raidServers").set({ key: "Example FMS" }, { key: "Example FMS", url: "http://user:password@1.2.3.4:7101/xdt" });
$ch("raidServers").set({ key: "Example RAS" }, { key: "Example RAS", url: "http://user:password@1.2.3.4:7100/xdt" });

// 2. Create a RAID AF pool for each entry on the RAID servers channel
// (if you add entries later you should create the corresponding object pool)
$ch("raidServers").forEach((k, v) => {
  log("Creating object pool to access " + k.key + "...");
  nattrmon.addObjectPool(k.key, ow.obj.pool.AF(v.url, 5000)); // Timeout after 5s
  log("Created object pool to access " + k.key);
});

// 3. Create a object pool to access each schema
// (you could use RAIDDB pools but they become dependent on having a RAID server up during nAttrMon startup)

// 3.1 APPs
var p = ow.obj.pool.DB("jdbc:oracle:thin:@1.2.3.5:1521:aSID", "fmsappuser", "fmsapppass");
p.setMax(3); // a maximum of 3 connections to the database
nattrmon.addObjectPool("Example DB FMS APP", p);
nattrmon.associateObjectPool("Example FMS", "Example DB FMS APP", "db.app");

var p = ow.obj.pool.DB("jdbc:oracle:thin:@1.2.3.5:1521:aSID", "rasappuser", "rasapppass");
p.setMax(3); // a maximum of 3 connections to the database
nattrmon.addObjectPool("Example DB RAS APP", p);
nattrmon.associateObjectPool("Example RAS", "Example DB RAS APP", "db.app");

// 3.2 DATs
log("Creating db pool to access DAT...");
var p = ow.obj.pool.DB("jdbc:oracle:thin:@1.2.3.5:1521:aSID", "datappuser", "datapppass");
p.setMax(3); // a maximum of 3 connections to the database

nattrmon.addObjectPool("Example DB DAT", p);
nattrmon.associateObjectPool("Example RAS", "Example DB DAT", "db.dat");
nattrmon.associateObjectPool("Example FMS" , "Example DB DAT", "db.dat");
log("Created db pool to access Example DB DAT");

## Operational tips&tricks

### How to force the cleaning of a warning

----

This functionality is now provided directly on the ops channel, check [output channels description](nAttrMon-nOutput-Channels).

----

If you have the nAttrMon internal warnings channels (nattrmon::warnings) exposed (see nOutput_Channels) with the right permissions you can clean a warning in two ways:

* Clean way through an openaf-console:
````javascript
$ch("warns").createRemote("http://user:password@nattrmon.server:port/chs/warns");
var w = $ch("warns").get({ title: "The attribute I want to remove" });
w.level = "Closed";
$ch("warns").set({ title: w.title }, w);
````

* Dirty way through an openaf-console: 
````javascript
$ch("warns").createRemote("http://user:password@nattrmon.server:port/chs/warns");
$ch("warns").unset({ title: "The attribute I want to remove" });
````

* Using the nAttrMon snapshot file with restart keeping everything else:

  1. Stop nAttrMon
  2. On the config folder move/rename nattrmon.snapshot to nattrmon.gz
  3. Gunzip nattrmon.gz and edit
  4. Remove the warning entry you want (be careful to still leave a valid JSON file)
  5. Gzip nattrmon and move/rename back again to nattrmon.snapshot
  6. Start nAttrMon

* Using the nAttrMon snapshot file with restart losing all the snapshot:

  1. Stop nAttrMon
  2. On the config folder delete nattrmon.snapshot
  3. Start nAttrMon

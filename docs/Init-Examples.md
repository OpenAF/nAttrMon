# Servers init example

````javascript
$ch("servers").create();
$ch("servers").set("server1", {
   key: "server1",
   url: "ssh://user1:pass1@1.2.3.4"
});
$ch("servers").set("server2", {
    key: "server2",
    url: "ssh://user2:pass2@1.2.3.5:22/my/keys/key.rsa"
});

$ch("servers").forEach((aK, aV) => {
    var pool = nattrmon.newSSHObjectPool(aV.url);
    pool.setMax(1);
    log("Creating object pool for " + aK.key + "...");
    nattrmon.addObjectPool(aV.key, pool);
 });
````
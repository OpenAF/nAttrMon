// Author: Nuno Aguiar

var nInputInitList = _$(nInputInitList, "nInputInitList").isMap().default({});
nInputInitList["AF"] = {
    name   : "AF",
    type   : "map",
    factory: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([]);

        $ch(ikey).create();
        content.forEach(entry => {
            entry      = _$(entry, "AF " + ikey + " entry").isMap().$_();
            entry      = parent.setSec(entry);
            entry.pool = _$(entry.pool, "AF " + ikey + " - " + entry.key + " pool").isMap().default({});
            entry.key  = _$(entry.key, "AF " + ikey + " entry key").isString().$_();

            $ch(ikey).set({ key: entry.key }, entry);

            log("Creating AF object pool to access " + entry.key + "...");
            var p = ow.obj.pool.AF(entry.url, entry.timeout, entry.conTimeout, entry.dontUseTransaction);
            parent.setPool(p, entry);
            nattrmon.addObjectPool(entry.key, p);

            log("Created object pool to access " + entry.key);
            parent.setAssociations("AF", entry, ikey);
        });
    }
};
nInputInitList["CH"] = {
    name   : "CH",
    type   : "array",
    factory: (parent, content) => {
        _$(content, "content").isMap().$_();
        _$(content.name, "content.name").isString().$_();
        content.type = _$(content.type, content.name + " content.type").isString().default("simple");

        // Creating channel
        $ch(content.name).create(1, content.type, content.options);
        if (isArray(content.entries)) {
            content.entries.forEach(entry => {
                try {
                    _$(entry.key, "entry.key").$_();
                    _$(entry.value, "entry.value").$_();

                    entry.key = parent.setSec(entry.key);
                    entry.value = parent.setSec(entry.value);

                    $ch(content.name).set(entry.key, entry.value);
                } catch(e1) {
                    logErr(e1);
                }
            });
        }
    }
};
nInputInitList["DB"] = {
    name   : "DB",
    type   : "map",
    factory: (parent, ikey, content) => {
        $ch(ikey).create();
        content.forEach(entry => {
            try {
                entry      = _$(entry, "DB " + ikey + " entry").isMap().$_();
                entry      = parent.setSec(entry);
                entry.pool = _$(entry.pool, "DB " + ikey + " - " + entry.key + " pool").isMap().default({});
                entry.key  = _$(entry.key, "DB " + ikey + " entry key").isString().$_();

                $ch(ikey).set({ key: entry.key }, entry);

                log("Creating DB object pool to access " + entry.key + "...");
                var p;
                if (isDef(entry.driver)) {
                    p = ow.obj.pool.DB(entry.driver, entry.url, entry.login, entry.pass, __, entry.timeout);
                } else {
                    p = ow.obj.pool.DB(entry.url, entry.login, entry.pass, __, entry.timeout);
                }
                parent.setPool(p, entry);
                nattrmon.addObjectPool(entry.key, p);

                log("Created object pool to access " + entry.key);
                parent.setAssociations("DB", entry, ikey);
            } catch(e1) {
                logErr(e1);
            }
        });
    }
}
nInputInitList["SSH"] = {
    name   : "SSH",
    type   : "map",
    factory: (parent, ikey, content) => {
        $ch(ikey).create();
        content.forEach(entry => {
            try {
                entry      = _$(entry, "SSH " + ikey + " entry").isMap().$_();
                entry      = parent.setSec(entry);
                entry.pool = _$(entry.pool, "SSH " + ikey + " - " + entry.key + " pool").isMap().default({});
                entry.key  = _$(entry.key, "SSH " + ikey + " entry key").isString().$_();

                $ch(ikey).set({ key: entry.key }, entry);

                log("Creating SSH object pool to access " + entry.key + "...");
                var p = ow.obj.pool.SSH(entry.host, entry.port, entry.login, entry.pass, entry.idkey, entry.withCompression);

                parent.setPool(p, entry);
                nattrmon.addObjectPool(entry.key, p);

                log("Created object pool to access " + entry.key);
                parent.setAssociations("SSH", entry, ikey);
            } catch(e1) {
                logErr(e1);
            }
        });
    }
}
nInputInitList["AFCache"] = {
    name   : "AFCache",
    type   : "map",
    factory: (parent, ikey, content) => {
        content.forEach(entry => {
            try {
                entry      = _$(entry, "AFCache entry").isMap().$_();
                entry      = parent.setSec(entry);
                entry.key  = _$(entry.key, "AFCache '" + ikey + "' entry key").isString().$_();
                entry.ttl  = _$(entry.ttl, "AFCache '" + ikey + "' " + entry.key + " ttl key").isNumber().default(__);

                log("Creating AF operation cache '" + ikey + "' to access " + entry.key + "...");
                $cache("nattrmon::" + ikey + "::" + entry.key)
                .ttl(entry.ttl)
                .fn(aK => {
                    if (isString(aK.op) && isMap(aK.args)) {
                        var res = __;
                        nattrmon.useObject(entry.key, function(s) {
                            try {
                                res = s.exec(aK.op, aK.args);
                            } catch(e) {
                                res = { __error: "Error while retrieving result from '" + aK.op + "' using '" + entry.key + "' AF object pool: " + e.message }
                            }
                        });
                        return res;
                    } else {
                        return __;
                    }
                })
                .create();

                log("Created AF operation cache to access " + entry.key);
            } catch(e1) {
                logErr(e1);
            }
        });
    }
}

/**
 * <odoc>
 * <key>nattrmon.nInput_Init(aMap)</key>
 * (tbc)
 * (Check config/inputs.disabled/00.init.yaml)
 * </odoc>
 */
 var nInput_Init = function(aMap) {
    if (getVersion() < "20210923") throw "nInput_Init is only supported starting on OpenAF version 20210923";

    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    var fns = {
        setPool: (aPool, aEntry) => {
            if (isDef(aEntry.pool.max))           aPool.setMax(aEntry.pool.max);
            if (isDef(aEntry.pool.min))           aPool.setMin(aEntry.pool.min);
            if (isDef(aEntry.pool.retry))         aPool.setRetry(aEntry.pool.retry);
            if (isDef(aEntry.pool.retryInterval)) aPool.setTimeout(aEntry.pool.retryInterval);
            if (isDef(aEntry.pool.incrementsOf))  aPool.setIncrementsOf(aEntry.pool.incrementsOf);
            if (isDef(aEntry.pool.keepalive))     aPool.setKeepaliveInMs(aEntry.pool.keepalive);
        },
        setAssociations: (aType, aEntry, ichkey) => {
            if (isArray(aEntry.associations)) {
                aEntry.associations.forEach(aci => {
                    _$(aci.parentKey , aType + " " + ichkey + " - " + aEntry.key + " parent key").isString().$_();
                    _$(aci.type      , aType + " " + ichkey + " - " + aEntry.key + " type for " + aci.parentKey).isString().$_();
    
                    nattrmon.associateObjectPool(aci.parentKey, aEntry.key, aci.type);
                    log("Object pool " + aEntry.key + " associated with " + aci.parentKey + " as " + aci.type);
                })
            }
        },
        setSec: aEntry => {
            if (isDef(aEntry.secKey)) {
                //return merge(aEntry, $sec(aEntry.secRepo, aEntry.secBucket, aEntry.secPass, aEntry.secMainPass, aEntry.secFile).get(aEntry.secKey));
                return __nam_getSec(aEntry);
            } else {
                return aEntry;
            }
        }
    }

    Object.keys(nInputInitList).forEach(iinit => {
        var init = nInputInitList[iinit];

        if (init.type == "map") {
            this.params[init.name] = _$(this.params[init.name], init.name).isMap().default({});
            Object.keys(this.params[init.name]).forEach(ikey => {
                var content = this.params[init.name][ikey];
                try {
                    init.factory(fns, ikey, content);
                } catch(e) {
                    logErr(e);
                }
            })
        }
            
        if (init.type == "array") {
            this.params[init.name] = _$(this.params[init.name], init.name).isArray().default([]);
            this.params[init.name].forEach(content => {
                try {
                    init.factory(fns, content);
                } catch(e) {
                    logErr(e);
                }
            })
        }
    });

    nInput.call(this, this.input);
};
inherit(nInput_Init, nInput);

nInput_Init.prototype.input = function(scope, args) {
    var ret = {};

    return ret;
};
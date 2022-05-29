// Author: Nuno Aguiar

var nInputInitList = _$(nInputInitList, "nInputInitList").isMap().default({});

// AF
// --
nInputInitList["AF"] = {
    name   : "AF",
    type   : "map",
    list   : (parent, ikey, content) => {
        return ($ch().list().indexOf(ikey) >= 0 ? $ch(ikey).getKeys() : [])
    },
    recycle: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([])

        content.forEach(entry => {
            entry = $ch(ikey).get({ key: entry.key })
            if (isDef(entry.key)) {
                log("Destroying AF object pool to access " + entry.key + "...")
                nattrmon.delObjectPool(entry.key)

                log("Destroying object pool to access " + entry.key + " associations...")
                parent.unsetAssociations("AF", entry, ikey)

                $ch(ikey).unset({ key: entry.key })
            }
        })
    },
    factory: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([]);

        $ch(ikey).create()
        content
        .filter(r => isUnDef($ch(ikey).get({ key: r.key })))
        .forEach(entry => {
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
        })

        return content.map(r => ({ key: r.key }))
    }
};

// CH
// --
nInputInitList["CH"] = {
    name   : "CH",
    type   : "array",
    /*list   : (parent, content) => {
        _$(content, "content").isMap().$_()
        _$(content.name, "content.name").isString().$_()

        if (isArray(content.entries)) {
            return $ch(content.name).getKeys().map(r => {
                if (isDef(r.key)) return r.key; else return r
            })
        } else {
            return []
        }
    },
    recycle: (parent, content) => {
        _$(content, "content").isMap().$_()
        _$(content.name, "content.name").isString().$_()

        if (isArray(content.entries)) {
            content.entries.forEach(entry => {
                _$(entry.key, "entry.key").$_()
                entry.key = parent.setSec(entry.key)

                print(" -- " + entry.key)
                $ch(content.name).unset(entry.key)
            })
        }
    },*/
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
            })

            return content.entries.map(r => r.key)
        }

        return []
    }
};

// DB
// --
nInputInitList["DB"] = {
    name   : "DB",
    type   : "map",
    list   : (parent, ikey, content) => {
        return ($ch().list().indexOf(ikey) >= 0 ? $ch(ikey).getKeys() : [])
    },
    recycle: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([])

        content.forEach(entry => {
            entry = $ch(ikey).get({ key: entry.key })
            if (isDef(entry.key)) {
                log("Destroying DB object pool to access " + entry.key + "...")
                nattrmon.delObjectPool(entry.key)

                log("Destroying object pool to access " + entry.key + " associations...")
                parent.unsetAssociations("DB", entry, ikey)

                $ch(ikey).unset({ key: entry.key })
            }
        })
    },
    factory: (parent, ikey, content) => {
        $ch(ikey).create();
        content
        .filter(r => isUnDef($ch(ikey).get({ key: r.key })))
        .forEach(entry => {
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
        })

        return content.map(r => ({ key: r.key }))
    }
}

// SSH
// ---
nInputInitList["SSH"] = {
    name   : "SSH",
    type   : "map",
    list   : (parent, ikey, content) => {
        return ($ch().list().indexOf(ikey) >= 0 ? $ch(ikey).getKeys() : [])
    },
    recycle: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([])

        content.forEach(entry => {
            entry = $ch(ikey).get({ key: entry.key })
            if (isDef(entry.key)) {
                log("Destroying SSH object pool to access " + entry.key + "...")
                nattrmon.delObjectPool(entry.key)

                log("Destroying object pool to access " + entry.key + " associations...")
                parent.unsetAssociations("SSH", entry, ikey)

                $ch(ikey).unset({ key: entry.key })
            }
        })
    },
    factory: (parent, ikey, content) => {
        $ch(ikey).create()

        content
        .filter(r => isUnDef($ch(ikey).get({ key: r.key })))
        .forEach(entry => {
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
        })

        return content.map(r => ({ key: r.key }))
    }
}

// AFCache
// -------
nInputInitList["AFCache"] = {
    name   : "AFCache",
    type   : "map",
    list   : (parent, ikey, content) => {
        return $ch()
               .list()
               .filter(r => r.startsWith("nattrmon::" + ikey + "::") && !r.endsWith("::__cache"))
               .map(r => ({ key: r.replace("nattrmon::" + ikey + "::", "") }))
    },
    recycle: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([])
        
        content.forEach(entry => {
            entry      = _$(entry, "AFCache entry").isMap().$_()
            entry      = parent.setSec(entry)
            entry.key  = _$(entry.key, "AFCache '" + ikey + "' entry key").isString().$_()
            entry.ttl  = _$(entry.ttl, "AFCache '" + ikey + "' " + entry.key + " ttl key").isNumber().default(__)

            log("Destroying AF operation cache '" + ikey + "' to access " + entry.key + "...")
            $cache("nattrmon::" + ikey + "::" + entry.key)
            .destroy()
        })
    },
    factory: (parent, ikey, content) => {
        content
        .filter(r => $ch()
                    .list()
                    .indexOf("nattrmon::" + ikey + "::" + r.key) < 0)
        .forEach(entry => {
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
        })

        return content.map(r => ({ key: r.key }))
    }
}

// Kube
// ----
nInputInitList["Kube"] = {
    name   : "Kube",
    type   : "map",
    dynamic: true,
    factory: (parent, ikey, content, inc) => {
        var entry = {}
        entry[ikey] = clone(content)

        if (isUnDef(getOPackPath("Kube"))) throw "Kube opack not installed."
        loadLib("kube.js")

        var getKubeLst = m => {
            m = parent.setSec(m)
            m.kind      = _$(m.kind, "_kube.kind").isString().default("FPO")
            m.namespace = _$(m.namespace, "_kube.namespace").isString().default("default")

            var nss = m.namespace.split(/ *, */)
            var lst = []
            nss.forEach(ns => {
                var its = $kube(m)["get" + m.kind](ns)
                if (isMap(its) && isArray(its.items)) lst = lst.concat(its.items)
            })
            return lst
        }, procKubeLst = (m, lst) => {
            return ow.obj.filter(lst, m._kube.selector).map(r => {
                var newM = clone(m)
                delete newM._kube
                newM = parent.setSec(newM)
                traverse(newM, (aK, aV, aP, aO) => {
                    if (isString(aV)) aO[aK] = templify(aV, r)
                })
                return newM
            })
        }

        if (isArray(entry[ikey])) {
            entry[ikey].forEach(m => {
                m._kube = _$(m._kube, "_kube").isMap().default({})
                m._kube.selector = _$(m._kube.selector, "_kube.selector").isMap().default({})

                var lst = getKubeLst(m._kube)
                if (isArray(lst)) {
                    entry[ikey] = procKubeLst(m, lst)
                }
            })
        } else {
            if (isMap(entry[ikey])) {
                Object.keys(entry[ikey]).forEach(ch => {
                    var m = entry[ikey][ch]
                    if (isArray(m) && m.length >= 1) m = m[0]

                    m._kube = _$(m._kube, "_kube").isMap().default({})
                    m._kube.selector = _$(m._kube.selector, "_kube.selector").isMap().default({})

                    var lst = getKubeLst(m._kube)
                    if (isArray(lst)) {
                        entry[ikey][ch] = procKubeLst(m, lst)
                    }
                })
            }
        }

        parent.procList(nInputInitList[ikey], entry, inc)
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
    
    var parent = this

    parent.fns = {
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
        unsetAssociations: (aType, aEntry, ichkey) => {
            if (isArray(aEntry.associations)) {
                aEntry.associations.forEach(aci => {
                    _$(aci.parentKey , aType + " " + ichkey + " - " + aEntry.key + " parent key").isString().$_();
                    _$(aci.type      , aType + " " + ichkey + " - " + aEntry.key + " type for " + aci.parentKey).isString().$_();
    
                    nattrmon.deassociateObjectPool(aci.parentKey, aci.type);
                    log("Object pool " + aEntry.key + " deassociated from " + aci.parentKey + " as " + aci.type);
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
        },
        getParent: () => { return parent },
        procList: (init, params, inc) => {
            inc = _$(inc).isBoolean().default(false)

            if (init.type == "map") {
                params[init.name] = _$(params[init.name], init.name).isMap().default({});
                Object.keys(params[init.name]).forEach(ikey => {
                    var content = params[init.name][ikey];
                    try {
                        if (inc && isFunction(init.list) && isFunction(init.recycle)) {
                            var lstPrev, lstNew
                            lstPrev = init.list(parent.fns, ikey, content, inc)
                            lstNew = init.factory(parent.fns, ikey, content, inc)
       
                            lstNew = _$(lstNew).isArray().default([])
                            init.recycle(parent.fns, ikey, $from(lstPrev).except(lstNew).select(), inc)
                        } else {
                            if (!inc || init.dynamic) init.factory(parent.fns, ikey, content, inc)
                        }
                    } catch(e) {
                        logErr(e);
                    }
                })
            }
                
            if (init.type == "array") {
                params[init.name] = _$(params[init.name], init.name).isArray().default([]);
                params[init.name].forEach(content => {
                    try {
                        if (inc && isFunction(init.list) && isFunction(init.recycle)) {
                            var lstPrev, lstNew
                            lstPrev = init.list(parent.fns, content, inc)
                            lstNew = init.factory(parent.fns, content, inc)

                            lstNew = _$(lstNew).isArray().default([])
                            init.recycle(parent.fns, $from(lstPrev).except(lstNew).select(), inc)
                        } else {
                            if (!inc || init.dynamic) init.factory(parent.fns, content, inc)
                        }
                    } catch(e) {
                        logErr(e);
                    }
                })
            }
        }
    }

    Object.keys(nInputInitList).forEach(iinit => {
        parent.fns.procList(nInputInitList[iinit], this.params, false)
    })

    nInput.call(this, this.input);
};
inherit(nInput_Init, nInput);

nInput_Init.prototype.input = function(scope, args) {
    var ret = {};
    var parent = this

    Object.keys(nInputInitList)
    .filter(n => nInputInitList[n].dynamic)
    .forEach(iinit => {
        parent.fns.procList(nInputInitList[iinit], parent.params, true)
    })

    return ret;
};
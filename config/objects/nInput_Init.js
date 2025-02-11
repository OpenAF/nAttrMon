// Author: Nuno Aguiar

var nInputInitList = _$(nInputInitList, "nInputInitList").isMap().default({});

// AF
// --
nInputInitList["AF"] = {
    name   : "AF",
    type   : "map",
    // Get the list of entries for the channel
    list   : (parent, ikey, content) => {
        return ($ch().list().indexOf(ikey) >= 0 ? $ch(ikey).getKeys() : [])
    },
    recycle: (parent, ikey, content, noclean) => {
        content = _$(content, "content").isArray().default([])

        content.forEach(entry => {
            // Get the entry from the channel
            entry = $ch(ikey).get({ key: entry.key })
            // If noclean to cleaning should be done
            if (entry._noDestroy) { logWarn("nInputInit | No destroy set for AF object pool to access " + entry.key + "..."); return }
            if (isDef(entry.key)) {
                // Need to prevent the case that a pod from statefullset as really scale down
                /*if (noclean)
                    if (isDef(entry.podStatefullset))
                        if (!(entry.podStatefullset === "")) return */

                log("nInputInit | Destroying AF object pool to access '" + entry.key + "'...")
                nattrmon.delObjectPool(entry.key)

                log("nInputInit | Destroying object pool to access '" + entry.key + "' associations...")
                parent.unsetAssociations("AF", entry, ikey)

                // Unset the entry from the channel
                $ch(ikey).unset({ key: entry.key })
            }
        })
    },
    factory: (parent, ikey, content) => {
        content = _$(content, "content").isArray().default([]);

        // Create a channel to hold the entries (if it exists nothing will happen)
        $ch(ikey).create()
        content
        .forEach(entry => {
            // For each entry in the content array
            entry      = _$(entry, "AF " + ikey + " entry").isMap().$_();
            entry      = parent.setSec(entry);
            entry.pool = _$(entry.pool, "AF " + ikey + " - " + entry.key + " pool").isMap().default({});
            entry.key  = _$(entry.key, "AF " + ikey + " entry key").isString().$_();

            // Check if the entry already exists
            if (isDef($ch(ikey).get({ key: entry.key }))) {
                // Hold the current entry
                var aux_old = $ch(ikey).get({ key: entry.key })
                // Check if the URL is the same as the previous one (if so, nothing will happen)
                if (entry.url === aux_old.url) return

                // If the URL is different, remove it from the channel
                $ch(ikey).unset({ key: entry.key });
            }

            // Set the entry in the channel
            $ch(ikey).set({ key: entry.key }, entry);

            log("nInputInit | Creating AF object pool to access key '" + entry.key + "'...");
            try {
                let _url = java.net.URI(entry.url).toURL()
                log("nInputInit | AF object pool to access key '" + entry.key + "': proto=" + _url.getProtocol() + ", host=" + _url.getHost() + ", port=" + _url.getPort() + ", path=" + _url.getPath())
            } catch(_urle) {
                logErr("nInputInit | Error during URL parsing for AF object pool access key '" + entry.key + "': " + _urle)
                throw _urle
            }

            // Create the object pool
            var p = ow.obj.pool.AF(entry.url, entry.timeout, entry.conTimeout, entry.dontUseTransaction);
            // Assign the object pool to the entry
            parent.setPool(p, entry);
            // Add the object pool to the nattrmon object pools
            nattrmon.addObjectPool(entry.key, p);

            log("nInputInit | Created object pool to access '" + entry.key + "'")
            // Set the associations for the object pool
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
                    logErr("nInputInit | factory for CH - " + e1);
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
    recycle: (parent, ikey, content, noclean) => {
        content = _$(content, "content").isArray().default([])

        content.forEach(entry => {
            entry = $ch(ikey).get({ key: entry.key })
            // If noclean to cleaning should be done
            if (entry._noDestroy) { logWarn("nInputInit | No destroy set for DB object pool to access " + entry.key + "..."); return }
            if (isDef(entry.key)) {
                log("nInputInit | Destroying DB object pool to access " + entry.key + "...")
                nattrmon.delObjectPool(entry.key)

                log("nInputInit | Destroying object pool to access " + entry.key + " associations...")
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
                // Set the entry
                entry      = _$(entry, "DB " + ikey + " entry").isMap().$_();
                entry      = parent.setSec(entry);
                entry.pool = _$(entry.pool, "DB " + ikey + " - " + entry.key + " pool").isMap().default({});
                entry.key  = _$(entry.key, "DB " + ikey + " entry key").isString().$_();

                // Add the entry to the channel
                $ch(ikey).set({ key: entry.key }, entry);

                log("nInputInit | Creating DB object pool to access " + entry.key + "...");
                var p;
                // Create the object pool
                if (isDef(entry.driver)) {
                    p = ow.obj.pool.DB(entry.driver, entry.url, entry.login, entry.pass, __, entry.timeout);
                } else {
                    p = ow.obj.pool.DB(entry.url, entry.login, entry.pass, __, entry.timeout);
                }
                // Add the object pool to the entry
                parent.setPool(p, entry);
                // Add the object pool to the nattrmon object pools
                nattrmon.addObjectPool(entry.key, p);

                log("nInputInit | Created object pool to access " + entry.key);
                // Set the associations for the object pool
                parent.setAssociations("DB", entry, ikey);
            } catch(e1) {
                logErr("nInputInit | factory for DB - " +e1);
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
    // Get the list of entries for the channel
    list   : (parent, ikey, content) => {
        return ($ch().list().indexOf(ikey) >= 0 ? $ch(ikey).getKeys() : [])
    },
    // Recycle the entries for the channel
    recycle: (parent, ikey, content, noclean) => {
        content = _$(content, "content").isArray().default([])

        content.forEach(entry => {
            // Get the entry from the channel
            entry = $ch(ikey).get({ key: entry.key })
            // If noclean to cleaning should be done
            if (entry._noDestroy) { logWarn("nInputInit | No destroy set for SSH object pool to access " + entry.key + "..."); return }
            if (isDef(entry.key)) {
                log("nInputInit | Destroying SSH object pool to access " + entry.key + "...")
                nattrmon.delObjectPool(entry.key)

                log("nInputInit | Destroying object pool to access " + entry.key + " associations...")
                parent.unsetAssociations("SSH", entry, ikey)

                // Unset the entry from the channel
                $ch(ikey).unset({ key: entry.key })
            }
        })
    },
    // Factory for the entries for the channel
    factory: (parent, ikey, content) => {
        $ch(ikey).create()

        content
        .filter(r => isUnDef($ch(ikey).get({ key: r.key })))
        .forEach(entry => {
            try {
                // Set the entry
                entry      = _$(entry, "SSH " + ikey + " entry").isMap().$_();
                entry      = parent.setSec(entry);
                entry.pool = _$(entry.pool, "SSH " + ikey + " - " + entry.key + " pool").isMap().default({});
                entry.key  = _$(entry.key, "SSH " + ikey + " entry key").isString().$_();

                // Add the entry to the channel
                $ch(ikey).set({ key: entry.key }, entry);

                log("nInputInit | Creating SSH object pool to access " + entry.key + "...");
                var p = ow.obj.pool.SSH(entry.host, entry.port, entry.login, entry.pass, entry.idkey, entry.withCompression);

                // Add the object pool to the entry
                parent.setPool(p, entry);
                // Add the object pool to the nattrmon object pools
                nattrmon.addObjectPool(entry.key, p);

                log("nInputInit | Created object pool to access " + entry.key);
                // Set the associations for the object pool
                parent.setAssociations("SSH", entry, ikey);
            } catch(e1) {
                logErr("nInputInit | factory for SSH - " +e1);
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
    // Get the list of entries for the channel
    list   : (parent, ikey, content) => {
        return $ch()
               .list()
               .filter(r => r.startsWith("nattrmon::" + ikey + "::") && !r.endsWith("::__cache"))
               .map(r => ({ key: r.replace("nattrmon::" + ikey + "::", "") }))
    },
    // Recycle the entries for the channel
    recycle: (parent, ikey, content, noclean) => {
        content = _$(content, "content").isArray().default([])
        
        // Set the entries to be recycled
        content.forEach(entry => {
            entry      = _$(entry, "AFCache entry").isMap().$_()
            entry      = parent.setSec(entry)
            entry.key  = _$(entry.key, "AFCache '" + ikey + "' entry key").isString().$_()
            entry.ttl  = _$(entry.ttl, "AFCache '" + ikey + "' " + entry.key + " ttl key").isNumber().default(__)

            // If noclean to cleaning should be done
            if (entry._noDestroy) { logWarn("nInputInit | No destroy set for AF operation cache " + entry.key + "..."); return }
            log("nInputInit | Destroying AF operation cache '" + ikey + "' to access " + entry.key + "...")
            $cache("nattrmon::" + ikey + "::" + entry.key)
            .destroy()
        })
    },
    // Factory for the entries for the channel
    factory: (parent, ikey, content) => {
        content
        .filter(r => $ch()
                    .list()
                    .indexOf("nattrmon::" + ikey + "::" + r.key) < 0)
        .forEach(entry => {
            try {
                // Set the entry
                entry      = _$(entry, "AFCache entry").isMap().$_();
                entry      = parent.setSec(entry);
                entry.key  = _$(entry.key, "AFCache '" + ikey + "' entry key").isString().$_();
                entry.ttl  = _$(entry.ttl, "AFCache '" + ikey + "' " + entry.key + " ttl key").isNumber().default(__);

                log("nInputInit | Creating AF operation cache '" + ikey + "' to access " + entry.key + "...");
                // Create the cache
                $cache("nattrmon::" + ikey + "::" + entry.key)
                .ttl(entry.ttl)
                .fn(aK => {
                    if (isString(aK.op) && isMap(aK.args)) {
                        var res = __;
                        // Use the object pool to execute the operation
                        nattrmon.useObject(entry.key, function(s) {
                            try {
                                // Execute the operation
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

                log("nInputInit | Created AF operation cache to access " + entry.key);
            } catch(e1) {
                logErr("nInputInit | factory for AFCache - " +e1);
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
    // Create the list of entries for the channel
    factory: (parent, ikey, content, inc) => {
        var entry = {}
        entry[ikey] = clone(content)

        if (isUnDef(getOPackPath("Kube"))) throw "nInputInit | Kube opack not installed."
        loadLib("kube.js")

        // Get the list of items from K8S
        var getKubeLst = m => {
            // Get data from a sbucket
            m = parent.setSec(m)
            // Traverse the map and apply the templify function
            traverse(m, (aK, aV, aP, aO) => {
                if (isString(aV)) aO[aK] = templify(aV, m)
            })
            // Set the default values for the kind (pords) and namespace (default)
            m.kind      = _$(m.kind, "_kube.kind").isString().default("FPO")
            m.namespace = _$(m.namespace, "_kube.namespace").isString().default("default")

            // Get the list of items from the Kube object pool
            var nss = m.namespace.split(/ *, */)
            var lst = []
            // For each namespace, get the list of items
            nss.forEach(ns => {
                try {
                    // Get the items from K8S
                    var its = $kube(m)["get" + m.kind](ns)
                    if (isMap(its) && isArray(its.items)) lst = lst.concat(its.items)
                } catch(nse) {
                    logErr("nInput_Init | Kube | Error during get Kube listing: " + nse)
                }
            })
            return lst
        }, 
        // Process the list of items from K8S
        procKubeLst = (m, lst) => {
            // Filter the list of items from K8S using the selector provided
            return ow.obj.filter(lst, isString(m._kube.selector) ? af.fromNLinq(m._kube.selector) : m._kube.selector).map(r => {
                var newM = clone(m)
                delete newM._kube
                // Set the security parameters for the entry
                newM = parent.setSec(newM)
                // Traverse the map and apply the templify function
                traverse(newM, (aK, aV, aP, aO) => {
                    if (isString(aV)) aO[aK] = templify(aV, r)
                })
                return newM
            })
        }

        // If the entry is an array of maps
        if (isArray(entry[ikey])) {
            entry[ikey].forEach(m => {
                m._kube = _$(m._kube, "_kube").isMap().default({})
                m._kube.selector = _$(m._kube.selector, "_kube.selector").default({})

                // Get the list of items from K8S for the entry
                var lst = getKubeLst(m._kube)
                // If the list is an array, process it
                if (isArray(lst)) {
                    // Process the list of items from K8S
                    entry[ikey] = procKubeLst(m, lst)
                }
            })
        } else {
            // If the entry is a map
            if (isMap(entry[ikey])) {
                Object.keys(entry[ikey]).forEach(ch => {
                    var m = entry[ikey][ch]
                    if (isArray(m) && m.length >= 1) m = m[0]

                    m._kube = _$(m._kube, "_kube").isMap().default({})
                    m._kube.selector = _$(m._kube.selector, "_kube.selector").default({})

                    // Get the list of items from K8S for the entry
                    var lst = getKubeLst(m._kube)
                    if (isArray(lst)) {
                        // Process the list of items from K8S
                        entry[ikey][ch] = procKubeLst(m, lst)
                    }
                })
            }
        }

        // Process the list of entries for the object pool
        parent.procList(nInputInitList[ikey], entry, inc, true)
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

    var _tries = this.params._retriesBeforeDestroy

    parent._entryRetries = {}
    parent.fns = {
        // setPool - sets the pool parameters for a given entry
        setPool: (aPool, aEntry) => {
            if (isDef(aEntry.pool.max))           aPool.setMax(aEntry.pool.max);
            if (isDef(aEntry.pool.min))           aPool.setMin(aEntry.pool.min);
            if (isDef(aEntry.pool.retry))         aPool.setRetry(aEntry.pool.retry);
            if (isDef(aEntry.pool.retryInterval)) aPool.setTimeout(aEntry.pool.retryInterval);
            if (isDef(aEntry.pool.incrementsOf))  aPool.setIncrementsOf(aEntry.pool.incrementsOf);
            if (isDef(aEntry.pool.keepalive))     aPool.setKeepaliveInMs(aEntry.pool.keepalive);
        },
        // setAssociations - sets the associations identified in the associations array for a given entry
        setAssociations: (aType, aEntry, ichkey) => {
            if (isArray(aEntry.associations)) {
                aEntry.associations.forEach(aci => {
                    _$(aci.parentKey , aType + " " + ichkey + " - " + aEntry.key + " parent key").isString().$_();
                    _$(aci.type      , aType + " " + ichkey + " - " + aEntry.key + " type for " + aci.parentKey).isString().$_();
    
                    nattrmon.associateObjectPool(aci.parentKey, aEntry.key, aci.type);
                    log("nInputInit | Object pool " + aEntry.key + " associated with " + aci.parentKey + " as " + aci.type);
                })
            }
        },
        // unsetAssociations - unsets the associations for a given entry
        unsetAssociations: (aType, aEntry, ichkey) => {
            if (isArray(aEntry.associations)) {
                aEntry.associations.forEach(aci => {
                    _$(aci.parentKey , aType + " " + ichkey + " - " + aEntry.key + " parent key").isString().$_();
                    _$(aci.type      , aType + " " + ichkey + " - " + aEntry.key + " type for " + aci.parentKey).isString().$_();
    
                    nattrmon.deassociateObjectPool(aci.parentKey, aci.type);
                    log("nInputInit | Object pool " + aEntry.key + " deassociated from " + aci.parentKey + " as " + aci.type);
                })
            }
        },
        // setSec - sets the security parameters for a given entry
        setSec: aEntry => {
            if (isDef(aEntry.secKey)) {
                //return merge(aEntry, $sec(aEntry.secRepo, aEntry.secBucket, aEntry.secPass, aEntry.secMainPass, aEntry.secFile).get(aEntry.secKey));
                return __nam_getSec(aEntry);
            } else {
                return aEntry;
            }
        },
        // getParent - returns the parent object
        getParent: () => { return parent },
        // procList - processes the list of entries for a given object pool
        //         init: the object pool initialization object
        //       params: the parameters object
        //          inc: whether to include or not the entries
        //       iskube: whether it is a Kube object pool or not
        procList: (init, params, inc, iskube) => {
            inc = _$(inc).isBoolean().default(false)

            if (init.type == "map") {
                // If the entry retries are not defined, define them
                if (isUnDef(parent._entryRetries)) parent._entryRetries = {}
                if (isUnDef(parent._entryRetries[init.name])) parent._entryRetries[init.name] = {}

                params[init.name] = _$(params[init.name], init.name).isMap().default({});
                // Process the list of entries for each type of object pool
                Object.keys(params[init.name]).forEach(ikey => {
                    // If the entry retries are not defined, define them
                    if (isUnDef(parent._entryRetries[init.name][ikey])) parent._entryRetries[init.name][ikey] = $atomic()

                    var content = params[init.name][ikey];
                    try {
                        // if should include entries and the list and recycle functions are defined
                        if (inc && isFunction(init.list) && isFunction(init.recycle)) {
                            var lstPrev, lstNew
                            // get the current (previous after factory) list of entries for the object pool
                            lstPrev = init.list(parent.fns, ikey, content, inc)
                            // create the new list of entries for the object pool
                            lstNew = init.factory(parent.fns, ikey, content, inc)
       
                            lstNew = _$(lstNew).isArray().default([])
                            // recycle the object pool entries that are not in the new list
                            var _res = $from(lstPrev).except(lstNew)
                            if (_res.any()) {
                                if (parent._entryRetries[init.name][ikey].get() >= _tries) {
                                    init.recycle(parent.fns, ikey, _res.select(), iskube)
                                    parent._entryRetries[init.name][ikey].set(0)
                                } else {
                                    if (isDef(_tries) && _tries > 0) {
                                        parent._entryRetries[init.name][ikey].inc()
                                        log("nInputInit | Graceful retries before destroy for (" + init.name + ") #" + ikey + " (" + parent._entryRetries[init.name][ikey].get() + "/" + _tries + ")")
                                    } else {
                                        init.recycle(parent.fns, ikey, _res.select(), iskube)
                                    }
                                }  
                            }
                        } else {
                            // if should not include entries or the object pool is dynamic
                            if (!inc || init.dynamic) init.factory(parent.fns, ikey, content, inc)
                        }
                    } catch(e) {
                        logErr("nInputInit | Error in ProcList (map) " + init.name + ": " + e);
                    }
                })
            }
                
            if (init.type == "array") {
                // If the entry retries are not defined, define them
                if (isUnDef(parent._entryRetries)) parent._entryRetries = []

                params[init.name] = _$(params[init.name], init.name).isArray().default([]);
                params[init.name].forEach((content, i) => {
                    // If the entry retries are not defined, define them
                    if (isUnDef(parent._entryRetries[init.name][i])) parent._entryRetries[init.name][i] = $atomic()
                    try {
                        // if should include entries and the list and recycle functions are defined
                        if (inc && isFunction(init.list) && isFunction(init.recycle)) {
                            var lstPrev, lstNew
                            // get the current (previous after factory) list of entries for the object pool
                            lstPrev = init.list(parent.fns, content, inc)
                            // create the new list of entries for the object pool
                            lstNew = init.factory(parent.fns, content, inc)

                            lstNew = _$(lstNew).isArray().default([])
                            // recycle the object pool entries that are not in the new list
                            // if iskube is defined, the cleaning should not be done
                            init.recycle(parent.fns, $from(lstPrev).except(lstNew).select(), iskube)


                            var _res = $from(lstPrev).except(lstNew)
                            if (_res.any()) {
                                var _tries = _$(content._retriesBeforeDestroy, "_retriesBeforeDestroy").isNumber().default(0)
                                if (parent._entryRetries[init.name][iskube].get() > _tries) {
                                    init.recycle(parent.fns, _res.select(), iskube)
                                    parent._entryRetries[init.name][i].set(0)
                                } else {
                                    if (isDef(_tries) && _tries > 0) {
                                        parent._entryRetries[init.name][i].inc()
                                        log("nInputInit | Graceful retries before destroy for (" + init.name + ") #" + i + " (" + parent._entryRetries[init.name][i].get() + "/" + _tries + ")")
                                    } else {
                                        init.recycle(parent.fns, _res.select(), iskube)
                                    }
                                }  
                            }
                        } else {
                            // if should not include entries or the object pool is dynamic
                            if (!inc || init.dynamic) init.factory(parent.fns, content, inc)
                        }
                    } catch(e) {
                        logErr("nInputInit | Error in ProcList (array) " + init.name + ": " + e);
                    }
                })
            }
        }
    }

    // Process the list of entries for each type of object pool
    Object.keys(nInputInitList).forEach(iinit => {
        parent.fns.procList(nInputInitList[iinit], this.params, false, false)
    })

    nInput.call(this, this.input);
};
inherit(nInput_Init, nInput);

nInput_Init.prototype.input = function(scope, args) {
    var ret = {};
    var parent = this

    // Process the list of entries for each type of object pool
    Object.keys(nInputInitList)
    .filter(n => nInputInitList[n].dynamic)
    .forEach(iinit => {
        parent.fns.procList(nInputInitList[iinit], parent.params, true, false)
    })

    return ret;
};
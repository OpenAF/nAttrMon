/**
 * <odoc>
 * <key>nattrmon.nInput_RAIDStatus_DB(aMap) : nInput</key>
 * You can create an input to check for sessions using a map composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template)\
 * \
 * </odoc>
 */
var nInput_RAIDStatus_DB = function (aMap) {
    if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
    }

    if (isObject(aMap)) {
        this.params = aMap;

        // If keys is not an array make it an array.
        if (!(isArray(this.params.keys))) this.params.keys = [this.params.keys];
    }

    if (isDef(this.attributePrefix)) {
        this.params.attrTemplate = this.attributePrefix;
    }
    if (isUnDef(this.params.attrTemplate)) {
        this.params.attrTemplate = "RAID/{{name}} DB connections";
    }

    nInput.call(this, this.input);
}
inherit(nInput_RAIDStatus_DB, nInput);

nInput_RAIDStatus_DB.prototype.__getData = function (aKey, scope) {
    var retSes = {};
    var ses, parseResult = false;

    try {
        var parent = this;

        if (isDef(aKey)) {
            if (isBoolean(parent.params.useCache) && parent.params.useCache) {
                var res = $cache("nattrmon::" + aKey).get({ op: "StatusReport", args: {} });
                if (isMap(res) && isDef(res.__error)) throw res.__error;
                if (isMap(res) && isDef(res.Services) && isDef(res.Services["wedo.jaf.services.database.ConnectionManagerBase"])) {
                    res = res.Services["wedo.jaf.services.database.ConnectionManagerBase"];
                    parseResult = true;
                    ses = res;
                } else {
                    logErr("Error while retrieving connection manager base data using '" + aKey + "': " + e.message);
                }
            } else {
                nattrmon.useObject(aKey, s => {
                    try {
                        ses = s.exec("StatusReport", {});
                        if (isMap(ses) && isDef(ses.Services) && isDef(ses.Services["wedo.jaf.services.database.ConnectionManagerBase"])) {
                            ses = ses.Services["wedo.jaf.services.database.ConnectionManagerBase"];
                            parseResult = true;
                            return true;
                        } else {
                            return false;
                        }
                    } catch (e) {
                        logErr("Error while retrieving connection manager base data using '" + aKey + "': " + e.message);
                        return false;
                    }
                });
            }
        } else {
            try {
                ses = s.exec("StatusReport", {}).Services["wedo.jaf.services.database.ConnectionManagerBase"];
                if (isMap(ses) && isDef(ses.Services) && isDef(ses.Services["wedo.jaf.services.database.ConnectionManagerBase"])) {
                    ses = ses.Services["wedo.jaf.services.database.ConnectionManagerBase"];
                    parseResult = true;
                }
            } catch (e) {
                logErr("Error while retrieving connection manager base data: " + e.message);
            }
        }

        if (parseResult) {
            retSes = $from(ses).select(r => {
                return {
                    "Name": aKey,
                    "DB": r._key,
                    "Connections": r.Connections,
                    "Active": r.Active,
                    "AvgTimeForConnection": r.AverageTimeForConns,
                    "MaxConnections": r.MaxConnections,
                    "WaitListLength": r.WaitList.length,
                    "Fetches": r.Fetches,
                    "Total": r.Total,
                    "InUseLength": r.InUse.length,
                    "AverageWait": r.AverageWait,
                    "CallersGaveUp": r["N.CallerGaveUp"],
                    "PoolOutOfConnections": r["N.PoolOutOfConns"]
                };
            });
        } else {
            throw "can't parse results";
        }
    } catch (e) {
        logErr("Error while retrieving db connections data using '" + aKey + "': " + e.message);
    }

    return retSes;
};

nInput_RAIDStatus_DB.prototype.input = function (scope, args) {
    var res = {};
    var arr = [];

    if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

    for (var i in this.params.keys) {
        arr = arr.concat(this.__getData(this.params.keys[i], scope));
    }

    res[templify(this.params.attrTemplate)] = arr;
    return res;
};
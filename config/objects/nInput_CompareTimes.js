/**
 * <odoc>
 * <key>nattrmon.nInput_CompareTimes(aMap) : nInput</key>
 * You can create an input to compare times between RAID and database schemas:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template for the name of the attribute)\
 *    - databaseSchemas (an array to specify which associated database schemas should be compared (defaults to [db.app, db.dat]))\
 *    - compareActualTime (a boolean to indicate that the RAID time should be compared with actual time from the internet)\
 *    - useHTTPActualTime (a boolean to indicate that a HTTP alternative method should be used to get the actual time from the internet)\
 * \
 * </odoc>
 */
var nInput_CompareTimes = function (aMap) {
    this.params = (isDef(aMap) ? aMap : {});

    if (isUnDef(this.params.attrTemplate)) {
        this.params.attrTemplate = "Server status/Compare timestamps";
    }

    if (isUnDef(this.params.databaseSchemas)) {
        this.params.databaseSchemas = ["db.app", "db.dat"];
    }

    nInput.call(this, this.input);
};
inherit(nInput_CompareTimes, nInput);

nInput_CompareTimes.prototype.__getTimes = function (aKey) {
    var retTime = {};

    try {
        var key = aKey;
        var dbRes4Key = {},
            inetTime;
        if (nattrmon.isObjectPool(key)) {
            var getDBTime = (key, adb) => {
                return () => {
                    var dbKey = nattrmon.getAssociatedObjectPool(key, adb);
                    nattrmon.useObject(dbKey, (db) => {
                        db.convertDates(true);
                        var qres = db.q("select current_date from dual").results;
                        dbRes4Key[adb] = qres[0].CURRENT_DATE;
                    });
                };
            };
            var appDate;

            var promises = [];
            promises.push($do(() => {
                nattrmon.useObject(key, (aAF) => {
                    if (this.params.compareActualTime) {
                        inetTime = ow.format.getActualTime(this.params.useHTTPActualTime);
                    }
                    appDate = ow.format.fromWeDoDateToDate(aAF.exec("StatusReport").ReportDate);
                });
            }).catch((r) => {
                logErr("Error while retrieving Compare Times for " + aKey + "(" + String(e) + ")");
            }));
            for (var i in this.params.databaseSchemas) {
                promises.push($do(getDBTime(key, this.params.databaseSchemas[i])).catch((r) => {
                    logErr("Error while retrieving Compare Times for " + this.params.databaseSchemas[i] + "(" + String(e) + ")");
                }));
            }
            $doWait($doAll(promises));

            retTime.key = key;
            retTime["RAID reported time"] = appDate;
            for (var i in this.params.databaseSchemas) {
                retTime[this.params.databaseSchemas[i] + " reported time"] = dbRes4Key[this.params.databaseSchemas[i]];
                retTime[this.params.databaseSchemas[i] + " diff (min)"] = (isDef(dbRes4Key[this.params.databaseSchemas[i]]) ? ow.format.dateDiff.inMinutes(dbRes4Key[this.params.databaseSchemas[i]], appDate) : "n/a");
            }

            if (this.params.compareActualTime) {
                retTime["Internet time"] = inetTime;
                retTime["RAID diff (min)"] = ow.format.dateDiff.inMinutes(inetTime, appDate);
            }
        }
    } catch (e) {
        logErr("Error while retrieving Compare Times using '" + aKey + "': " + e.message);
    }

    return retTime;
};

nInput_CompareTimes.prototype.input = function (scope, args) {
    var res = {},
        arRes = [];

    if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

    for (var i in this.params.keys) {
        arRes.push(this.__getTimes(this.params.keys[i]));
    }

    res[templify(this.params.attrTemplate)] = arRes;

    return res;
};
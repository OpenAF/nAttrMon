/**
 */
var nInput_DMPerformance = function(aMap) {
    this.params = aMap;
    ow.loadWAF();

    // If keys is not an array make it an array.
    if (isUnDef(this.params.keys) && isUnDef(this.params.chKeys)) {
        var e = "nInput_DMPerformance: You need to provide keys or chKeys";
        logErr(e);
        throw e;
    }
    if (!(isArray(this.params.keys))) this.params.keys = [ this.params.keys ];

    if (isUnDef(this.params.queries)) this.params.queries = {};
    if (isArray(this.params.queries)) throw "The queries parameter should be a map object.";

	if (isUnDef(this.params.attrTemplate)) {        
		this.params.attrTemplate = "Performance/{{key}} datamodel";
	}

    if (isUnDef(this.params.bestOf)) this.params.bestOf = 1;

	nInput.call(this, this.input);
};
inherit(nInput_DMPerformance, nInput);

nInput_DMPerformance.prototype.input = function(scope, args) {
	var res = {};
	var parent = this;
	
	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

	for (var i in this.params.keys) {
		var arr = [];
		var aKey = this.params.keys[i];

		try {
            if (isDef(aKey)) {
                var parent = this, resAr = [];

                for(var j in this.params.queries) {
                    var init, pDM, tDM, tDB, nDM, nDB, qdb, query;

                    for(var ij = 0; ij < this.params.bestOf; ij++) {
                        nattrmon.useObject(aKey, function(aAf) {
                            aAf.exec("Ping", {}); // Ensure it's connected before testing to avoid connection time

                            init = now();
                            var qId = ow.waf.datamodel.getQueryId(aAf, parent.params.queries[j]); // Also ensures it's connected to the server
                            pDM = now() - init;

                            try {
                                init = now();
                                var rows = ow.waf.datamodel.getRowsFromQueryId(aAf, qId);
                                tDM = now() - init;
                                nDM = rows.Data.length;

                                qdb = ow.waf.datamodel.getSQLFromQueryId(aAf, qId).QueryPlan;
                                query = qdb.replace(/[^:]+SQL statement:/, "").replace(/\n/g, "");
                            } catch(e) {
                                throw e;
                            } finally {
                                ow.waf.datamodel.closeQueryId(aAf, qId);
                            }

                            return true;
                        });

                        nattrmon.useObject(nattrmon.getAssociatedObjectPool(aKey, "db." + qdb.replace(/\n/g, "").replace(/Connect to (\w+).+/g, "$1").toLowerCase()), function(aDB) {
                            aDB.q("select user from dual"); // Ensure it's connected before testing

                            init = now();
                            var rows = aDB.q(query).results;
                            tDB = now() - init;
                            nDB = rows.length;

                            return true;
                        });

                        if ($from(resAr).equals("Query", j).any()) {
                            var current = $from(resAr).equals("Query", j).at(0);
                            if (current["DataModel time"] > tDM) {
                                current["DataModel time"] = tDM;
                                current["DataModel rows"] = nDM;
                            }

                            if (current["Direct DB time"] > tDB) {
                                current["Direct DB time"] = tDB;
                                current["Direct DB rows"] = nDB;
                            }
                        } else {
                            resAr.push({
                                Query: j,
                                "DataModel prepare time": pDM,
                                "DataModel time": tDM,
                                "DataModel rows": nDM,
                                "Direct DB time": tDB,
                                "Direct DB rows": nDB
                            });
                        }
                    }
                }
                res[templify(this.params.attrTemplate, { key: aKey })] = resAr;
            }
        } catch(ee) {
            logErr("nInput_DMPerformance: Problem with " + aKey + ": " + String(ee));
        }	
	}

	return res;
};

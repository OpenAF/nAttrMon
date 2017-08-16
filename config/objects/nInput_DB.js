/**
 * <odoc>
 * <key>nattrmon.nInput_DB(aMap) : nInput</key>
 * aMap is composed of:\
 *    - key (the key for the database access)\
 *    - sqls (a map of queries (if a ':__lastdate' is included it will be replaced by the last checked date), each will become an attribute)
 * </odoc>
 */
var nInput_DB = function(anMonitoredAFObjectKey, aMapOfAttributeNameANDSQL) {
 	if (isObject(anMonitoredAFObjectKey)) {
		this.params = anMonitoredAFObjectKey;
      
 		this.objectPoolKey = this.params.key;
 		this.map = this.params.sqls;
        } else {
		// Is a monitored object or a pool?
		if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
			this.objectPoolKey = anMonitoredAFObjectKey;
			this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
		} else {
			this.monitoredObjectKey = anMonitoredAFObjectKey;
			if (nattrmon.hasMonitoredObject(anMonitoredAFObjectKey))
				this.db = nattrmon.getMonitoredObject(anMonitoredAFObjectKey);
			else
				throw "Key " + anMonitoredAFObjectKey + " not found.";
		}
		
		this.map = aMapOfAttributeNameANDSQL;
        }

	nInput.call(this, this.input);
}
inherit(nInput_DB, nInput);

nInput_DB.prototype.input = function(scope, args) {
	var ret = {};
	var parent = this;

	parallel4Array(Object.keys(this.map), function(aKey) {
		var res;
		var i = aKey;
		var parent2 = parent;
		var aSQL = parent.map[aKey];

		try {
        		var atr = scope.getAttributes().getAttributeByName(i);
                        var lastcheck;
                        var useparam = true;
                        if (isDef(atr) && isDef(atr.lastcheck)) lastcheck = new Date(atr.lastcheck); else lastcheck = new Date();
                        lastcheck = ow.format.fromDate(lastcheck, 'yyyyMMddHHmmss');

                        if (!aSQL.match(/:__lastdate/)) useparam = false; 
 			aSQL = aSQL.replace(/:__lastdate/g, "to_date(?, 'YYYYMMDDHH24MISS')");

			// Get result for monitoredObject or object pool
			if (isDefined(parent.objectPoolKey)) {
				nattrmon.useObject(parent.objectPoolKey, function(aDb) {
					try {
						res = (useparam) ? aDb.qs(aSQL, [lastcheck], true).results : aDb.q(aSQL).results;
					} catch(e) {
						logErr("Error while retriving DB query ' " + aSQL + "' from '" + parent2.objectPoolKey + "': " + e.message);
						throw e;
					}
					return true;
				});
			} else {
				sync(function() {
					res = (useparam) ? parent2.db.qs(aSQL, [lastcheck], true).results : parent2.db.q(aSQL).results;
				}, this.db);
			}

			// Handle result
			if (isUndefined(res)) {
				ret[i] = undefined;
			} else {
				if (res.length == 1 && Object.keys(res[0]).length == 1) {
					ret[i] = res[0][Object.keys(res[0])[0]];
				} else {
					if (res.length == 1) {
						ret[i] = res[0];
					} else {
						ret[i] = res;
					}
				}				
			}

		} catch(e) {
			logErr("Error while retriving DB queries from '" + parent2.objectPoolKey + "': " + stringify(e));
			if (isUndefined(parent2.objectPoolKey)) {
				nattrmon.declareMonitoredObjectDirty(parent2.monitoredObjectKey);
				parent2.db = nattrmon.getMonitoredObject(parent2.monitoredObjectKey);
			}
		}
                return 1;
	});

	return ret;
}

loadUnderscore();

/**
 * <odoc>
 * <key>nattrmon.nInput_DB(aMap) : nInput</key>
 * aMap is composed of:\
 *    - key        (the key for the database access)\
 *    - key.parent (in alternative provide the parent key (e.g. RAS))\
 *    - key.child  (in alternative provide the child key synonym (e.g. db.app))\
 *    - sqls       (a map of query templates (if a '{{lastdate}}' is included it will be replaced by the last checked date), each will become an attribute)
 *    - sqlsByType (in alternative to sqls lets you divide further into SQL statement per database product (e.g. postgresql, oracle, h2, etc...))
 * </odoc>
 */
var nInput_DB = function (anMonitoredAFObjectKey, aMapOfAttributeNameANDSQL) {
	if (isObject(anMonitoredAFObjectKey)) {
		this.params = anMonitoredAFObjectKey;

		if (isDef(this.params.key)) {
			if (isObject(this.params.key) && isDef(this.params.key.parent) && isDef(this.params.key.child)) {
				this.objectPoolKey = nattrmon.getAssociatedObjectPool(this.params.key.parent, this.params.key.child);
			} else {
				this.objectPoolKey = this.params.key;
			}
		}
		
		if (isDef(this.params.sqlsByType) && isUnDef(this.params.sqls)) {
			var res;

			nattrmon.useObject(this.objectPoolKey, function(aDb) {	
				//res = String(aDb.getConnect().getClass()).indexOf("postgresql") > 0;
				res = String(aDb.getConnect().getMetaData().getDatabaseProductName()).toLowerCase();
				return true;
			});
			
		    this.map = this.params.sqlsByType[res];
			/*if (res) {
				this.map = this.params.sqlsByType.postgresql;
			} else {
				this.map = this.params.sqlsByType.oracle;
			}*/
		} else {
			this.map = this.params.sqls;
		}
			
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

nInput_DB.prototype.input = function (scope, args) {
	var ret = {};
	var parent = this;

	ow.template.addHelper("toDate", (s) => { if (isDef(s) && s != null && new Date(s) != null) return "to_date('" + ow.format.fromDate(new Date(s), 'yyyyMMddHHmmss') + "', 'YYYYMMDDHH24MISS')"; else return null; });

	parallel4Array(Object.keys(this.map), function (aKey) {
		var res;
		var i = aKey;
		var parent2 = parent;
		var aSQL = parent.map[aKey];

		try {
			var atr = scope.getAttributes().getAttributeByName(i);
			var lval = scope.getLastValues()[i];
			//var warns = ow.obj.fromArray2Obj(scope.getWarnings(true).getCh().getAll(), "title");

			var data = {
				attribute: atr,
				lastValue: lval
			};

			// Get result for monitoredObject or object pool
			if (isDef(parent.objectPoolKey)) {
				if (nattrmon.isObjectPool(parent.objectPoolKey)) {
					nattrmon.useObject(parent.objectPoolKey, function (aDb) {
						try {
							if (isDef(aDb.convertDates)) aDb.convertDates(true);
							res = aDb.q(templify(aSQL, data)).results;
							//res = (useparam) ? aDb.qs(aSQL, [String(lastcheck)], true).results : aDb.q(aSQL).results;
						} catch (e) {
							logErr("Error while retriving DB query from '" + parent2.objectPoolKey + "': " + e.message);
							logErr("DB query = '" + templify(aSQL, data) + "'");
							throw e;
						}
						
						// Properly end transaction (issue #93)
						aDb.rollback();
						return true;
					});
				} else {
					logWarn("Object pool key = '" + parent.objectPoolKey + "' not found.");
				}
			} else {
				sync(function () {
					//res = (useparam) ? parent2.db.qs(aSQL, [String(lastcheck)], true).results : parent2.db.q(aSQL).results;
					res = parent2.db.q(templify(aSQL, data)).results;
				}, this.db);
			}

			// Handle result
			if (isUnDef(res)) {
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

		} catch (e) {
			logErr("Error while retriving DB queries from '" + parent2.objectPoolKey + "': " + stringify(e));
			if (isUndefined(parent2.objectPoolKey)) {
				nattrmon.declareMonitoredObjectDirty(parent2.monitoredObjectKey);
				parent2.db = nattrmon.getMonitoredObject(parent2.monitoredObjectKey);
			}
		}
		return 1;
	}, __NAM_WORKERS);
	ow.template.delHelper("toDate");
	//ow.template.delHelper("debug");

	return ret;
};
// Author: Nuno Aguiar, Leandro Fernandes

/**
 * <odoc>
 * <key>nattrmon.nInput_DB(aMap) : nInput</key>
 * aMap is composed of:\
 *    - chKeys     (the channel of keys to use)\
 *    - key        (the key for the database access)\
 *    - key.parent (in alternative provide the parent key (e.g. RAS))\
 *    - key.child  (in alternative provide the child key synonym (e.g. db.app))\
 *    - sqls       (a map of query templates (if a '{{lastdate}}' is included it will be replaced by the last checked date), each will become an attribute)\
 *    - sqlsByType (in alternative to sqls lets you divide further into SQL statement per database product (e.g. postgresql, oracle, h2, etc...))\
 *    - dontUseKey (boolean to indicate if a key field should not be added in all records returned with chKeys)
 * </odoc>
 */
var nInput_DB = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

	this.params.dontUseKey = _$(this.params.dontUseKey, "dontUseKey").isBoolean().default(isDef(this.params.key))

	if (isUnDef(this.params.attrTemplate)) 
		if (isDef(this.params.key)) 
			this.params.attrTemplate = "{{query}}"
		else
			this.params.attrTemplate = (this.params.dontUseKey ? "DB {{key}}/{{query}}" : "{{query}}")
	
	nInput.call(this, this.input)
}
inherit(nInput_DB, nInput)

nInput_DB.prototype.get = function(aKey, parent, ret, scope) {
	var parent2 = parent
	var queries

	try {
		// If sqlsByType provided and no sqls provided
		if (isDef(parent.sqlsByType) && isUnDef(parent.sqls)) {
			var res

			// Determine the database name
			nattrmon.useObject(aKey, function(aDb) {	
				res = String(aDb.getConnect().getMetaData().getDatabaseProductName()).toLowerCase()
				return true
			})
			
			// Keep the sqls for the specific database type
			queries = parent.sqlsByType[res]
		} else {
			// Keep the sqls provided
			queries = parent.sqls
		}

		// If object poll association is provided
		if (isObject(parent.key) && isDef(parent.key.parent) && isDef(parent.key.child)) {
			// Retrieve association
			parent.objectPoolKey = nattrmon.getAssociatedObjectPool(parent.key.parent, parent.key.child)
		} else {
			// Keep current key
			parent.objectPoolKey = parent.key
		}

		if (isUnDef(queries) || !isMap(queries)) throw "nInput_DB | sqls or sqlsByType not defined or not a map."

		parallel4Array(Object.keys(queries), function(aAttr) {	
			var res	
			try {
				var aSQL = queries[aAttr]
				var naAttr = templify(parent.attrTemplate, merge(parent, { query: aAttr }))
	
				var data = {
					attribute: scope.getAttributes().getAttributeByName(naAttr),
					lastValue: scope.getLastValues()[naAttr]
				}
	
				// Get result for monitoredObject or object pool
				if (isDef(parent.objectPoolKey)) {
					if (nattrmon.isObjectPool(parent.objectPoolKey)) {
						nattrmon.useObject(parent.objectPoolKey, function(aDb) {
							try {
								if (isDef(aDb.convertDates)) aDb.convertDates(true)
								res = aDb.q(templify(aSQL, data)).results
							} catch (e) {
								logErr("nInput_DB | Error while retriving DB query from '" + parent.objectPoolKey + "' for '" + parent.objectPoolKey + ": " + e.message)
								logErr("nInput_DB | Key = '" + parent.objectPoolKey + "' DB query = '" + templify(aSQL, data) + "'")
								throw e
							}
							
							// Properly end transaction (issue #93)
							aDb.rollback()
							return true
						})
					} else {
						logWarn("nInput_DB | Object pool key = '" + parent.objectPoolKey + "' not found.")
					}
				}
	
				// Handle result and adding or not the key field
				if (isUnDef(res)) {
					ret[naAttr] = __
				} else {
					// Verify if key field exists in res
					if (!parent.dontUseKey) {
						var keyFieldExists = false
						res = res.map(record => {
							if (!keyFieldExists) keyFieldExists = Object.keys(record).indexOf("key") >= 0
							record.key = parent.objectPoolKey
							return record
						})
						if (keyFieldExists) logWarn("nInput_DB | Result from '" + naAttr + "' for '" + parent.objectPoolKey + "' contains a 'key' field. It will be overwritten (to modify this behaviour use dontUseKey=true).")
						
						// Check if needs concat with previous results of other keys
						if (isDef(ret[naAttr])) {
							sync(() => {
								ret[naAttr] = ret[naAttr].concat(res)
							}, ret[naAttr])
						} else {
							ret[naAttr] = res
						}
					} else {
						// Simplify result if one single column and/or one single value output
						if (res.length == 1 && Object.keys(res[0]).length == 1) {
							ret[naAttr] = res[0][Object.keys(res[0])[0]]
						} else {
							if (res.length == 1) {
								ret[naAttr] = res[0]
							} else {
								ret[naAttr] = res
							}
						}
					}
				}
			} catch(ee) {
				logErr("nInput_DB | Problem trying to process query '" + aAttr + "' for '" + parent.objectPoolKey + ": " + ee)
			}
			return 1
		}, __NAM_WORKERS)
	} catch (e) {
		logErr("nInput_DB | Error while retriving DB queries from '" + parent2.objectPoolKey + "': " + stringify(e))
		if (isUnDef(parent2.objectPoolKey)) {
			nattrmon.declareMonitoredObjectDirty(parent2.monitoredObjectKey)
			parent2.db = nattrmon.getMonitoredObject(parent2.monitoredObjectKey)
		}
	}
}

nInput_DB.prototype.input = function(scope, args) {
	var ret = {}
	var parent = this

	ow.template.addHelper("toDate", (s) => { if (isDef(s) && s != null && new Date(s) != null) return "to_date('" + ow.format.fromDate(new Date(s), 'yyyyMMddHHmmss') + "', 'YYYYMMDDHH24MISS')"; else return null; })

	if (isDef(this.params.chKeys)) {
		var arr = []
		$ch(this.params.chKeys).forEach((k, v) => {
			var m = {
				key         : k.key,
				sqls        : parent.params.sqls,
				sqlsByType  : parent.params.sqlsByType,
				attrTemplate: parent.params.attrTemplate,
				dontUseKey  : parent.params.dontUseKey
			}
			m = merge(v, m)
			parent.get(k.key, m, ret, scope)
		})
	} else {
		//parent.get(parent.key, parent.params, ret, scope)
		parent.get(parent.params.key, parent.params, ret, scope)
	}

	ow.template.delHelper("toDate")

	return ret
}
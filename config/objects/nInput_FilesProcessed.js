// Author: Nuno Aguiar, Andreia Brizida

/**
 * <odoc>
 * <key>nattrmon.nInput_FilesProcessed(aMap) : nInput</key>
 * aMap is composed of:\
 *    - attrName   (results to be presented, available options are: FilesProcessedByHour, FilesProcessedByDay, FilesInErrorByHour, FilesInErrorByDay, FilesProcessedMoreThanOnce, FilesBacklog)
 *    - chKeys     (the channel of keys to use)\
 *    - key        (the key for the database access)\
 *    - key.parent (in alternative provide the parent key (e.g. RAS))\
 *    - key.child  (in alternative provide the child key synonym (e.g. db.app))\
 *    - dontUseKey (boolean to indicate if a key field should not be added in all records returned with chKeys)
 *    - number     (number of days/hours ago the files were processed/errored out)
 * </odoc>
 */

var nInput_FilesProcessed = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }
	this.params.dontUseKey = _$(this.params.dontUseKey, "dontUseKey").isBoolean().default(isDef(this.params.key))

	
	if (isUnDef(this.params.attrName))
	{
		logErr("nInput_FilesProcessed | MAIN: You need to provide the attrName (Attribute Name).")
		return 0
	}

	this.var_yaml_file = nattrmon.getConfigPath("objects.assets/ninputfilesprocessed/") + "/objects.assets/ninputfilesprocessed/nInput_FilesProcessed_config.yml"
    
	try {
		this.attributeObject = io.readFileYAML(this.var_yaml_file);
	} catch (e) { 
		logErr("nInput_FilesProcessed | MAIN: Error reading configuration file from " + this.var_yaml_file + ".")
		throw e
	}

	if (isUnDef(this.attributeObject[this.params.attrName].name))
	{
		logErr("nInput_FilesProcessed | MAIN: Cannot find configuration for attrName " + this.params.attrName + ".")
		return 0
	}

	if (isUnDef(this.params.number))
	{
		this.params.number = 1
	}

	if (isUnDef(this.params.attrTemplate)) 
		if (isDef(this.params.key)) 
			this.params.attrTemplate = "RAID/" + this.attributeObject[this.params.attrName].name
		else
			this.params.attrTemplate = "RAID/DB {{key}}/"  + this.attributeObject[this.params.attrName].name

	nInput.call(this, this.input)
}
inherit(nInput_FilesProcessed, nInput)

nInput_FilesProcessed.prototype.get = function(aKey, parent, ret, scope) {
	var parent2 = parent
	try {
		var queries = this.attributeObject;
		queries = queries[parent.attrName];
	} catch (e) { 
		logErr("nInput_FilesProcessed | GET: Error reading configuration file from " + this.var_yaml_file + ".")
		throw e
	}

	try {
		var res

		// Determine the database name
		nattrmon.useObject(aKey, function(aDb) {	
			res = String(aDb.getConnect().getMetaData().getDatabaseProductName()).toLowerCase()
			return true
		})
		// Keep the sqls for the specific database type
		var nquery = queries[res]
		// Variables to be mapped on the queries
		var data = { number: parent.number}

		// If object poll association is provided
		if (isObject(parent.key) && isDef(parent.key.parent) && isDef(parent.key.child)) {
			// Retrieve association
			parent.objectPoolKey = nattrmon.getAssociatedObjectPool(parent.key.parent, parent.key.child)
		} else {
			// Keep current key
			parent.objectPoolKey = parent.key
		}
	
		try {
			var naAttr = templify(parent.attrTemplate, merge(parent, { query: nquery }))
			if (isDef(parent.objectPoolKey)) {
				if (nattrmon.isObjectPool(parent.objectPoolKey)) {
					nattrmon.useObject(parent.objectPoolKey, function(aDb) {
						try {
							if (isDef(aDb.convertDates)) aDb.convertDates(true)
							res = aDb.q(templify(nquery, data)).results
						} catch (e) {
							logErr("nInput_FilesProcessed | Error while retriving DB query from '" + parent.objectPoolKey + "' for '" + parent.objectPoolKey + ": " + e.message)
							logErr("nInput_FilesProcessed | Key = '" + parent.objectPoolKey + "' DB query = '" + nquery + "'")
							throw e
						}
						
						// Properly end transaction (issue #93)
						aDb.rollback()
						return true
					})
				} else {
					logWarn("nInput_FilesProcessed | Object pool key = '" + parent.objectPoolKey + "' not found.")
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
					if (keyFieldExists) logWarn("nInput_FilesProcessed | Result from '" + naAttr + "' for '" + parent.objectPoolKey + "' contains a 'key' field. It will be overwritten (to modify this behaviour use dontUseKey=true).")
					
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
				logErr("nInput_FilesProcessed | Problem trying to process query '" + nquery + "' for '" + parent.objectPoolKey + ": " + ee)
			}
			return 1
	} catch (e) {
		logErr("nInput_FilesProcessed | Error while retriving DB queries from '" + parent2.objectPoolKey + "': " + stringify(e))
		if (isUnDef(parent2.objectPoolKey)) {
			nattrmon.declareMonitoredObjectDirty(parent2.monitoredObjectKey)
			parent2.db = nattrmon.getMonitoredObject(parent2.monitoredObjectKey)
		}
	}
}

nInput_FilesProcessed.prototype.input = function(scope, args) {
	var ret = {}
	var parent = this

	ow.template.addHelper("toDate", (s) => { if (isDef(s) && s != null && new Date(s) != null) return "to_date('" + ow.format.fromDate(new Date(s), 'yyyyMMddHHmmss') + "', 'YYYYMMDDHH24MISS')"; else return null; })

	if (isDef(this.params.chKeys)) {
		var arr = []
		$ch(this.params.chKeys).forEach((k, v) => {
			var m = {
				key         : k.key,
				attrName    : parent.params.attrName,
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
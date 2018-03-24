/**
 * <odoc>
 * <key>nattrmon.nInput_Semaphores(aMap) : nInput</key>
 * You can create an input to check for BPM semaphores using a map composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}},{semNameOrDesc}},{{semName}},{{semDescription}})\
 * \
 * </odoc>
 */
var nInput_Semaphores = function(anMonitoredAFObjectKey, attributePrefix, dontIgnoreDuplicates) {
	if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
	}
	
	// Set server if doesn't exist
	// Is a monitored object or a pool?
	if (isObject(anMonitoredAFObjectKey)) {
		this.params = anMonitoredAFObjectKey;
		// If keys is not an array make it an array.
		if (!(isArray(this.params.keys))) this.params.keys = [ this.params.keys ];
	} else {
		if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
			this.objectPoolKey = anMonitoredAFObjectKey;
			this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
		} 
	}

	if (isDef(this.attributePrefix)) {
		this.params.attrTemplate = this.attributePrefix;
	}
        if (isUnDef(this.params.attrTemplate)) {        
		this.params.attrTemplate = "Semaphores {{key}}/SEM_{{semNameOrDesc}}";
	}

	nInput.call(this, this.input);	
};
inherit(nInput_Semaphores, nInput);

nInput_Semaphores.prototype.translate = function(aValue) {
	if (isUnDef(aValue)) return undefined;

	switch(aValue) {
	case "0": return "red";
	case "1": return "yellow";
	case "2": return "green";
	default: return undefined;
	}
};

nInput_Semaphores.prototype.getTemplate = function() {
	return this.params.attrTemplate;
};

nInput_Semaphores.prototype.__getSems = function(aKey, scope) {
	var retSems = {};
	var sems;

	try {
		if (isDef(aKey)) {
			nattrmon.useObject(aKey, function(s) {
				try {
					sems = s.exec("BPM.SemaphoreListToEdit", {});
					return true;
				} catch(e) {
					logErr("Error while retrieving Semaphores using '" + aKey + "': " + e.message);
					return false;
				}
			});
		} else {
			sems = this.server.exec("BPM.SemaphoreListToEdit", {});
		}

		if(!isUnDef(sems.entry_list)) {
			for(var i in sems.entry_list) {
				if (isDef(sems.entry_list[i].description) && 
					isDef(sems.entry_list[i].name) && 
					isDef(sems.entry_list[i].value)) {
					
					var semName = ((sems.entry_list[i].description.length > 0) ? sems.entry_list[i].description.replace(/\//g, "_") : sems.entry_list[i].name.replace(/\//g, "_"));

					// Can use now specific keys to avoid satellites
					/*
                    if(!this.dontIgnoreDuplicates) {
                    	if (isUndefined(nInput_Semaphores.findDuplicates[semName])) {
                       		nInput_Semaphores.findDuplicates[semName] = this.getPrefix();
                    	} else {
                    		if (nInput_Semaphores.findDuplicates[semName] != this.getPrefix()) continue;
                    	}
					}
					*/

                    semName = templify(this.getTemplate(), {
						"key": aKey,
						"semNameOrDesc": semName,
						"semName": sems.entry_list[i].name.replace(/\//g, "_"),
						"semDescription": sems.entry_list[i].description.replace(/\//g, "_")
					});

					// Add new
					if (!scope.getAttributes().exists(semName)) {
						scope.setAttribute(semName, semName + " semaphore", nAttribute.TYPE_SEMAPHORE);
					}
					retSems[semName] = this.translate(sems.entry_list[i].value);
				}
			}
		} else {
			retSems = {};
		}
	} catch(e) {
		logErr("Error while retrieving Semaphores using '" + aKey + "': " + e.message);
	}

	return retSems;
}

nInput_Semaphores.prototype.input = function(scope, args) {
	var res = {};

	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

	for(var i in this.params.keys) {
		res = merge(res, this.__getSems(this.params.keys[i], scope));
	}
	return res;
};
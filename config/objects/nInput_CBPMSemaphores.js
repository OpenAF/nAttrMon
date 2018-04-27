/**
 * <odoc>
 * <key>nattrmon.nInput_CBPMSemaphores(aMap) : nInput</key>
 * You can create an input to check for CBPM semaphores using a map composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}},{semNameOrDesc}},{{semName}},{{semDescription}})\
 * \
 * </odoc>
 */
var nInput_CBPMSemaphores = function(anMonitoredAFObjectKey, attributePrefix, dontIgnoreDuplicates) {
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
}
inherit(nInput_CBPMSemaphores, nInput);

nInput_CBPMSemaphores.prototype.translate = function(aValue) {
	if (isUndefined(aValue)) return undefined;

	switch(aValue) {
	case "0": return "red";
	case "1": return "yellow";
	case "2": return "green";
	default: return undefined;
	}
}

nInput_CBPMSemaphores.prototype.getTemplate = function() {
	return this.params.attrTemplate;
}

nInput_CBPMSemaphores.prototype.__getSems = function(aKey, scope) {
	var retSems = {};
	var sems;

	try {
		if (isDefined(aKey)) {
			nattrmon.useObject(aKey, function(s) {
				try {
					sems = { "entry_list": ow.obj.fromOrderedObj2Array(s.exec("CBPM.SemaphoreListAll", {}).entry_list) };
					return true;
				} catch(e) {
					logErr("Error while retrieving Semaphores using '" + aKey + "': " + e.message);
					return false;
				}
			});
		} else {
			sems = { "entry_list": ow.obj.fromOrderedObj2Array(this.server.exec("CBPM.SemaphoreListAll", {}).entry_list) };
		}

		if(isDef(sems) && isDef(sems.entry_list)) {
			for(var i in sems.entry_list) {
				if (isDefined(sems.entry_list[i].description) && 
					isDefined(sems.entry_list[i].name) && 
					isDefined(sems.entry_list[i].value)) {

					var semNameOrDesc = _.unescape(((sems.entry_list[i].description.length > 0) ? sems.entry_list[i].description.replace(/\//g, "_") : sems.entry_list[i].name.replace(/\//g, "_")));
					
					var attrName = templify(this.getTemplate(), { 
						"key": aKey,
						"semNameOrDesc": semNameOrDesc,
						"semName": _.unescape(sems.entry_list[i].name.replace(/\//g,"_")),
						"semDescription": sems.entry_list[i].description.replace(/\//g,"_")
					});

					// Add new attribute of type semaphore if it doesn't exist.
					if (!scope.getAttributes().exists(attrName)) {
						scope.setAttribute(attrName, semNameOrDesc, nAttribute.TYPE_SEMAPHORE);
					};
					retSems[attrName] = this.translate(sems.entry_list[i].value);
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

nInput_CBPMSemaphores.prototype.input = function(scope, args) {
	var res = {};

	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

	for(var i in this.params.keys) {
		res = merge(res, this.__getSems(this.params.keys[i], scope));
	}
	return res;
}


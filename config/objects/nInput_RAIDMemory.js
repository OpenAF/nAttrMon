/**
 * <odoc>
 * <key>nattrmon.nInput_RAIDMemory(aMap) : nInput</key>
 * aMap is composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a template for the name of the attribute)\
 *    - single (boolean when false display the corresponding key)\
 *    - extra (an array of extra map values to include from the chKeys channel values)\
 * \
 * </odoc>
 */
var nInput_RAIDMemory = function(anMonitoredAFObjectKey, attributePrefix) {
	if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
	}
	
	// Set server if doesn't exist
	if (isObject(anMonitoredAFObjectKey)) {
		this.params = anMonitoredAFObjectKey;
		// If keys is not an array make it an array.
		if (!(isArray(this.params.keys))) {
			this.params.keys = [ this.params.keys ];
			this.params.single = true;
		} else {
			this.params.single = false;
		}

		if (isUnDef(this.params.attrTemplate)) 
			this.params.attrTemplate = "Server status/Memory";
	
		if (isUnDef(this.params.extra)) this.params.extra = [];

	} else {
		if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
			this.params.keys = anMonitoredAFObjectKey;
			//this.objectPoolKey = anMonitoredAFObjectKey;
			//this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
		} 

		if (isDef(this.attributePrefix)) {
			this.params.attrTemplate = this.attributePrefix;
		} else {
			this.params.attrTemplate = "Server status/Memory";
		}
		//this.attributePrefix = (isUndefined(attributePrefix)) ? "Server status/Memory " : attributePrefix;
		this.params.extra = [];
	}

	nInput.call(this, this.input);
}
inherit(nInput_RAIDMemory, nInput);

nInput_RAIDMemory.prototype.__getMemory = function(aKey, aExtra) {
	var ret = {};
	var freemem  = -1;
	var usedmem  = -1;
	var maxmem   = -1;
	var totalmem = -1;

	try {
		var mems;
		var parent = this;
		if (isBoolean(parent.params.useCache) && parent.params.useCache) {
			var res = $cache("nattrmon::" + aKey).get({ op: "StatusReport", args: {} });
			if (isMap(res) && isDef(res.__error)) throw res.__error;
			mems = res.MemoryInfo;
		} else {
			nattrmon.useObject(aKey, function(s) {
				try {
					mems = s.exec("StatusReport", {}).MemoryInfo;
				} catch(e) {
					logErr("Error while retrieving memory using '" + aKey + "': " + e.message);
					throw e;
				}		
			});
		}

		freemem = Math.round(Number(mems.FreeHeapMemory.replace(/MB/,"")));
		usedmem = Math.round(Number(mems.UsedHeapMemory.replace(/MB/,"")));
		maxmem = Math.round(Number(mems.MaxMemory.replace(/MB/,"")));
		totalmem = Math.round(Number(mems.TotalHeapMemory.replace(/MB/,"")));
	} catch(e) {
		logErr("Error while retrieving memory using '" + aKey + "': " + e.message);
	}

	if(!this.params.single) {
		ret = {"Free heap (MB)": freemem, "Used heap (MB)": usedmem, "Total heap (MB)": totalmem, "Max memory (MB)": maxmem};
	} else {
		ret = {"Name": aKey, "Free heap (MB)": freemem, "Used heap (MB)": usedmem, "Total heap (MB)": totalmem, "Max memory (MB)": maxmem};
		ret = merge(ret, aExtra);
	}

	return ret;
}

nInput_RAIDMemory.prototype.input = function(scope, args) {
	var res = {};
	var arr = [];

	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray().sort();

	for(var i in this.params.keys) {
		var extra = {};
		if (isDef(this.params.chKeys)) {
			var value = $ch(this.params.chKeys).get({ key: this.params.keys[i] });
			if (isDef(value)) {
				for(var j in this.params.extra) {
					if (isDef(value[this.params.extra[j]])) extra[this.params.extra[j]] = value[this.params.extra[j]];
				}
			}
		}
		arr.push(this.__getMemory(this.params.keys[i], extra));
	}

	res[templify(this.params.attrTemplate)] = arr;
	return res;
}

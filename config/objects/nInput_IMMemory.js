var nInput_IMMemory = function(anMonitoredAFObjectKey, attributePrefix) {
	if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
	}
	
	// Set server if doesn't exist
	if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
		this.objectPoolKey = anMonitoredAFObjectKey;
		this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
	} else {
		this.monitoredObjectKey = anMonitoredAFObjectKey;
		if (nattrmon.hasMonitoredObject(anMonitoredAFObjectKey))
	  		this.server = nattrmon.getMonitoredObject(anMonitoredAFObjectKey);
		else
	  		throw "Key " + anMonitoredAFObjectKey + " not found.";
	}

	this.attributePrefix = (isUndefined(attributePrefix)) ? "Server status/IM Memory " : attributePrefix;

	nInput.call(this, this.input);
}
inherit(nInput_IMMemory, nInput);

nInput_IMMemory.prototype.input = function(scope, args) {
	var ret = {};
	var freemem  = -1;
	var usedmem  = -1;
	var maxmem   = -1;
	var totalmem = -1;

	try {
		var mems;
		var parent = this;
		if (isDefined(this.objectPoolKey)) {
			nattrmon.useObject(this.objectPoolKey, function(s) {
				try {
					mems = s.exec("IM.Status", {}).Status.Memory;
				} catch(e) {
					logErr("Error while retrieving memory using '" + parent.monitoredObjectKey + "': " + e.message);
					throw e;
				}
				return true;
			})
		} else {
			mems = this.server.exec("IM.Status", {}).Status.Memory;
		}
		
		freemem = Math.round(Number(mems.FreeMB));
		usedmem = Math.round(Number(mems.AllocatedMB));
		maxmem = Math.round(Number(mems.MaximumMB));
		totalmem = Math.round(Number(mems.TotalMB));
	} catch(e) {
		logErr("Error while retrieving memory using '" + this.monitoredObjectKey + "': " + e.message);
		if (isUndefined(this.objectPoolKey)) {
			nattrmon.declareMonitoredObjectDirty(this.monitoredObjectKey);
			this.server = nattrmon.getMonitoredObject(this.monitoredObjectKey);
		}
	}

	ret[this.attributePrefix] = {"Free heap (MB)": freemem, "Allocated heap (MB)": usedmem, "Total heap (MB)": totalmem, "Max memory (MB)": maxmem};

	return ret;
}
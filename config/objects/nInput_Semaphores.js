/**
 * <odoc>
 * <key>nattrmon.nInput_Semaphores(anMonitoredAFObjectKey, attributePrefix, dontIgnoreDuplicates)</key>
 * You can create an input to check for BPM semaphores using the anMonitoredAFObjectKey. Optionally you can provide also an attributePrefix
 * and a dontIgnoreDuplicates flag to indicate that duplicate semaphores names should not be ignore (usually true to avoid satellites duplicated
 * semaphores).
 * </odoc>
 */
var nInput_Semaphores = function(anMonitoredAFObjectKey, attributePrefix, dontIgnoreDuplicates) {
	// Set server if doesn't exist
	// Is a monitored object or a pool?
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
	this.attributePrefix = (isUndefined(attributePrefix)) ? "Semaphores/SEM_" : attributePrefix;
	this.dontIgnoreDuplicates = dontIgnoreDuplicates;
	this.semsList = {};

	nInput.call(this, this.input);
}
inherit(nInput_Semaphores, nInput);
nInput_Semaphores.findDuplicates = {};

nInput_Semaphores.prototype.translate = function(aValue) {
	if (isUndefined(aValue)) return undefined;

	switch(aValue) {
	case "0": return "red";
	case "1": return "yellow";
	case "2": return "green";
	default: return undefined;
	}
}

nInput_Semaphores.prototype.getPrefix = function() {
	return this.attributePrefix;
}

nInput_Semaphores.prototype.input = function(scope, args) {
	try {
		var sems;

		if (isDefined(this.objectPoolKey)) {
			nattrmon.useObject(this.objectPoolKey, function(s) {
				try {
					sems = s.exec("BPM.SemaphoreListToEdit", {});
					return true;
				} catch(e) {
					logErr("Error while retrieving Semaphores using '" + this.monitoredObjectKey + "': " + e.message);
					return false;
				}
			});
		} else {
			sems = this.server.exec("BPM.SemaphoreListToEdit", {});
		}

		if(!isUndefined(sems.entry_list)) {
			for(var i in sems.entry_list) {
				if (isDefined(sems.entry_list[i].description) && isDefined(sems.entry_list[i].name) && isDefined(sems.entry_list[i].value)) {
					var semName = ((sems.entry_list[i].description.length > 0) ? sems.entry_list[i].description : sems.entry_list[i].name);
                    if(!this.dontIgnoreDuplicates) {
                    	if (isUndefined(nInput_Semaphores.findDuplicates[semName])) {
                       		nInput_Semaphores.findDuplicates[semName] = this.getPrefix();
                    	} else {
                    		if (nInput_Semaphores.findDuplicates[semName] != this.getPrefix()) continue;
                    	}
                    }

                    semName = this.getPrefix() + semName;
					// Add new
					if (!scope.getAttributes().exists(semName)) {
						scope.setAttribute(semName, semName + " semaphore", nAttribute.TYPE_SEMAPHORE);
					};
					this.semsList[semName] = this.translate(sems.entry_list[i].value);
				}
			}
		}
	} catch(e) {
		logErr("Error while retrieving Semaphores using '" + this.monitoredObjectKey + "': " + e.message);
		if (isUndefined(this.objectPoolKey)) {
			nattrmon.declareMonitoredObjectDirty(this.monitoredObjectKey);
			this.server = nattrmon.getMonitoredObject(this.monitoredObjectKey);
		}
	}

	return this.semsList;
}

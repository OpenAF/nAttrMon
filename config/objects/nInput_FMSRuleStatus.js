var nInput_FMSRulesStatus = function(anMonitoredAFObjectKey, attributePrefix) {
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

	this.attributePrefix = (isUndefined(attributePrefix)) ? "Fraud/Fraud rules status" : attributePrefix;

	nInput.call(this, this.input);
}
inherit(nInput_FMSRulesStatus, nInput);

nInput_FMSRulesStatus.prototype.input = function(scope, args) {
	// Decode function
	function decode(aStatus) {
		switch(aStatus) {
		case 0: return "Inactive";
		case 1: return "Active";
		case 2: return "Inactive by anti-flooding";
		}
	}

	function getResults(s) {
		var enginesList = s.exec("FRAUD.GetEngineList", {"EnginePhase": 1}).EngineList;
		enginesList = enginesList.concat(s.exec("FRAUD.GetEngineList", {"EnginePhase": 2}).EngineList);

		// Go through all rules in all engines and get their status
		res = $from(enginesList).select(function(engine) {
			var rules = s.exec("FRAUD.GetEngineRulesInfo", { "EngineId": engine.EngineId }).EngineRulesInfoList;

			return $from(rules).select(function(rule) {
				return {
					"EngineId"  : engine.EngineId,
					"EngineName": engine.EngineName,
					"RuleId"    : rule.RuleId,
					"Rule"      : rule.Name,
					"Status"    : decode(rule.Active)
				}
			});
		});
		res = _.flatten(res);
		return res;
	}

	var ret = {};

	try {
		var res;
		var parent = this;
		if (isDefined(this.objectPoolKey)) {
			nattrmon.useObject(this.objectPoolKey, function(s) {
				try {
					res = getResults(s);
				} catch(e) {
					logErr("Error while retrieving engines list and rules info using '" + parent.monitoredObjectKey + "': " + e.message);
					throw e;
				}
				return true;
			})
		} else {
			res = getResults(this.server);
		}
	} catch(e) {
		logErr("Error while retrieving memory using '" + this.monitoredObjectKey + "': " + e.message);
		if (isUndefined(this.objectPoolKey)) {
			nattrmon.declareMonitoredObjectDirty(this.monitoredObjectKey);
			this.server = nattrmon.getMonitoredObject(this.monitoredObjectKey);
		}
	}

	ret[this.attributePrefix] = {
		"Active"                   : $from(res).equals("Status", "Active").count(),
		"Inactive"                 : $from(res).equals("Status", "Inactive").count(),
		"Inactive by anti-flooding": $from(res).equals("Status", "Inactive by anti-flooding").count()
	}

	ret[this.attributePrefix + " detailed"] = $from(res).equals("Status", "Inactive by anti-flooding").select({
		"EngineName": "",
		"Rule": "",
		"Status": ""
	});

	return ret;
}
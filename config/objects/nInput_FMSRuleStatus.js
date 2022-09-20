var nInput_FMSRuleStatus = function(aMap, attributePrefix) {
	if (isUnDef(getOPackPath("OpenCli"))) {
		throw "OpenCli opack not installed."
	}

    if (isMap(aMap)) {
        this.params = aMap
        // If keys is not an array make it an array.
        if (!(isArray(this.params.keys))) {
            this.params.keys = [this.params.keys]
        }

        if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = (isUnDef(attributePrefix)) ? "Fraud/Fraud rules status" : attributePrefix
    }

	nInput.call(this, this.input)
}
inherit(nInput_FMSRuleStatus, nInput)

nInput_FMSRuleStatus.prototype.input = function(scope, args) {
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
		var _res = $from(enginesList).select(function(engine) {
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
		_res = _.flatten(_res);
		return _res;
	}

	var res = {}, arrSimple = [], arrDetailed = []


	if (isDef(this.params.chKeys)) this.params.keys = $from($ch(this.params.chKeys).getKeys()).sort("key").select(r => r.key)

    for (var i in this.params.keys) {
        var extra = {}
        if (isDef(this.params.chKeys)) {
            var value = $ch(this.params.chKeys).get({ key: this.params.keys[i] })
            if (isDef(value)) {
                for (var j in this.params.extra) {
                    if (isDef(value[this.params.extra[j]])) extra[this.params.extra[j]] = value[this.params.extra[j]]
                }
            }
        }

		var ret
		nattrmon.useObject(this.params.keys[i], function(s) {
			try {
				ret = getResults(s)
			} catch(e) {
				logErr("Error while retrieving engines list and rules info using '" + this.params.keys[i] + "': " + e.message)
				throw e
			}
		})

		var retSimple = {
			"Key"                      : this.params.keys[i],
			"Active"                   : $from(ret).equals("Status", "Active").count(),
			"Inactive"                 : $from(ret).equals("Status", "Inactive").count(),
			"Inactive by anti-flooding": $from(ret).equals("Status", "Inactive by anti-flooding").count()
		}
	
		var retDetailed = $from(ret)
		                  .equals("Status", "Inactive by anti-flooding")
						  .attach("Key", this.params.keys[i])
						  .select({
			"Key"       : "",
			"EngineName": "",
			"Rule"      : "",
			"Status"    : ""
		})
		
        arrSimple   = arrSimple.concat(retSimple)
		arrDetailed = arrDetailed.concat(retDetailed)
    }

    res[templify(this.params.attrTemplate)]               = arrSimple
	res[templify(this.params.attrTemplate) + " detailed"] = arrDetailed

	return res
}
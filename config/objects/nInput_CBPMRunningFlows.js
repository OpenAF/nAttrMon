/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_CBPMRunningFlows(aMap)</key>
 * You can create an input to get a list of running flows by running status using a map compose of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - status (a string of the status that should be filtered ('ERROR', 'STARTED'))\
 *    - hoursToCheck (a number of days to flow instances to consider from the flow start time)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}})\
 *    - limit (the limit of records to retrieve from the server)\
 * \
 * </odoc>
 */
var nInput_CBPMRunningFlows = function(aMap) {
    if (isUnDef(aMap)) aMap = {};

    // If keys is not an array make it an array.
    if (isUnDef(aMap.keys) && isUnDef(aMap.chKeys)) {
        var e = "nInput_CBPMRunningFlows: You need to provide keys or chKeys";
        logErr(e);
        throw e;
    }

    this.keys = aMap.keys;
    this.chKeys = aMap.chKeys;
    this.limit = aMap.limit;

    if (!(isArray(aMap.keys))) aMap.keys = [ aMap.keys ];

	if (isUnDef(aMap.attrTemplate)) {        
		aMap.attrTemplate = "Server status/{{key}} flows";
	}

    this.attrTemplate = aMap.attrTemplate;
    this.status = (isUnDef(aMap.status)) ? 'STARTED' : aMap.status;
    this.hoursToCheck = (isUnDef(aMap.hoursToCheck)) ? 24 : aMap.hoursToCheck;

    ow.loadWAF();

	nInput.call(this, this.input);
};
inherit(nInput_CBPMRunningFlows, nInput);

nInput_CBPMRunningFlows.prototype.input = function(scope, args) {
	var res = {};
	var parent = this;
	
	if (isDef(this.chKeys)) this.keys = $stream($ch(this.chKeys).getKeys()).map("key").toArray();

	for (var i in this.keys) {
		var arr = [];
        var aKey = this.keys[i];
    
        nattrmon.useObject(aKey, (aAF) => {
            var listOfFlows = ow.waf.cbpm.listFlows(aAF);

            $from(listOfFlows).select((r) => {
                var instances = ow.waf.cbpm.getFlowInstancesByName(aAF, r.flowName, [ this.status.toUpperCase() ], this.limit, true, true);

                if (isDef(instances) && isArray(instances)) {          
                    $from(instances).select((t) => {
                        if (ow.format.dateDiff.inHours(ow.format.fromWeDoDateToDate(t.instanceStartTime)) <= this.hoursToCheck) {
                            arr.push({
                                Category: r.flowCategory,
                                Flow: r.flowName,
                                Version: t.instanceVersion,
                                "Run ID": t.instanceId,
                                User: t.instanceStartUser,
                                "Date": ow.format.fromWeDoDateToDate(t.instanceStartTime),
                                Exception: t.instanceErrorMessage
                            });
                        }
                    });
                }
            });
        });

        res[templify(this.attrTemplate, {
            key: aKey
        })] = arr;
	}

	return res;
};

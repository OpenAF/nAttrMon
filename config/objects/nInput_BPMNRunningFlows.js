/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_BPMNRunningFlows(aMap)</key>
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
var nInput_BPMNRunningFlows = function(aMap) {
    if (isUnDef(aMap)) aMap = {};

    // If keys is not an array make it an array.
    if (isUnDef(aMap.keys) && isUnDef(aMap.chKeys)) {
        var e = "nInput_BPMNRunningFlows: You need to provide keys or chKeys";
        logErr(e);
        throw e;
    }

    this.keys = aMap.keys;
    this.chKeys = aMap.chKeys;
    this.limit = (isUnDef(aMap.limit)) ? 24 : aMap.limit;
    if (this.limit <= 0) this.limit = void 0;

    if (!(isArray(aMap.keys))) aMap.keys = [ aMap.keys ];

	if (isUnDef(aMap.attrTemplate)) {        
		aMap.attrTemplate = "Server status/{{key}} BPMN flows";
	}

    this.attrTemplate = aMap.attrTemplate;
    this.status = (isUnDef(aMap.status)) ? 'STARTED' : aMap.status;
    this.hoursToCheck = (isUnDef(aMap.hoursToCheck)) ? 24 : aMap.hoursToCheck;
    //this.useDatabase = aMap.useDatabase;

    ow.loadWAF();

	nInput.call(this, this.input);
};
inherit(nInput_BPMNRunningFlows, nInput);

nInput_BPMNRunningFlows.prototype.input = function(scope, args) {
	var res = {};
	var parent = this;
	
	if (isDef(this.chKeys)) this.keys = $stream($ch(this.chKeys).getKeys()).map("key").toArray();

	for (var i in this.keys) {
		var arr = [];
        var aKey = this.keys[i];
        
        var listOfFlows;
        nattrmon.useObject(aKey, (aAF) => {
            listOfFlows = ow.waf.bpmn.listFlows(aAF);
        });

        //if (this.useDatabase) {
            // TODO
        //} else {
            //$from(listOfFlows).select((r) => {
            arr = _.flatten(parallel4Array(listOfFlows, (r) => {
                var oo = [];
                var instances;
    
                nattrmon.useObject(aKey, (aAF) => {
                    try {
                        instances = ow.waf.bpmn.getFlowInstances(aAF, r.flowUUID, [ this.status.toUpperCase() ], this.limit, false, false);
                    } catch(e) {
                        // Check if it never executed
                        if (!String(e).match(/Cannot find the object/)) logErr("Can't retrieve instances, in " + aKey + ", for flow: " + r.flowName + " -- " + String(e));
                    }
                });
    
                if (isDef(instances) && isArray(instances)) {          
                    $from(instances).select((t) => {
                        if (ow.format.dateDiff.inHours(ow.format.fromWeDoDateToDate(t.instanceStartTime)) <= this.hoursToCheck) {
                            oo.push({
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
    
                return oo;
    
            //});
            }));    
        //}

        res[templify(this.attrTemplate, {
            key: aKey
        })] = $from(arr).sort("-Date").select();
	}

	return res;
};

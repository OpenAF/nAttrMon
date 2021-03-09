/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_BPMDebugChecks(aMap)</key>
 * You can create an input to get a list of db and app debug level for all CBPM flows using a map compose of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - include (array of uuids and names to include)\
 *    - exclude (array of uuids and names to exclude)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}})\
 * \
 * </odoc>
 */
var nInput_BPMDebugChecks = function(aMap) {
    if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
    }
     
    aMap = _$(aMap).default({});

    // If keys is not an array make it an array.
    if (isUnDef(aMap.keys) && isUnDef(aMap.chKeys)) {
        var e = "nInput_BPMDebugChecks: You need to provide keys or chKeys";
        logErr(e);
        throw e;
    }

    this.keys = aMap.keys;
    this.chKeys = aMap.chKeys;

    if (!(isArray(aMap.keys))) aMap.keys = [ aMap.keys ];

    aMap.attrTemplate = _$(aMap.attrTemplate).default("Server status/{{key}} flow debug flags");
    this.attrTemplate = aMap.attrTemplate;

    this.includes = _$(aMap.includes).isArray().default(void 0);
    this.excludes = _$(aMap.excludes).isArray().default(void 0);

    ow.loadWAF();
    plugin("XML");

	nInput.call(this, this.input);
};
inherit(nInput_BPMDebugChecks, nInput);

nInput_BPMDebugChecks.prototype.decodeLevel = function(aLevel, isDatabase) {
    switch(Number(aLevel)) {
    case 1 : return "Nothing";
    case 2 : return "Flow status";
    case 3 : return "Flow & task status";
    case 4 : return "Only flow";
    case 5 : return "Only flow + task status";
    case 6 : return "Full";
    default: return "Default value (" + (isDatabase ? "Full" : "Nothing") + ")";
    }
};

nInput_BPMDebugChecks.prototype.input = function(scope, args) {
	var res = {};
	var parent = this;
	
	if (isDef(this.chKeys)) this.keys = $stream($ch(this.chKeys).getKeys()).map("key").toArray();

	for (var i in this.keys) {
		var arr = [];
        var aKey = this.keys[i];
        
        var listOfFlows;
        nattrmon.useObject(aKey, (aAF) => {
            listOfFlows = ow.waf.bpm.listFlows(aAF);
        });

        arr = _.compact(parallel4Array(listOfFlows, (r) => {
            var oo = null, doIt = true;

            if (isDef(parent.includes) && 
                (parent.includes.indexOf(r.flowObjId) <  0 || parent.includes.indexOf(r.flowName) <  0)) doIt = false;
            if (isDef(parent.excludes) && 
                (parent.excludes.indexOf(r.flowObjId) >= 0 || parent.excludes.indexOf(r.flowName) >= 0)) doIt = false;

            if (doIt) {
                nattrmon.useObject(aKey, (aAF) => {
                    try {
                        if (aAF.isLifeRay()) {
                            logErr("nInput_BPMDebugChecks: Can't retrieve with a liferay connection. Please replace with an appserver/xdt connection.");
                            throw("nInput_BPMDebugChecks: Can't retrieve with a liferay connection. Please replace with an appserver/xdt connection.");
                        } else {
                            var flowdef = aAF.exec2Raw("BPM.GetFlowDef", { flow_id: r.flowObjId });
                            
                            var xml = new XML(String(flowdef.getAsString("flow_definition")));
                            var x = xml.toNativeXML();
                            var levels = af.fromParameterMap(x.engine.toXMLString());
                            var traceexecution = x.toXMLString().match(/traceexecution\=\"true\"/mg);
                            
                            oo = {
                                Name       : r.flowName,
                                dbLevel    : Number(levels.DatabaseTraceLevel != null ? levels.DatabaseTraceLevel : 0),
                                memLevel   : Number(levels.MemoryTraceLevel != null ? levels.MemoryTraceLevel   : 0),
                                "DB Level" : parent.decodeLevel(levels.DatabaseTraceLevel, true),
                                "Mem Level": parent.decodeLevel(levels.MemoryTraceLevel, false),
                                "# trace executions": ((traceexecution !== null && traceexecution.length > 0) ? traceexecution.length : 0)
                            };
                        }             
                    } catch(e) {
                        oo = { 
                            Name       : r.flowName, 
                            dbLevel    : 0, 
                            memLevel   : 0,
                            "DB Level" : "n/a",
                            "Mem Level": "n/a",
                            "# trace executions": 0
                        };
                    }
                });
            };

            return oo;
    
        }, __NAM_WORKERS));    

        res[templify(this.attrTemplate, {
            key: aKey
        })] = $from(arr).sort("Name").select();
	};

	return res;
};

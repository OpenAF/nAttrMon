/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_CBPMDebugChecks(aMap)</key>
 * You can create an input to get a list of db and app debug level for all CBPM flows using a map compose of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - include (array of uuids and names to include)\
 *    - exclude (array of uuids and names to exclude)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}})\
 * \
 * </odoc>
 */
var nInput_CBPMDebugChecks = function(aMap) {
    if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
    }
     
    aMap = _$(aMap).default({});

    // If keys is not an array make it an array.
    if (isUnDef(aMap.keys) && isUnDef(aMap.chKeys)) {
        var e = "nInput_CBPMDebugChecks: You need to provide keys or chKeys";
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
inherit(nInput_CBPMDebugChecks, nInput);

nInput_CBPMDebugChecks.prototype.decodeLevel = function(aLevel, isDatabase) {
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

nInput_CBPMDebugChecks.prototype.input = function(scope, args) {
	var res = {};
	var parent = this;
	
	if (isDef(this.chKeys)) this.keys = $stream($ch(this.chKeys).getKeys()).map("key").toArray();

	for (var i in this.keys) {
		var arr = [];
        var aKey = this.keys[i];
        
        var listOfFlows;
        nattrmon.useObject(aKey, (aAF) => {
            listOfFlows = ow.waf.cbpm.listFlows(aAF);
        });

        arr = _.compact(parallel4Array(listOfFlows, (r) => {
            var oo = null, doIt = true;

            if (isDef(parent.includes) && 
                (parent.includes.indexOf(r.flowUUID) <  0 || parent.includes.indexOf(r.flowName) <  0)) doIt = false;
            if (isDef(parent.excludes) && 
                (parent.excludes.indexOf(r.flowUUID) >= 0 || parent.excludes.indexOf(r.flowName) >= 0)) doIt = false;

            if (doIt) {
                nattrmon.useObject(aKey, (aAF) => {
                    try {
                        var x = (new XML(ow.waf.objects.getObjectByUUID(aAF, r.flowUUID).definition.FlowDefinition)).toNativeXML();
                        oo = {
                            Name       : r.flowName,
                            dbLevel    : Number(x.flow.engine.parameter.(@name=="DatabaseTraceLevel").toString()),
                            memLevel   : Number(x.flow.engine.parameter.(@name=="MemoryTraceLevel").toString()),
                            "DB Level" : String(parent.decodeLevel(x.flow.engine.parameter.(@name=="DatabaseTraceLevel").toString(), true)),
                            "Mem Level": String(parent.decodeLevel(x.flow.engine.parameter.(@name=="MemoryTraceLevel").toString(), false))
                        };                   
                    } catch(e) {
                        oo = { 
                            Name       : r.flowName, 
                            dbLevel    : 0, 
                            memLevel   : 0,
                            "DB Level" : "n/a",
                            "Mem Level": "n/a"
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

/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_CBPMRunningFlows(aMap)</key>
 * You can create an input to get a list of running flows by running status using a map compose of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - status (an optional string/array of the status that should be filtered ('ERROR', 'STARTED'))\
 *    - hoursToCheck (a number of days to flow instances to consider from the flow start time)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}})\
 *    - limit (the limit of records to retrieve from the server)\
 *    - excludeLongAgo (boolean to exclude longAgo (default: true))\
 * \
 * </odoc>
 */
var nInput_CBPMRunningFlows = function (aMap) {
    if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
    }

    if (isUnDef(aMap)) aMap = {};

    // If keys is not an array make it an array.
    if (isUnDef(aMap.keys) && isUnDef(aMap.chKeys)) {
        var e = "nInput_CBPMRunningFlows: You need to provide keys or chKeys";
        logErr(e);
        throw e;
    }

    this.keys = aMap.keys;
    this.chKeys = aMap.chKeys;
    this.limit = (isUnDef(aMap.limit)) ? 24 : aMap.limit;
    if (this.limit <= 0) this.limit = void 0;

    if (!(isArray(aMap.keys))) aMap.keys = [aMap.keys];

    if (isUnDef(aMap.attrTemplate)) {
        aMap.attrTemplate = "Server status/{{key}} flows";
    }

    this.attrTemplate = aMap.attrTemplate;
    this.status = (isUnDef(aMap.status)) ? __ : aMap.status;
    this.hoursToCheck = (isUnDef(aMap.hoursToCheck)) ? 24 : aMap.hoursToCheck;
    //this.useDatabase = aMap.useDatabase;
    this.excludeLongAgo = _$(aMap.excludeLongAgo, "excludeLongAgo").isBoolean().default(false);

    ow.loadWAF();

    nInput.call(this, this.input);
};
inherit(nInput_CBPMRunningFlows, nInput);

nInput_CBPMRunningFlows.prototype.input = function (scope, args) {
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

        //if (this.useDatabase) {
        // TODO
        //} else {
        //$from(listOfFlows).select((r) => {
        arr = _.flatten(parallel4Array(listOfFlows, (r) => {
            var oo = [];
            var instances;

            nattrmon.useObject(aKey, (aAF) => {
                try {
                    if (isString(parent.status)) {
                        instances = ow.waf.cbpm.getFlowInstances(aAF, r.flowUUID, [parent.status.toUpperCase()], parent.limit, false, false);
                    } else {
                        instances = ow.waf.cbpm.getFlowInstances(aAF, r.flowUUID, isArray(parent.status) ? parent.status.map(r => r.toUpperCase()) : __, parent.limit, false, false);
                    }
                } catch (e) {
                    // Check if it never executed
                    if (!String(e).match(/Cannot find the object/)) logErr("Can't retrieve instances, in " + aKey + ", for flow: " + r.flowName + " -- " + String(e));
                }
            });

            if (isDef(instances) && isArray(instances)) {
                $from(instances).select((t) => {
                    if (ow.format.dateDiff.inHours(ow.format.fromWeDoDateToDate(t.instanceStartTime)) <= parent.hoursToCheck) {
                        var line = {
                            Name: aKey,
                            Category: r.flowCategory,
                            Flow: r.flowName,
                            Version: t.instanceVersion,
                            "Run ID": t.instanceId,
                            User: t.instanceStartUser,
                            Status: t.instanceStatus,
                            "Start Date": ow.format.fromWeDoDateToDate(t.instanceStartTime)
                        };

                        switch (t.instanceStatus) {
                            case 'ERROR':
                                line = merge(line, { "End Date": (isUnDef(t.instanceEndTime)) ? "n/a" : ow.format.fromWeDoDateToDate(t.instanceEndTime), "Exception": (isUnDef(t.instanceErrorMessage)) ? "n/a" : t.instanceErrorMessage });
                                break;
                            case 'STARTED':
                                if (!parent.excludeLongAgo) line = merge(line, { "Started how long ago(min)": ow.format.dateDiff.inMinutes(ow.format.fromWeDoDateToDate(t.instanceStartTime), new Date()) });
                                break;
                            default:
                                if (isDef((t.instanceEndTime))) {
                                    line = merge(line, { "End Date": ow.format.fromWeDoDateToDate(t.instanceEndTime) });
                                }
                        }
                        oo.push(line);
                    }
                });
            }
            return oo;

            //});
        }, __NAM_WORKERS));
        //}

        res[templify(this.attrTemplate, {
            key: aKey
        })] = $from(arr).sort("-Date").select();
    }

    return res;
};

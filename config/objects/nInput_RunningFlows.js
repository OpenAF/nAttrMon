/*

Values for running status:
	"-1": "Flow stopped",
	 "0": "Terminated",
	 "1": "Created",
	 "2": "Running",
	 "3": "In error",
	 "4": "Finished",
	 "5": "Discarded",
	 "6": "Suspended"

 */
/**
 * <odoc>
 * <key>nattrmon.nInput_RunningFlows(aMap)</key>
 * You can create an input to get a list of running flows by running status using a map compose of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template for the name of the attribute using {{key}})\
 * \
 * </odoc>
 */
var nInput_RunningFlows = function(anMonitoredAFObjectKey, attributePrefix, anRunningStatus) {
	if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
	}
	
	if (isObject(anMonitoredAFObjectKey)) {
		this.params = anMonitoredAFObjectKey;

		// If keys is not an array make it an array.
		if (isUnDef(this.params.keys) && isUnDef(this.params.chKeys)) {
			var e = "nInput_RunningFlows: You need to provide keys or chKeys";
			logErr(e);
			throw e;
		}
        if (!(isArray(this.params.keys))) this.params.keys = [ this.params.keys ];
	} else {
		if (isDef(attributePrefix)) {
			this.params.attrTemplate = attributePrefix + " {{key}}";
		}
		if (isDef(anRunningStatus)) {
			this.params.runningStatus = anRunningStatus;
		}
	}

	if (isUnDef(this.params.attrTemplate)) {        
		this.params.attrTemplate = "Server status/{{key}} flows";
	}

	this.runningstatus = (isUnDef(this.params.runningStatus)) ? 2 : this.params.runningStatus;
	this.semsList = {};

	nInput.call(this, this.input);
};
inherit(nInput_RunningFlows, nInput);

/**
 * Given aKey return the available list of flow categories.
 * 
 */
nInput_RunningFlows.prototype.getCategories = function(aKey) {
	var bpmFlowList;
    //if (isUnDef(this.bpmFlowCtgs)) {
    	if (isDef(aKey)) {
			nattrmon.useObject(aKey, function(s) {
				try {
					bpmFlowList = s.exec("BPM.FlowList", {});
				} catch(e) {
					logErr("Error while retrieving flow list using '" + parent.monitoredObjectKey + "': " + e.message);
					throw e;
				}
				return true;
			});
		}
		
 	    var tempFlowCtgs = {};

		for(var i in bpmFlowList.category_list) {
			tempFlowCtgs[bpmFlowList.category_list[i].id] = bpmFlowList.category_list[i].name;
   		}

 		this.bpmFlowCtgs = tempFlowCtgs;
 		return this.bpmFlowCtgs;
    //    } else {
	//	return this.bpmFlowCtgs;
    //}
};

nInput_RunningFlows.prototype.convertRAIDDates = function(aRAIDDate) {
	return new Date(aRAIDDate.substr(7,4), Number(aRAIDDate.substr(4,2)) -1, aRAIDDate.substr(1,2), aRAIDDate.substr(12,2), aRAIDDate.substr(15,2), aRAIDDate.substr(18,2));
};

nInput_RunningFlows.prototype.input = function(scope, args) {
	var res = {};
	var parent = this;
	
	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

	for (var i in this.params.keys) {
		var arr = [];
		var aKey = this.params.keys[i];

		try {
			// Get flow categories
			var flowCtgs = this.getCategories(aKey);

			// For each flow category iterate to find status
			for(var j in flowCtgs) {
				var pm;
				if (isDef(aKey)) {
					var parent = this;
					nattrmon.useObject(aKey, function(s) {
						try {
							pm = s.exec2Raw("BPM.TreeFlowExecutionNames", {"category_id": Number(j), "flow_status": parent.runningstatus}, "post");
						} catch(e) {
							logErr("Error while retrieving flow executions using '" + parent.monitoredObjectKey + "': " + e.message);
							throw e;
						}
						return true;
					});
				}

				if (pm != null && pm.getInt("result") < 1) {
					try {
						var xml = new XMLList(pm.getAsString("payload"));
						for(var ii in xml.item) {
							var xml2;
							if (isDef(aKey)) {
								var parent = this;
								nattrmon.useObject(aKey, function(s) {
									try {										
										xml2 = new XMLList(s.exec2Raw("BPM.TreeFlowsExecutions", {"category_id": Number(j), "flow_status": parent.runningstatus, "flow_name": xml.item[ii].label.toString()}).getAsString("payload"));

										var line = (xml2.item[0].tip+"").replace(/[^=]+=([^;]+)/g, "$1|").split(/\|/);
										var map2 = { "version": line[0], "runId": line[1].replace(/,/g, ""), "user": line[2], "date": line[3] };
										if (parent.runningstatus == 3) {
											// Try app if fails try adm
											var dbKey = nattrmon.getAssociatedObjectPool(aKey, "db.app");
											if (isUnDef(dbKey)) dbKey = nattrmon.getAssociatedObjectPool(aKey, "db.adm");

											var admres;
											nattrmon.useObject(dbKey, function(db) {
												admres = db.q("select exception from bpm_c_running_flows where flow_run_id = " + map2.runId).results;
											});
											if (isUnDef(admres)) {
												var e = "Couldn't retrieve info from database '" + dbKey + "' for server '" + aKey + "'";
												logErr(e);
												throw e;
											}
											arr.push({ "Category": flowCtgs[j], "Flow": xml.item[ii].label.toString(), "Version": map2.version, "Run ID": map2.runId, "User": map2.user, "Date": parent.convertRAIDDates(map2.date), "Exception": admres[0].EXCEPTION});
										} else {
											arr.push({ "Category": flowCtgs[j], "Flow": xml.item[ii].label.toString(), "Version": map2.version, "Run ID": map2.runId, "User": map2.user, "Date": parent.convertRAIDDates(map2.date)});
										}
									} catch(e) {
										logErr("Error while retrieving flow executions using '" + parent.monitoredObjectKey + "': " + e.message);
										throw e;
									}
									return true;
								});
							}
						}
					} catch(e) {
						logErr(e.message);
					}
				}
			}
		} catch(e) {
			logErr("Error while retriving flows using '" + aKey + "': " + e.message);
		}

		// Order output by date
		var today = new Date();
		var aWeekAgo = new Date(today.setDate(today.getDate() - 7));

		res[templify(this.params.attrTemplate, { key: aKey})] = [];
		for(var i in arr.sort(function(a,b) { return b.Date - a.Date; } )) {
			// If older than a week, ignore
			if (arr[i].Date < aWeekAgo) continue;
			res[templify(this.params.attrTemplate, { 
				key: aKey
			})].push(arr[i]);
		}				
	}

	return res;
};

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

var nInput_RunningFlows = function(anMonitoredAFObjectKey, attributePrefix, anRunningStatus) {
	// Set server if doesn't exist
	if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
		this.objectPoolKey = anMonitoredAFObjectKey;
		this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
		var parent = this;
		nattrmon.useObject(this.objectPoolKey, function(s) { parent.admdb = getRAIDDB(s, 'Adm'); });
	} else {
		this.monitoredObjectKey = anMonitoredAFObjectKey;
		if (nattrmon.hasMonitoredObject(anMonitoredAFObjectKey)) {
	  		this.server = nattrmon.getMonitoredObject(anMonitoredAFObjectKey);
   			this.admdb = getRAIDDB(this.server, 'Adm');
   		} else {
	  		throw "Key " + anMonitoredAFObjectKey + " not found.";
   		}
	}

	var parent = this;


	this.attributePrefix = (isUndefined(attributePrefix)) ? "Flows/Flows " : attributePrefix;
	this.runningstatus = (isUndefined(anRunningStatus)) ? 2 : anRunningStatus;
	this.semsList = {};

	nInput.call(this, this.input);
}
inherit(nInput_RunningFlows, nInput);

nInput_RunningFlows.prototype.getPrefix = function() {
	return this.attributePrefix;
}

nInput_RunningFlows.prototype.getCategories = function() {
	var bpmFlowList;
    if (isUndefined(this.bpmFlowCtgs)) {
    	if (isDefined(this.objectPoolKey)) {
			nattrmon.useObject(this.objectPoolKey, function(s) {
				try {
					bpmFlowList = s.exec("BPM.FlowList", {});
				} catch(e) {
					logErr("Error while retrieving flow list using '" + parent.monitoredObjectKey + "': " + e.message);
					throw e;
				}
				return true;
			})
		} else {
			bpmFlowList = this.server.exec("BPM.FlowList", {});
		}
		
 	    var tempFlowCtgs = {};

		for(var i in bpmFlowList.category_list) {
			tempFlowCtgs[bpmFlowList.category_list[i].id] = bpmFlowList.category_list[i].name;
   		}

 		this.bpmFlowCtgs = tempFlowCtgs;
 		return this.bpmFlowCtgs;
        } else {
		return this.bpmFlowCtgs;
    }
}

nInput_RunningFlows.prototype.convertRAIDDates = function(aRAIDDate) {
	return new Date(aRAIDDate.substr(7,4), Number(aRAIDDate.substr(4,2)) -1, aRAIDDate.substr(1,2), aRAIDDate.substr(12,2), aRAIDDate.substr(15,2), aRAIDDate.substr(18,2));
}

nInput_RunningFlows.prototype.input = function(scope, args) {
        var res = [];
        var parent = this;
		try {
	        var flowCtgs = this.getCategories();

			for(var j in flowCtgs) {
				var pm;
				if (isDefined(this.objectPoolKey)) {
					nattrmon.useObject(this.objectPoolKey, function(s) {
						try {
							pm = s.exec2Raw("BPM.TreeFlowExecutionNames", {"category_id": Number(j), "flow_status": parent.runningstatus}, "post");
						} catch(e) {
							logErr("Error while retrieving flow executions using '" + parent.monitoredObjectKey + "': " + e.message);
							throw e;
						}
						return true;
					})
				} else {
					pm = this.server.exec2Raw("BPM.TreeFlowExecutionNames", {"category_id": Number(j), "flow_status": this.runningstatus}, "post");
				}
				if (pm.getInt("result") < 1) {
					try {
						var xml = new XMLList(pm.getAsString("payload"));
						for(var ii in xml.item) {
							var xml2;
							if (isDefined(this.objectPoolKey)) {
								nattrmon.useObject(this.objectPoolKey, function(s) {
									try {
										xml2 = new XMLList(s.exec2Raw("BPM.TreeFlowsExecutions", {"category_id": Number(j), "flow_status": parent.runningstatus, "flow_name": xml.item[ii].label.toString()}).getAsString("payload"));
									} catch(e) {
										logErr("Error while retrieving flow executions using '" + parent.monitoredObjectKey + "': " + e.message);
										throw e;
									}
									return true;
								})
							} else {
								xml2 = new XMLList(this.server.exec2Raw("BPM.TreeFlowsExecutions", {"category_id": Number(j), "flow_status": this.runningstatus, "flow_name": xml.item[ii].label.toString()}).getAsString("payload"));
							}
							var line = (xml2.item[0].tip+"").replace(/[^=]+=([^;]+)/g, "$1|").split(/\|/);
							var map2 = { "version": line[0], "runId": line[1].replace(/,/g, ""), "user": line[2], "date": line[3] };
							if (this.runningstatus == 3) {
								var admres = this.admdb.q("select exception from bpm_c_running_flows where flow_run_id = " + map2.runId).results;
								admres[0].EXCEPTION
								res.push({ "Category": flowCtgs[j], "Flow": xml.item[ii].label.toString(), "Version": map2.version, "Run ID": map2.runId, "User": map2.user, "Date": this.convertRAIDDates(map2.date), "Exception": admres[0].EXCEPTION});
				  			} else {
								res.push({ "Category": flowCtgs[j], "Flow": xml.item[ii].label.toString(), "Version": map2.version, "Run ID": map2.runId, "User": map2.user, "Date": this.convertRAIDDates(map2.date)});
							}
						}
					} catch(e) {
						logErr(e.message);
					}
	 			}
	        }
		} catch(e) {
			logErr("Error while retriving flows using '" + this.monitoredObjectKey + "': " + e.message);
			try { this.admdb.close(); } catch(e) {}
			if (isUndefined(this.objectPoolKey)) {
				nattrmon.declareMonitoredObjectDirty(this.monitoredObjectKey);
				this.server = nattrmon.getMonitoredObject(this.monitoredObjectKey);
			}
            this.admdb = getRAIDDB(this.server, 'Adm');
		}

		var finalRes = {};
		finalRes[this.attributePrefix] = [];

		// Order output by date
		var today = new Date();
		var aWeekAgo = new Date(today.setDate(today.getDate() - 7));
		for(var i in res.sort(function(a,b) { return b.Date - a.Date; } )) {
			// If older than a week, ignore
			if (res[i].Date < aWeekAgo) continue;
			finalRes[this.attributePrefix][i] = res[i];
		}

	return finalRes;
}

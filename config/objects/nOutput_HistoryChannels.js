var nOutput_HistoryChannels = function(aMap) {
	var aDatabaseFile = isDef(aMap.db) ? templify(aMap.db) : void 0;
	var aRollData = isDef(aMap.rollData) ? aMap.rollData : void 0;

	this.chAttributes = _$(aMap.chAttributes).isString().default("nattrmon::history::attributes");
	this.chAttributesValues = _$(aMap.chAttributes).isString().default("nattrmon::history::attributesValues");
	this.chAttributesHistory = _$(aMap.chAttributes).isString().default("nattrmon::history::attributesHistory");

	this.chAttributesType = _$(aMap.chAttributesType).isString().default("mvs");
	this.chAttributesValuesType = _$(aMap.chAttributesType).isString().default("mvs");
	this.chAttributesHistoryType = _$(aMap.chAttributesType).isString().default("mvs");

	this.chAttributesTypeArgs = _$(aMap.chAttributesTypeArgs).isMap().default({ 
		file: (new java.io.File(nattrmon.getConfigPath())).getAbsolutePath() + "/nattrmon.hist.db",
		compact: true,
		map: "attributes"
	});
	this.chAttributesValuesTypeArgs = _$(aMap.chAttributesTypeArgs).isMap().default({ 
		file: (new java.io.File(nattrmon.getConfigPath())).getAbsolutePath() + "/nattrmon.hist.db",
		compact: true,
		map: "attributesValues"
	});
	this.chAttributesHistoryTypeArgs = _$(aMap.chAttributesTypeArgs).isMap().default({ 
		file: (new java.io.File(nattrmon.getConfigPath())).getAbsolutePath() + "/nattrmon.hist.db",
		compact: true,
		map: "attributesHistory"
	});

	$ch(this.chAttributes).create(1, this.chAttributesType, this.chAttributesTypeArgs);
	$ch(this.chAttributesValues).create(1, this.chAttributesValuesType, this.chAttributesValuesTypeArgs);
	$ch(this.chAttributesHistory).create(1, this.chAttributesHistoryType, this.chAttributesHistoryTypeArgs);

	this.rdata = (isUnDef(aRollData)) ? 172800 : Number(aRollData);
	this.firstTime = {};

	this.partitionMax = _$(aMap.partitionMax).isNumber().default(1024);

	nattrmon.setSessionData("attribute.history", this);
	nOutput.call(this, this.output);
};
inherit(nOutput_HistoryChannels, nOutput);

/**
 * [rolldata description]
 * @param  {[type]} aDB [description]
 * @return {[type]}     [description]
 */
nOutput_HistoryChannels.prototype.rolldata = function(rdata) {
	//aDB.us("delete ATTRIBUTE_VALUES where date_checked < dateadd('second', ?, now()) limit 10000", [- rdata ]);
	//aDB.us("delete ATTRIBUTES where last_seen < dateadd('second', ?, now()) limit 1000", [- rdata ]);
	//aDB.commit();
};

nOutput_HistoryChannels.prototype.getValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var vkey;
	try {
		$ch(this.chAttributes).get({ name: anAttributeName });
	} catch(e) {};

	var res = [];
	if (isDef(vkey)) {
		var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();

		var maxPart = vkey.partitions;
		var dmod = new Date();
		var dnow = dmod;

		do {
			var dates = $ch(this.chAttributesHistory).get({ name: anAttributeName, partition: maxPart }).dates.sort();
			
			for(var ii = dates.length -1; ii >= 0 && (dnow - dmod) < howManySecondsAgo; ii--) {
				var rec = $ch(this.chAttributesValues).get({ name: anAttributeName, date: dates[ii] });
				dmod = rec.rec.dateModified;
				res.push({
					val: rec.val,
					type: type,
					date: rec.dateModified
				});
			}
			maxPart--;
		} while(maxPart > 1 && (dnow - dmod) < howManySecondsAgo);
	}

	return res;
};

nOutput_HistoryChannels.prototype.getValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var res = [];

	var vkey;
	try {
		vkey = $ch(this.chAttributes).get({ name: anAttributeName });
	} catch(e) {};

	if (isDef(vkey)) {
		var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();

		var maxPart = vkey.partitions;

		do {
			var dates = $ch(this.chAttributesHistory).get({ name: anAttributeName, partition: maxPart }).dates.sort();
			for(var ii = dates.length -1; ii >= 0 && res.length < howManyEventsAgo; ii--) {
				var rec = $ch(this.chAttributesValues).get({ name: anAttributeName, date: dates[ii] });
				res.push({
					val: rec.val,
					type: type,
					date: rec.dateModified
				});
			}
			maxPart--;
		} while(maxPart > 1 && res.length < howManyEventsAgo);
	}

	return res;
};

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_HistoryChannels.prototype.output = function(scope, args) {
	//var db = this.connect();

	try {
		// Create if doesn't exist
		var parent = this;
		
		sync(function() {

			// Set attributes
			// --------------

			// create if doesn't exist
			var vkey;
			try {
				vkey = $ch(parent.chAttributes).get({ name: args.k.name });
			} catch(e) { }

			var attr = nattrmon.getAttributes().getAttributeByName(args.k.name);
			$ch(parent.chAttributes).set({
				name: args.k.name
			}, {
				name: args.k.name,
				description: attr.description,
				lastCheck: attr.lastcheck,
				partitions: (isUnDef(vkey) ? 1 : vkey.partitions)
			});

			if (isUnDef(vkey)) {
				vkey = {
					name: args.k.name,
					description: attr.description,
					lastCheck: attr.lastcheck,
					partitions: 1
				};
			}

			var attrval = scope.getCurrentValues(true).get({ name: args.k.name });
			var lastval = nattrmon.getLastValues(true).get({ name: args.k.name });

			if (isDef(attrval) && isDef(attrval.date)) {
				if (isUnDef(parent.firstTime[args.k.name]) || (args.onlyOnEvent && parent.see(args.k.name, attrval))) {
					var dmod = attrval.date;
					var dchk = attr.lastcheck;

					if (isDef(dchk)) {
						if (isDef(attrval.val)) {
							// Set attributes history
							// ----------------------

							// create if doesn't exist
							var vval;
							try {
								vval = $ch(parent.chAttributesHistory).get({ name: vkey.name, partition: vkey.partitions });
							} catch(e) { }
							
							if (isDef(vval)) {
								if (vval.dates.length > parent.partitionMax) {
									// If too many dates per partition, create a new one
									vkey.partitions += 1;
									$ch(parent.chAttributes).set({ name: vkey.name }, {
										name: args.k.name,
										description: attr.description,
										lastCheck: dchk,
										partitions: vkey.partitions
									});
									$ch(parent.chAttributesHistory).set({ name: vkey.name, partition: vkey.partitions }, {
										name: vkey.name,
										partition: vkey.partitions,
										dates: [
											dmod
										]
									});
								} else {
									vval.dates.push(dmod);
									// or just add to the existing one
									$ch(parent.chAttributesHistory).set({ name: vkey.name, partition: vkey.partitions }, {
										name: vkey.name,
										partition: vkey.partitions,
										dates: vval.dates
									});
								}
							} else {
								// create it if new
								$ch(parent.chAttributesHistory).set({ name: vkey.name, partition: vkey.partitions }, {
									name: vkey.name,
									partition: vkey.partitions,
									dates: [
										dmod
									]
								});
							}

							$ch(parent.chAttributesValues).set({ name: vkey.name, date: dmod }, {
								name: vkey.name,
								date: dmod,
								val: attrval.val,
								dateModified: dmod,
								dateChecked: attr.lastcheck
							});
						}
					}
				}
			}

			parent.rolldata(parent.rdata);
		}, this);
	} catch (e) {
		logErr("Error while updating history channels: " + stringify(e) + " - " + ((isUnDef(e.javaException)) ? "" : e.javaException.printStackTrace()));
	}
};

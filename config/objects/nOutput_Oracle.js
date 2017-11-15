var nOutput_Oracle = function(anMonitoredAFObjectKey, tableNames, attrToInclude, aRollData) {
	if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
		this.objectPoolKey = anMonitoredAFObjectKey;
		this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
	} else {
		this.monitoredObjectKey = anMonitoredAFObjectKey;
		if (nattrmon.hasMonitoredObject(anMonitoredAFObjectKey))
			this.db = nattrmon.getMonitoredObject(anMonitoredAFObjectKey);
		else
			throw "Key " + anMonitoredAFObjectKey + " not found.";
	}
	this.rdata = (isUndefined(aRollData)) ? 172800 : Number(aRollData);
	this.firstTime = {};
	this.attrToInclude = attrToInclude;
	this.tablesNames = (isUndefined(tableNames)) ? {
		"attribute": "ATTRIBUTES",
		"values"   : "ATTRIBUTES_VALUES"
	} : tableNames;

	nattrmon.setSessionData("attribute.history", this);
	nOutput.call(this, this.output);
}
inherit(nOutput_Oracle, nOutput);

/**
 * [rolldata description]
 * @param  {[type]} aDB [description]
 * @return {[type]}     [description]
 */
nOutput_Oracle.prototype.rolldata = function(aDB, rdata) {
	// TODO
	aDB.us("delete " + this.tablesNames.values + " where date_checked < (sysdate - (?/24/60/60))", [ rdata ]);
	aDB.us("delete " + this.tablesNames.attribute + " where last_seen < (sysdate - (?/24/60/60))", [ rdata ]);
	aDB.commit();
}

/**
 * [getValuesByTime description]
 * @param  {[type]} anAttributeName   [description]
 * @param  {[type]} howManySecondsAgo [description]
 * @return {[type]}                   [description]
 */
nOutput_Oracle.prototype.getValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var ret = [];
	var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();
	var db;
	if (isDefined(this.objectPoolKey)) {
		db = nattrmon.leaseObject(this.monitoredObjectKey);
	} else {
		db = this.db;
	}

	try {
		// TODO
		var vals  = db.q("select distinct val, to_date(date_modified, 'YYYY-MM-DD HH24:MI:SS') date_modified from " + this.tablesNames.values + " where name = '" + anAttributeName + "' and date_checked >= (sysdate - (" + howManySecondsAgo + "/24/60/60)) order by date_checked desc").results;

		for(i in vals) {
			ret.push({
				"val"         : JSON.parse(vals[i].VAL),
				"type"        : type,
				"date"        : ow.format.toDate(vals[i].DATE_MODIFIED, 'yyyy-MM-dd hh:mm:ss')
			});
		}
		if (isDefined(this.objectPoolKey)) nattrmon.returnObject(this.monitoredObjectKey, db, true);
	} catch(e) {
		logErr("Error while getValuesByTime: " + e.message);
		if (isDefined(this.objectPoolKey)) nattrmon.returnObject(this.monitoredObjectKey, db, false);
	}
	return ret;
}

/**
 * [getValuesByEvents description]
 * @param  {[type]} anAttributeName  [description]
 * @param  {[type]} howManyEventsAgo [description]
 * @return {[type]}                  [description]
 */
nOutput_Oracle.prototype.getValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var ret = [];
	var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();
	var db;
	if (isDefined(this.objectPoolKey)) {
		db = nattrmon.leaseObject(this.monitoredObjectKey);
	} else {
		db = this.db;
	}

	try {
		// TODO
		var vals  = db.qs("select val, to_date(date_modified, 'YYYY-MM-DD HH24:MI:SS') date_modified \
		                   from " + this.tablesNames.values + " where name = ? and rownum < ? \
		                   order by date_modified desc", [anAttributeName, howManyEventsAgo], true).results;
	
		for(i in vals) {
			ret.push({
				"val"         : JSON.parse(vals[i].VAL),
				"type"        : type,
				"date"        : ow.format.toDate(vals[i].DATE_MODIFIED, 'yyyy-MM-dd hh:mm:ss')
			});
		}

		if (isDefined(this.objectPoolKey)) nattrmon.returnObject(this.monitoredObjectKey, db, true);
	} catch(e) {
		logErr("Error while getValuesByEvents: " + e.message);
		if (isDefined(this.objectPoolKey)) nattrmon.returnObject(this.monitoredObjectKey, db, false);
	}
	return ret;
}

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_Oracle.prototype.output = function(scope, args) {
	var db;
	if (isDefined(this.objectPoolKey)) {
		db = nattrmon.leaseObject(this.monitoredObjectKey);
	} else {
		db = this.db;
	}

	try {
		// Create if doesn't exist
		var parent = this;
		scope.thread.sync(function() {
			// TODO
			try {
				var res = db.qs("select table_name from tabs where table_name in (?, ?)", 
					[ parent.tablesNames.attribute.toUpperCase(), parent.tablesNames.values.toUpperCase()], true).results;
				if (res.length != 2) {
					log("Creating Oracle tables.");
					if ($from(res).equals("TABLE_NAME", parent.tablesNames.attribute.toUpperCase()).none()) 
						db.u("create table " + parent.tablesNames.attribute + " (name varchar2(255) primary key, description varchar2(4000), last_seen date)");
					if ($from(res).equals("TABLE_NAME", parent.tablesNames.values.toUpperCase()).none()) {
						db.u("create table " + parent.tablesNames.values + " (name varchar2(255), val clob, date_modified date, date_checked date)");
						db.u("create index IDX_" + parent.tablesNames.values + " on " + parent.tablesNames.values + " (NAME, DATE_MODIFIED, DATE_CHECKED)");
					}
				}
			} catch(e) {
				logErr(e);
			}

			// Get attributes
			//var resNames = db.q("select name from attributes").results;

			for(attrid in scope.getAttributes().attributes) {
				if ( (isDefined(parent.attrToInclude) && (parent.attrToInclude.indexOf(attrid) >= 0) ||
				     (isUndefined(parent.attrToInclude)) ) ) {
					var attr = scope.getAttributes().attributes[attrid];
					var dchk = (isUndefined(attr.lastcheck)) ? null : ow.format.fromDate(new Date(af.js2s(attr.lastcheck).replace(/"/g, "")), 'yyyy-MM-dd HH:mm:ss');
					try {
					db.us("merge into " + parent.tablesNames.attribute + " s using (select ? name, ? description, to_date(?, 'YYYY-MM-DD HH24:MI:SS') last_seen from dual) d\
					       on (s.name = d.name)\
					       when matched then update set s.description = ?, s.last_seen = to_date(?, 'YYYY-MM-DD HH24:MI:SS') \
						   when not matched then insert (name, description, last_seen) values (?, ?, to_date(?, 'YYYY-MM-DD HH24:MI:SS'))", 
						[ String(attr.name), String(attr.description), String(dchk), 
						  String(attr.description), String(dchk),
						  String(attr.name), String(attr.description), String(dchk) ], true);
					} catch(e) {
						logErr(stringify(e));
					}

				}
			}

			for(attrid in scope.getCurrentValues()) {
				if ( (isDefined(parent.attrToInclude) && (parent.attrToInclude.indexOf(attrid) >= 0) ||
				     (isUndefined(parent.attrToInclude)) ) ) {
					var attrval = scope.getCurrentValues()[attrid];
					var lastval = scope.getLastValues()[attrid];

					//if (isUndefined(parent.firstTime[attrid]) || !(args.onlyOnEvent && isDefined(lastval.val) && compare(attrval.val, lastval.val))) {
					if (isUndefined(parent.firstTime[attrid]) || (args.onlyOnEvent && parent.see(attrid, attrval))) {
						var dmod = af.js2s(attrval.date).replace(/"/g, "");
						var dchk = af.js2s(scope.getAttributes().attributes[attrid].lastcheck).replace(/"/g, "");
						var val = (isDefined(attrval.val)) ? stringify(attrval.val) : "";
						db.us("insert into " + parent.tablesNames.values + " (name, val, date_modified, date_checked)\
						       values (?, ?, to_date(?, 'YYYY-MM-DD HH24:MI:SS'), to_date(?, 'YYYY-MM-DD HH24:MI:SS'))",
							[ attrid, val, ow.format.fromDate(new Date(dmod), 'yyyy-MM-dd HH:mm:ss'), ow.format.fromDate(new Date(dchk), 'yyyy-MM-dd HH:mm:ss') ], true);
						parent.firstTime[attrid] = 1;
					}
				}
			}
			db.commit();

			parent.rolldata(db, parent.rdata);
		});

		if (isDefined(this.objectPoolKey)) nattrmon.returnObject(this.monitoredObjectKey, db, true);
	} catch (e) {
		logErr("Error while updating Oracle: " + e.message + " - " + ((isUndefined(e.javaException)) ? "" : e.javaException.printStackTrace()));
		if(isDefined(db)) {
			try {
				db.rollback();
				if (isUndefined(this.objectPoolKey)) {
					db.close();
					nattrmon.declareMonitoredObjectDirty(this.monitoredObjectKey);
					this.db = nattrmon.getMonitoredObject(this.monitoredObjectKey);
				} else {
					nattrmon.returnObject(this.monitoredObjectKey, db, false);
				}
			} catch(e) { logErr("exception closing: " + e.message); }
		}
	}

}

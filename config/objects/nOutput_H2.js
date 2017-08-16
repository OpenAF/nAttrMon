/**
 * [nOutput_H2 description]
 * @param  {[type]} aDatabaseFile [description]
 * @param  {[type]} aPort         [description]
 * @param  {[type]} aRollData     [description]
 * @return {[type]}               [description]
 */
var nOutput_H2 = function(aDatabaseFile, aPort, aRollData) {
	this.databasefile = ow.format.string.separatorsToUnix((isUndefined(aDatabaseFile)) ? (new java.io.File(nattrmon.getConfigPath())).getAbsolutePath() + "/nattrmon.db" : aDatabaseFile);
	this.rdata = (isUndefined(aRollData)) ? 172800 : Number(aRollData);
	this.port = (isUndefined(aPort)) ? 19090 : Number(aPort);

	if (!nattrmon.hasMonitoredObject("h2")) {
		this.connect();
	}

	this.firstTime = {};

	nattrmon.setSessionData("attribute.history", this);
	nOutput.call(this, this.output);
}
inherit(nOutput_H2, nOutput);

/**
 * [connect description]
 * @param  {[type]} force [description]
 * @return {[type]}       [description]
 */
nOutput_H2.prototype.connect = function(force) {
	if (force) {
		nattrmon.declareMonitoredObjectDirty("h2");
		return nattrmon.getMonitoredObject("h2");
	}

	if (!nattrmon.hasMonitoredObject("h2")) {
		var databasefile = this.databasefile;
		var port = this.port;
		nattrmon.addMonitoredObject("h2",
			function() {
				try {
					af.rm(databasefile + ".lock.db");
				} catch(e) {
				}
				return new DB("org.h2.Driver", "jdbc:h2:" + databasefile + ";MVCC=TRUE;auto_server=true;auto_server_port=" + port, "nattrmon", "nattrmon");
			}
		);
	}

	return nattrmon.getMonitoredObject("h2");
}

/**
 * [rolldata description]
 * @param  {[type]} aDB [description]
 * @return {[type]}     [description]
 */
nOutput_H2.prototype.rolldata = function(aDB, rdata) {
	aDB.us("delete ATTRIBUTE_VALUES where date_checked < dateadd('second', ?, now()) limit 10000", [- rdata ]);
	aDB.us("delete ATTRIBUTES where last_seen < dateadd('second', ?, now()) limit 1000", [- rdata ]);
	aDB.commit();
}

/**
 * [getValuesByTime description]
 * @param  {[type]} anAttributeName   [description]
 * @param  {[type]} howManySecondsAgo [description]
 * @return {[type]}                   [description]
 */
nOutput_H2.prototype.getValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var db = this.connect();
	//var db = new DB("org.h2.Driver", "jdbc:h2:" + this.databasefile, "nattrmon", "nattrmon");
	var ret = [];
	var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();

	try {
		var vals  = db.qs("select val, formatdatetime(date_modified, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''') date_modified\
		                   from attribute_values where name = ? and\
		                   date_checked >= dateadd('second', - ?, now())\
		                   order by date_checked desc", [anAttributeName, howManySecondsAgo ], true).results;

		for(i in vals) {
			ret.push({
				"val"         : JSON.parse(vals[i].VAL),
				"type"        : type,
				"date"        : vals[i].DATE_MODIFIED
			});
		}
	} catch(e) {
		logErr("Error while getValuesByTime: " + e.message);
	}
	return ret;
}

/**
 * [getValuesByEvents description]
 * @param  {[type]} anAttributeName  [description]
 * @param  {[type]} howManyEventsAgo [description]
 * @return {[type]}                  [description]
 */
nOutput_H2.prototype.getValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var db = this.connect();
	//var db = new DB("org.h2.Driver", "jdbc:h2:" + this.databasefile, "nattrmon", "nattrmon");
	var ret = [];
	var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();

	try {
		var vals  = db.qs("select distinct val, formatdatetime(date_modified, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''') date_modified\
		                   from attribute_values where name = ? \
		                   order by date_modified desc limit ? ", [ anAttributeName, howManyEventsAgo], true).results;
		//var vals  = db.q("select distinct val, formatdatetime(date_modified, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z''') date_modified from (select val, date_modified from attribute_values where name = '" + anAttributeName + "' order by date_checked desc) where rownum <= " + howManyEventsAgo).results;

		for(i in vals) {
			ret.push({
				"val"         : JSON.parse(vals[i].VAL),
				"type"        : type,
				"date"        : vals[i].DATE_MODIFIED
			});
		}
	} catch(e) {
		logErr("Error while getValuesByEvents: " + e.message);
	}
	return ret;
}

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_H2.prototype.output = function(scope, args) {
	var db = this.connect();
	//var db = new DB("org.h2.Driver", "jdbc:h2:" + this.databasefile + ";auto_server=true;auto_server_port=" + this.port, "nattrmon", "nattrmon");
	//var db = new DB("org.h2.Driver", "jdbc:h2:" + this.databasefile, "nattrmon", "nattrmon");

	try {
		// Create if doesn't exist
		var parent = this;
		scope.thread.sync(function() {
			db.u("create table if not exists attributes(name varchar(255) primary key, description varchar(4000), last_seen datetime)");
			db.u("create table if not exists attribute_values(name varchar(255), val clob, date_modified datetime, date_checked datetime)");
			db.u("create index if not exists IDX_ATTRIBUTE_VALUES on ATTRIBUTE_VALUES (NAME, DATE_MODIFIED, DATE_CHECKED)");

			// Get attributes
			var resNames = db.q("select name from attributes").results;

			var arrAttr = scope.getAttributes(true);
			for(var i in arrAttr) {
				var attr = arrAttr[i];
				if (resNames.indexOf(attr.name) < 0) {
					var dchk = (isUndefined(attr.lastcheck)) ? null : stringify(attr.lastcheck).replace(/"/g, "");
					db.us("merge into attributes (name, description, last_seen) key(name) values(?, ?, parsedatetime(?, 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\'','en','GMT'))", [ attr.name, attr.description, dchk ]);
					// " + attr.name + "', '" + attr.description + "', parsedatetime('" + dchk + "', 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\''))");
				}
			}

			for(attrid in scope.getCurrentValues()) {
				var attrval = scope.getCurrentValues()[attrid];
				var lastval = scope.getLastValues()[attrid];

				if (isDef(attrval) && isDef(attrval.date)) {
					if (isUndefined(parent.firstTime[attrid]) || (args.onlyOnEvent && parent.see(attrid, attrval))) {
						var dmod = stringify(attrval.date).replace(/"/g, "");
						var dchk = scope.getAttributes().getAttributeByName(attrid);
						if (isDef(dchk)) {
							var dchk = (isDef(dchk.lastcheck) ? stringify(dchk.lastcheck).replace(/"/g, "") : "");
							var val = stringify(attrval.val);
							if (isDefined(val))
								db.us("insert into attribute_values (name, val, date_modified, date_checked) values (?, ?, parsedatetime(?, 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\'','en','GMT'), parsedatetime(?, 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\'','en','GMT'))", [ attrid, val, dmod, dchk ]);
							parent.firstTime[attrid] = 1;
						}
					}
				}
			}
			db.commit();

			parent.rolldata(db, parent.rdata);
		});
	} catch (e) {
		logErr("Error while updating H2: " + stringify(e) + " - " + ((isUndefined(e.javaException)) ? "" : e.javaException.printStackTrace()));
		if(!isUndefined(db)) {
			try {
				db.rollback();
				db.close();
			} catch(e) { logErr("exception closing: " + e.message); }
		}
		this.connect(true);
	}

	//db.close();
}

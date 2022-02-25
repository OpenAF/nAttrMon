/**
 * [nOutput_H2 description]
 */
var nOutput_H2 = function(aMap) {
	var aDatabaseFile = isDef(aMap.db) ? templify(aMap.db) : void 0;
	var aRollData = isDef(aMap.rollData) ? aMap.rollData : void 0;
	var aPort = isDef(aMap.port) ? aMap.port : void 0;
	var aUser = isDef(aMap.user) ? aMap.user : "nattrmon";
	var aPass = isDef(aMap.pass) ? aMap.pass : "nattrmon";

	this.databasefile = ow.format.string.separatorsToUnix((isUnDef(aDatabaseFile)) ? (new java.io.File(nattrmon.getConfigPath())).getAbsolutePath() + "/nattrmon.db" : aDatabaseFile);
	this.rdata = (isUnDef(aRollData)) ? 172800 : Number(aRollData);
	this.port = (isUnDef(aPort)) ? 19090 : Number(aPort);
	this.user = aUser;
	this.pass = aPass;

	if (!nattrmon.hasMonitoredObject("h2")) {
		this.connect();
	}

	this.firstTime = {};

	nattrmon.setSessionData("attribute.history", this);
	nOutput.call(this, this.output);
};
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
		var parent = this;
		nattrmon.addMonitoredObject("h2",
			function() {
				try {
					io.rm(databasefile + ".lock.db");
					log("Output_H2 | Connecting to " + databasefile);
					return new DB("org.h2.Driver", "jdbc:h2:" + databasefile + ";auto_server=true;auto_server_port=" + port, parent.user, parent.pass);
				} catch(e) {
					logErr("H2 | " + stringify(e));
					throw e;
				}
			}
		);
	}

	return nattrmon.getMonitoredObject("h2");
};

/**
 * [rolldata description]
 * @param  {[type]} aDB [description]
 * @return {[type]}     [description]
 */
nOutput_H2.prototype.rolldata = function(aDB, rdata) {
	aDB.us("delete ATTRIBUTE_VALUES where date_checked < dateadd('second', ?, now()) limit 10000", [- rdata ]);
	aDB.us("delete ATTRIBUTES where last_seen < dateadd('second', ?, now()) limit 1000", [- rdata ]);
	aDB.commit();
};

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

		for(var i in vals) {
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
};

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

		for(var i in vals) {
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
};

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_H2.prototype.output = function(scope, args) {
	var db = this.connect();

	try {
		// Create if doesn't exist
		var parent = this;
		sync(function() {
			db.u("create table if not exists ATTRIBUTES(name varchar(255) primary key, description varchar(4000), last_seen datetime)");
			db.u("create table if not exists ATTRIBUTE_VALUES(name varchar(255), val clob, date_modified datetime, date_checked datetime)");
			db.u("create index if not exists IDX_ATTRIBUTE_VALUES on ATTRIBUTE_VALUES (NAME, DATE_MODIFIED, DATE_CHECKED)");

			// Get attributes
			//var resNames = db.q("select name from attributes").results;

			//var arrAttr = scope.getAttributes(true);
			//for(var i in arrAttr) {
				//var attr = arrAttr[i];
				var attr = nattrmon.getAttributes().getAttributeByName(args.k.name);
				if (isUnDef(attr)) return;
				//if (resNames.indexOf(attr.name) < 0) {
					var dchk = (isUnDef(attr.lastcheck)) ? null : stringify(attr.lastcheck).replace(/"/g, "");
					db.us("merge into attributes (name, description, last_seen) key(name) values(?, ?, parsedatetime(?, 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\'','en','GMT'))", [ String(attr.name), String(attr.description), dchk ]);
				//}
			//}

			//for(var args.k.name in scope.getCurrentValues()) {
				var attrval = scope.getCurrentValues(true).get({ name: args.k.name });
				var lastval = nattrmon.getLastValues(true).get({ name: args.k.name });

				if (isDef(attrval) && isDef(attrval.date)) {
					if (isUnDef(parent.firstTime[args.k.name]) || (args.onlyOnEvent && parent.see(args.k.name, attrval))) {
						var dmod = stringify(attrval.date).replace(/"/g, "");

						if (isDef(dchk)) {
							//var dchk = (isDef(dchk.lastcheck) ? stringify(dchk.lastcheck).replace(/"/g, "") : null);
							var val = stringify(attrval.val);
							if (isDef(val))
								db.us("insert into attribute_values (name, val, date_modified, date_checked) values (?, ?, parsedatetime(?, 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\'','en','GMT'), parsedatetime(?, 'yyyy-MM-dd\'\'T\'\'HH:mm:ss.SSS\'\'Z\'\'','en','GMT'))", [ String(args.k.name), String(val), dmod, dchk ]);
							parent.firstTime[args.k.name] = 1;
						}
					}
				}
			//}
			db.commit();

			parent.rolldata(db, parent.rdata);
		}, this);
	} catch (e) {
		logErr("Error while updating H2: " + stringify(e) + " - " + ((isUnDef(e.javaException)) ? "" : e.javaException.printStackTrace()));
		if(!isUnDef(db)) {
			try {
				db.rollback();
				db.close();
			} catch(e) { logErr("exception closing: " + e.message); }
		}
		this.connect(true);
	}
};

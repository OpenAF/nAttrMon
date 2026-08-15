/**
 * [nOutput_PostgreSQL description]
 */
var nOutput_PostgreSQL = function(aMap) {
	aMap = isMap(aMap) ? aMap : {};

	this.host     = isDef(aMap.host) ? templify(aMap.host) : "localhost";
	this.port     = isDef(aMap.port) ? Number(aMap.port) : 5432;
	this.database = isDef(aMap.database) ? templify(aMap.database) : "nattrmon";
	this.user     = isDef(aMap.user) ? aMap.user : "nattrmon";
	this.pass     = isDef(aMap.pass) ? aMap.pass : "nattrmon";
	this.options  = isDef(aMap.options) ? aMap.options : "";
	this.rdata    = isUnDef(aMap.rollData) ? 172800 : Number(aMap.rollData);
	this.source   = isDef(aMap.source) ? aMap.source : "postgresql";
	this.poolKey  = isDef(aMap.poolKey) ? aMap.poolKey : this.source;

	this.jdbcUrl = "jdbc:postgresql://" + this.host + ":" + this.port + "/" + this.database +
	               (this.options.length > 0 ? "?" + this.options : "");

	if (!nattrmon.hasMonitoredObject(this.poolKey)) {
		this.connect();
	}

	this.firstTime = {};

	nattrmon.addHistoryProvider(this.source, this);
	nOutput.call(this, this.output);
};
inherit(nOutput_PostgreSQL, nOutput);

/**
 * [connect description]
 * @param  {[type]} force [description]
 * @return {[type]}       [description]
 */
nOutput_PostgreSQL.prototype.connect = function(force) {
	if (force) {
		nattrmon.declareMonitoredObjectDirty(this.poolKey);
		return nattrmon.getMonitoredObject(this.poolKey);
	}

	if (!nattrmon.hasMonitoredObject(this.poolKey)) {
		var jdbcUrl = this.jdbcUrl;
		var user = this.user;
		var pass = this.pass;
		nattrmon.addMonitoredObject(this.poolKey,
			function() {
				try {
					log("Output_PostgreSQL | Connecting to " + jdbcUrl);
					return new DB("org.postgresql.Driver", jdbcUrl, user, pass);
				} catch(e) {
					logErr("PostgreSQL | " + stringify(e));
					throw e;
				}
			}
		);
	}

	return nattrmon.getMonitoredObject(this.poolKey);
};

/**
 * [rolldata description]
 * @param  {[type]} aDB [description]
 * @return {[type]}     [description]
 */
nOutput_PostgreSQL.prototype.rolldata = function(aDB, rdata) {
	aDB.us("delete from attribute_values where date_checked < now() - (? * interval '1 second')", [ rdata ]);
	aDB.us("delete from attributes where last_seen < now() - (? * interval '1 second')", [ rdata ]);
	aDB.commit();
};

/**
 * [getValuesByTime description]
 * @param  {[type]} anAttributeName   [description]
 * @param  {[type]} howManySecondsAgo [description]
 * @return {[type]}                   [description]
 */
nOutput_PostgreSQL.prototype.getValuesByTime = function(anAttributeName, howManySecondsAgo) {
	var db = this.connect();
	var ret = [];
	var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();

	try {
		var vals = db.qs("select val AS \"VAL\", to_char(date_modified at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"DATE_MODIFIED\"\
		                   from attribute_values where name = ? and\
		                   date_checked >= now() - (? * interval '1 second')\
		                   order by date_checked desc", [ anAttributeName, howManySecondsAgo ], true).results;

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
nOutput_PostgreSQL.prototype.getValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	var db = this.connect();
	var ret = [];
	var type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType();

	try {
		var vals = db.qs("select distinct val AS \"VAL\", to_char(date_modified at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"DATE_MODIFIED\"\
		                   from attribute_values where name = ? \
		                   order by \"DATE_MODIFIED\" desc limit ? ", [ anAttributeName, howManyEventsAgo ], true).results;

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
nOutput_PostgreSQL.prototype.output = function(scope, args) {
	var db = this.connect();

	try {
		var parent = this;
		sync(function() {
			db.u("create table if not exists attributes (name varchar(255) primary key, description varchar(4000), last_seen timestamptz)");
			db.u("create table if not exists attribute_values (name varchar(255), val text, date_modified timestamptz, date_checked timestamptz)");
			db.u("create index if not exists idx_attribute_values on attribute_values (name, date_modified, date_checked)");

			var attr = nattrmon.getAttributes().getAttributeByName(args.k.name);
			if (isUnDef(attr)) return;

			var dchk = (isUnDef(attr.lastcheck)) ? null : stringify(attr.lastcheck).replace(/"/g, "");
			db.us("insert into attributes (name, description, last_seen) values (?, ?, CAST(? AS timestamptz))\
			       on conflict (name) do update set description = excluded.description, last_seen = excluded.last_seen",
			      [ String(attr.name), String(attr.description), dchk ]);

			var attrval = scope.getCurrentValues(true).get({ name: args.k.name });
			var lastval = nattrmon.getLastValues(true).get({ name: args.k.name });

			if (isDef(attrval) && isDef(attrval.date)) {
				if (isUnDef(parent.firstTime[args.k.name]) || (args.onlyOnEvent && parent.see(args.k.name, attrval))) {
					var dmod = stringify(attrval.date).replace(/"/g, "");

					if (isDef(dchk)) {
						var val = stringify(attrval.val);
						if (isDef(val))
							db.us("insert into attribute_values (name, val, date_modified, date_checked) values (?, ?, CAST(? AS timestamptz), CAST(? AS timestamptz))",
							      [ String(args.k.name), String(val), dmod, dchk ]);
						parent.firstTime[args.k.name] = 1;
					}
				}
			}
			db.commit();

			parent.rolldata(db, parent.rdata);
		}, this);
	} catch (e) {
		logErr("Error while updating PostgreSQL: " + stringify(e) + " - " + ((isUnDef(e.javaException)) ? "" : e.javaException.printStackTrace()));
		if (!isUnDef(db)) {
			try {
				db.rollback();
				db.close();
			} catch(e) { logErr("exception closing: " + e.message); }
		}
		this.connect(true);
	}
};

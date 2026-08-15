/**
 * [nOutput_HistPrometheus description]
 *
 * Retrieve-only history provider: answers getValuesByTime/getValuesByEvents by
 * querying an external Prometheus server's HTTP API (/api/v1/query_range) for
 * samples that a paired nOutput_HTTP_Metrics instance already exposed via
 * scraping. Does not store anything itself -- output() is a no-op.
 *
 * Only numeric/boolean leaf values are recoverable this way, since that's all
 * OpenMetrics/Prometheus can store: a bare-numeric attribute maps to a single
 * series (metricPrefix_attr); a map-valued attribute (e.g. {load, idle}) maps
 * to its individual leaf series only (metricPrefix_attr_load, ..._idle) -- there
 * is never a series for the attribute itself. This plugin reconstructs a flat
 * map from those leaf series on a best-effort basis: it does not recover
 * multi-level nesting, and it can't distinguish an underscore that was already
 * in a key from one substituted for a non-alphanumeric character during
 * scraping, since that substitution is lossy.
 *
 * "Events" here means samples at the configured scrape/step cadence, not
 * value-change events -- Prometheus has no concept of "last N changes",
 * unlike the DB-backed history providers (H2/Oracle/PostgreSQL), which only
 * insert a row when the value actually changed.
 */
var nOutput_HistPrometheus = function(aMap) {
	aMap = isMap(aMap) ? aMap : {};

	if (isUnDef(aMap.url)) throw "nOutput_HistPrometheus needs a 'url' pointing at the Prometheus server.";

	this.url                   = String(aMap.url).replace(/\/+$/, "");
	this.source                = isDef(aMap.source) ? aMap.source : "prometheus";
	this.metricPrefix          = isDef(aMap.metricPrefix) ? aMap.metricPrefix : "nattrmon";
	this.step                  = isDef(aMap.step) ? Number(aMap.step) : 15;
	this.maxPoints             = isDef(aMap.maxPoints) ? Number(aMap.maxPoints) : 10000;
	this.eventsLookbackSeconds = isDef(aMap.eventsLookbackSeconds) ? Number(aMap.eventsLookbackSeconds) : 86400;
	this.timeout                = aMap.timeout;
	this.login                  = aMap.login;
	this.pass                   = aMap.pass;

	nattrmon.addHistoryProvider(this.source, this);
	nOutput.call(this, this.output);
};
inherit(nOutput_HistPrometheus, nOutput);

/**
 * Translates an attribute name into the metric name nOutput_HTTP_Metrics would
 * have scraped it as -- must match its _reInitTxt sanitization exactly.
 * @param  {[type]} anAttributeName [description]
 * @return {[type]}                 [description]
 */
nOutput_HistPrometheus.prototype._metricName = function(anAttributeName) {
	return this.metricPrefix + "_" + String(anAttributeName).replace(/[^a-zA-Z0-9]/g, "_");
};

/**
 * Escapes RE2/PromQL regex metacharacters (metric names are already
 * alphanumeric/underscore-only after _metricName, but metricPrefix is
 * user-supplied and concatenated unsanitized).
 * @param  {[type]} aString [description]
 * @return {[type]}         [description]
 */
nOutput_HistPrometheus.prototype._escapeRE = function(aString) {
	return String(aString).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Widens step so (end-start)/step stays under maxPoints -- Prometheus errors
 * out a range query once its own server-side point-count cap is exceeded, and
 * that comes back as an ordinary {status:"error"} body, not a thrown exception.
 * @param  {[type]} start [description]
 * @param  {[type]} end   [description]
 * @return {[type]}       [description]
 */
nOutput_HistPrometheus.prototype._adaptiveStep = function(start, end) {
	var span = Math.max(end - start, 1);
	var minStep = Math.ceil(span / this.maxPoints);
	return Math.max(this.step, minStep);
};

/**
 * [_queryRange description]
 * @param  {[type]} aPromQL [description]
 * @param  {[type]} start   [description]
 * @param  {[type]} end     [description]
 * @param  {[type]} step    [description]
 * @return {[type]}         [description]
 */
nOutput_HistPrometheus.prototype._queryRange = function(aPromQL, start, end, step) {
	var opts = { urlEncode: true };
	if (isDef(this.timeout)) opts.connectionTimeout = this.timeout;
	if (isDef(this.login))   opts.login = this.login;
	if (isDef(this.pass))    opts.pass = this.pass;

	return $rest(opts).post(this.url + "/api/v1/query_range", {
		query: aPromQL,
		start: start,
		end  : end,
		step : step
	});
};

/**
 * Parses a query_range response for a single (scalar) metric name into
 * {val,type,date} records, newest first.
 * @param  {[type]} raw  [description]
 * @param  {[type]} type [description]
 * @return {[type]}      [description]
 */
nOutput_HistPrometheus.prototype._parseRangeResponse = function(raw, type) {
	var ret = [];
	if (!isMap(raw)) return ret;
	if (raw.status != "success") {
		if (isDef(raw.error)) logErr("Prometheus query error: " + raw.error);
		return ret;
	}
	if (isUnDef(raw.data) || raw.data.resultType != "matrix") return ret;

	var result = isArray(raw.data.result) ? raw.data.result : [];
	var parent = this;
	result.forEach(series => {
		(series.values || []).forEach(pair => {
			ret.push({
				"val"  : parent._coerceValue(pair[1], type),
				"type" : type,
				"date" : new Date(Number(pair[0]) * 1000).toISOString()
			});
		});
	});
	ret.sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
	return ret;
};

/**
 * Parses a query_range response matched via a __name__ wildcard into
 * reconstructed flat-map {val,type,date} records, one per aligned timestamp.
 * @param  {[type]} raw        [description]
 * @param  {[type]} metricName [description]
 * @param  {[type]} type       [description]
 * @return {[type]}            [description]
 */
nOutput_HistPrometheus.prototype._parseMapRangeResponse = function(raw, metricName, type) {
	var ret = [];
	if (!isMap(raw)) return ret;
	if (raw.status != "success") {
		if (isDef(raw.error)) logErr("Prometheus query error: " + raw.error);
		return ret;
	}
	if (isUnDef(raw.data) || raw.data.resultType != "matrix") return ret;

	var result = isArray(raw.data.result) ? raw.data.result : [];
	if (result.length == 0) return ret;

	var prefixLen = metricName.length + 1; // + "_"
	var byTs = {};
	result.forEach(series => {
		var name = isMap(series.metric) ? series.metric.__name__ : void 0;
		if (isUnDef(name) || name.length <= prefixLen) return;
		var leaf = name.substring(prefixLen);
		(series.values || []).forEach(pair => {
			var ts = pair[0];
			if (isUnDef(byTs[ts])) byTs[ts] = {};
			byTs[ts][leaf] = Number(pair[1]);
		});
	});

	Object.keys(byTs).forEach(ts => {
		ret.push({
			"val"  : byTs[ts],
			"type" : type,
			"date" : new Date(Number(ts) * 1000).toISOString()
		});
	});
	ret.sort((a, b) => a.date < b.date ? 1 : (a.date > b.date ? -1 : 0));
	return ret;
};

/**
 * Coerces a Prometheus sample's string value back to the attribute's declared
 * type where possible; semaphores round-trip through Prometheus as 0/1.
 * @param  {[type]} aStrValue [description]
 * @param  {[type]} type      [description]
 * @return {[type]}           [description]
 */
nOutput_HistPrometheus.prototype._coerceValue = function(aStrValue, type) {
	if (type == nAttribute.TYPE_SEMAPHORE) return Number(aStrValue) != 0;
	return Number(aStrValue);
};

/**
 * [getValuesByTime description]
 * @param  {[type]} anAttributeName   [description]
 * @param  {[type]} howManySecondsAgo [description]
 * @return {[type]}                   [description]
 */
nOutput_HistPrometheus.prototype.getValuesByTime = function(anAttributeName, howManySecondsAgo) {
	howManySecondsAgo = Number(howManySecondsAgo);
	var type;
	try { type = nattrmon.getAttributes().getAttributeByName(anAttributeName).getType(); } catch(e) {}

	var end = Math.floor(Date.now() / 1000);
	var start = end - howManySecondsAgo;
	var step = this._adaptiveStep(start, end);
	var metric = this._metricName(anAttributeName);

	try {
		var scalar = this._parseRangeResponse(this._queryRange(metric, start, end, step), type);
		if (scalar.length > 0) return scalar;

		var wildcard = "{__name__=~\"^" + this._escapeRE(metric) + "_.+\"}";
		return this._parseMapRangeResponse(this._queryRange(wildcard, start, end, step), metric, type);
	} catch(e) {
		logErr("Error while getValuesByTime (Prometheus): " + e.message);
		return [];
	}
};

/**
 * Approximates "last N events" as the N most recent samples within a bounded
 * lookback window -- see the file header for why this differs semantically
 * from the DB-backed providers' value-change events.
 * @param  {[type]} anAttributeName  [description]
 * @param  {[type]} howManyEventsAgo [description]
 * @return {[type]}                  [description]
 */
nOutput_HistPrometheus.prototype.getValuesByEvents = function(anAttributeName, howManyEventsAgo) {
	howManyEventsAgo = Number(howManyEventsAgo);

	var all = this.getValuesByTime(anAttributeName, this.eventsLookbackSeconds);
	var ret = all.slice(0, howManyEventsAgo);
	if (ret.length < howManyEventsAgo) {
		nattrmon.debug("Prometheus history: only " + ret.length + " of " + howManyEventsAgo +
		               " requested samples found within eventsLookbackSeconds=" + this.eventsLookbackSeconds +
		               " for '" + anAttributeName + "'; consider increasing eventsLookbackSeconds.");
	}
	return ret;
};

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_HistPrometheus.prototype.output = function(scope, args) {
	// Retrieve-only: nothing to write.
};

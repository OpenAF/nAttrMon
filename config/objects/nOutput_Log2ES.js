// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_Log2ES(aMap)</key>
 * Configures the nAttrMon log to be output to ES
 * </odoc>
 */
var nOutput_Log2ES = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

	if (isUnDef(aMap.url)) {
		throw "You need to define an URL";
	} else {
		this.url = aMap.url;
	}

	if (isUnDef(aMap.index) && isUnDef(aMap.funcIndex)) {
		throw "Please define either an index or a funcIndex";
	} else {
		if (isUnDef(aMap.format))
			this.funcIndex = (isDef(aMap.funcIndex)) ? af.eval(aMap.funcIndex) : new Function("return '" + aMap.index + "'");
		else
			this.funcIndex = aMap.index;
	}

	this.format = aMap.format;
	this.stampMap = aMap.stampMap;
	
	this.user = aMap.user;
	this.pass = aMap.pass;

	this.name = _$(aMap.name, "name").isString().default("nattrmon")

	this.myUUID = genUUID();
	this.ch     = "__es_ " + this.myUUID;
	$ch(this.ch).create(__, "elasticsearch", {
		url   : this.url,
		idKey : "id",
		index : this.funcIndex,
		format: this.format,
		user  : this.user,
		pass  : this.pass
	});
 
	if ($ch().list().indexOf(this.ch) < 0) {
		throw "Couldn't create the ElasticSearch channel/connection."
	}

 	// Setting all nAttrmon logging to elastic
 	var esSubs = ow.ch.utils.getLogStashSubscriber(this.ch, "stdin", this.name, function(e) { sprintErr(e); }, __, this.stampMap)
	startLog(esSubs)

	// Log current info
	var p = $from(getOPackLocalDB()).equals("name", "nAttrMon");
	var t = templify("OpenAF version: {{oafVersion}} ({{oafDistribution}}) | nAttrMon version: {{namVersion}} | Java version: {{javaVersion}}", {
		oafVersion: getVersion(),
		oafDistribution: getDistribution(),
		namVersion: (p.any() ? p.at(0).version : "n/a"),
		javaVersion: ow.format.getJavaVersion()
	});
	log(t);

	$from(af.fromJavaArray( af.getScopeIds() ))
	.starts("__NAM_")
	.notStarts("__NAM_SEC")
	.sort()
	.select(r => { 
		if (!isObject(global[r])) log("Parameter " + r + ": " + global[r])
	});

    nOutput.call(this, this.output);
};
inherit(nOutput_Log2ES, nOutput);

nOutput_Log2ES.prototype.output = function(scope, args) {

};
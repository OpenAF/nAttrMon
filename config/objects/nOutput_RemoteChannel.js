
/**
 * <odoc>
 * <key>nattrmon.nOutput_RemoteChannel(aMap)</key>
 * Pushes an internal channel to a remote channel (e.g. cvals to another nAttrMon) and creates/updates as an attribute. 
 * \
 *    - url (String) The remote channel url\
 *    - idKey (String) The object path to the id key to use (default "name")\
 *    - valueKey (String) The object path to the value to include in attributes (default val)\
 *    - include (Array) An optional array of ids to include (default all)\
 *    - exclude (Array) An optional array of ids to exclude\
 *    - attrTemplate (String) Attribute template given id, value and originalValue\
 * \
 * </odoc>
 */
var nOutput_RemoteChannel = function(aMap) {
	this.url = aMap.url;
    this.include = aMap.include;
	this.exclude = aMap.exclude;	
    this.idKey = (isUnDef(aMap.idKey)) ? "name" : aMap.idKey;
	this.valueKey = (isUnDef(aMap.valueKey)) ? void 0 : aMap.valueKey;
	this.attrTemplate = (isUnDef(aMap.attrTemplate)) ? "{{id}}" : aMap.attrTemplate;

	if (isUnDef(this.url)) throw "You need to define an external channel url.";
    if (isDef(this.include) && !isArray(this.include)) throw "The include entry should be an array.";
    if (isDef(this.exclude) && !isArray(this.exclude)) throw "The exclude entry should be an array.";

    this.channelId = sha1(this.url);
    $ch(this.channelId).createRemote(this.url);

	nOutput.call(this, this.output);
};
inherit(nOutput_RemoteChannel, nOutput);

nOutput_RemoteChannel.prototype.output = function(scope, args, meta) {
	// Note: not implemented as a channel subscriber so that plug reload works

	if(isUnDef(meta.chSubscribe)) 
		throw "nOutput_RemoteChannels only works when used with chSubscribe";

	if (args.op != "set" && args.op != "setall" && args.op != "unset") return;

	var argsk, argsv;
	if (args.op == "setall") {
		argsk = args.k;
		argsv = args.v;
	}

	if (args.op == "set" || args.op == "unset") {
		argsk = [ args.k ];
		argsv = [ args.v ];
	}

	var res = true;
	for(var i in argsk) {
		var k = ow.obj.getPath(argsk[i], this.idKey);
		if (isDef(this.include) && !this.include.indexOf(k)) res = false;
		if (isDef(this.exclude) && this.exclude.indexOf(k)) res = false;
	
		var aV = {};
		if (isDef(this.valueKey)) {
			ow.obj.setPath(aV, this.valueKey, argsv[i]);
		} else {
			aV = argsv[i];
		}
	
		var aK = argsk[i];
		var tpl = templify(this.attrTemplate, { id: k, value: aV, originalValue: argsv[i] });
		ow.obj.setPath(aV, this.idKey, tpl);
		ow.obj.setPath(aK, this.idKey, tpl);
	}
	
	if (res) {
		if (args.op == "set")    $ch(this.channelId).set(argsk[0], argsv[0]);
		if (args.op == "setall") $ch(this.channelId).setAll(argsk, argsv);
		if (args.op == "unset")  $ch(this.channelId).unset(argsk[0]);
	}
	
};
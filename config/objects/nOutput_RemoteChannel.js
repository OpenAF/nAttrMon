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
	this.ch = aMap.ch;
    this.idKey = (isUnDef(aMap.idKey)) ? "name" : aMap.idKey;
	this.valueKey = (isUnDef(aMap.valueKey)) ? void 0 : aMap.valueKey;
	this.attrTemplate = (isUnDef(aMap.attrTemplate)) ? "{{id}}" : aMap.attrTemplate;

	if (isUnDef(this.url)) throw "You need to define an external channel url.";
	if (isUnDef(this.ch)) throw "You need to define an internal channel.";
    if (isDef(this.include) && !isArray(this.include)) throw "The include entry should be an array.";
    if (isDef(this.exclude) && !isArray(this.exclude)) throw "The exclude entry should be an array.";

    this.channelId = sha1(this.url);
    $ch(this.channelId).createRemote(this.url);

	nOutput.call(this, this.output);
};
inherit(nOutput_RemoteChannel, nOutput);

nOutput_RemoteChannel.prototype.output = function(scope, args) {
	// Note: not implemented as a channel subscriber so that plug reload works

	if(isUnDef(meta.chSubscribe)) 
		throw "nOutput_RemoteChannels only works when used with chSubscribe";

	var res = true;

	if (args.op != "set" && args.op != "setall" && args.op != "unset") return;

	var k = ow.obj.getPath(args.k, aMap.idKey);
	if (!(isDef(this.include) && this.include.indexOf(k))) res = false;
	if (isDef(this.exclude) && this.exclude.indexOf(k)) res = false;

	var aV = {};
	if (isDef(this.valueKey)) {
		ow.obj.setPath(aV, this.valueKey, args.v);
	} else {
		aV = args.v;
	}

	var aK = args.k;
	ow.obj.setPath(aK, this.idKey, templify(this.attrTemplate, { id: k, value: aV, originalValue: args.v }));

	if (res) {
		if (args.op == "set")    $ch(this.channelId).set(aK, aV);
		if (args.op == "setall") $ch(this.channelId).setAll(aK, aV);
		if (args.op == "unset")  $ch(this.channelId).unset(aK);
	}
};

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

	var isBatch = args.op == "setall";
	var values = isBatch ? args.v : [args.v];
	if (!isArray(values)) return;
	var selected = [], selectedKeys = [];
	values.forEach((value, index) => {
		// Bulk keys are field names, not record keys. Read each id from its value.
		var originalKey = isBatch ? {} : args.k;
		if (isBatch) (args.k || []).forEach(field => {
			ow.obj.setPath(originalKey, field, ow.obj.getPath(value, field));
		});
		var id = ow.obj.getPath(isBatch ? value : originalKey, this.idKey);
		if (isDef(this.include) && this.include.indexOf(id) < 0) return;
		if (isDef(this.exclude) && this.exclude.indexOf(id) >= 0) return;

		var targetValue = {}, targetKey = clone(originalKey);
		if (isDef(this.valueKey)) ow.obj.setPath(targetValue, this.valueKey, clone(value));
		else if (isDef(value)) targetValue = clone(value);
		var name = templify(this.attrTemplate, { id: id, value: targetValue, originalValue: value });
		ow.obj.setPath(targetValue, this.idKey, name);
		ow.obj.setPath(targetKey, this.idKey, name);
		selected.push(targetValue);
		selectedKeys.push(targetKey);
	});

	if (!selected.length) return;
	if (args.op == "set")    $ch(this.channelId).set(selectedKeys[0], selected[0]);
	if (args.op == "setall") $ch(this.channelId).setAll(args.k, selected);
	if (args.op == "unset")  $ch(this.channelId).unset(selectedKeys[0]);
};

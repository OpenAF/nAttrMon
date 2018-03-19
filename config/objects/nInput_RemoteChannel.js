/**
 * <odoc>
 * <key>nattrmon.nInput_RemoteChannel(aMap)</key>
 * Retrieves a remote value from a remote channel (e.g. cvals from another nAttrMon) and creates/updates as an attribute. 
 * \
 *    - url (String) The remote channel url\
 *    - idKey (String) The object path to the id key to use (default "name")\
 *    - valueKey (String) The object path to the value to include in attributes (default val)\
 *    - ids (Array)  An optional array of ids to retrieve (default all)\
 *    - attrTemplate (String) Attribute template given id, value and originalValue\
 * \
 * </odoc>
 */
var nInput_RemoteChannel = function(aMap) {
    this.url = aMap.url;
    this.ids = aMap.ids;
    this.idKey = (isUnDef(aMap.idKey)) ? "name" : aMap.idKey;
    this.valueKey = (isUnDef(aMap.valueKey)) ? "val" : aMap.valueKey;
    this.attrTemplate = (isUnDef(aMap.attrTemplate)) ? "{{id}}" : aMap.attrTemplate;

    if (isUnDef(this.url)) throw "You need to define an external channel url.";
    if (isDef(this.ids) && !isArray(this.ids)) throw "The ids should be an array.";

    this.channelId = sha1(this.url);
    $ch(this.channelId).createRemote(this.url);

	nInput.call(this, this.input);
};
inherit(nInput_RemoteChannel, nInput);

nInput_RemoteChannel.prototype.input = function(scope, args) {
    var res = {};

    var data = [];
    if (isUnDef(this.ids)) {
        data = $ch(this.channelId).getAll();
    } else {
        for (var i in this.ids) {
            var k = {};
            ow.obj.setPath(k, this.idKey, this.ids[i]);
            data.push($ch(this.channelId).get(k));
        }
    }

    for(var i in data) {
        var row = data[i];
        var id = ow.obj.getPath(row, this.idKey);
        var value = ow.obj.getPath(row, this.valueKey);
        res[templify(this.attrTemplate, { id: id, value: value, originalValue: row })] = value;
    }

    return res;
};
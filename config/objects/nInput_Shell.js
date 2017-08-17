/**
 * <odoc>
 * <key>nattrmon.nInput_Shell(aCommand, isJson, attributeName)</key>
 * Creates a nattrmon input to execute a given aCommand. The stdout result is directly assign as the attribute value
 * or parsed as json if isJson = true. Optionally you can provide an attributeName otherwise the default will be:
 * "Server status/[aCommand]".\
 * \
 * nattrmon.addInput({ "name": "an unique name", "timeInterval": 30000 },\
 *    new nInput_Shell("/my/shellCommand2JSON.sh", true, "Commands/Script"));\
 * \
 * </odoc>
 */
var nInput_Shell = function(aCommand, isJson, attributeName) {
	if (isObject(aCommand)) {
		this.cmd = (isDef(aCommand.cmd) ? aCommand.cmd : ""); 
		this.parseJson = (isDef(aCommand.parseJson) ? aCommand.parseJson : false);
		this.name = (isDef(aCommand.name) ? aCommand.name : this.cmd);
		this.attrTemplate = (isDef(aCommand.attrTemplate) ? aCommand.attrTemplate : "Server status/{{name}}"); 
	} else {
    	this.cmd = aCommand;
    	this.parseJson = isJson;
    	this.name = "";
		this.attrTemplate = (isUndefined(attributeName)) ? "Server status/" + aCommand : attributeName;
	}

	nInput.call(this, this.input);
}
inherit(nInput_Shell, nInput);

/**
 */
nInput_Shell.prototype.input = function(scope, args) {
    var ret = {};
    var attrname = templify(this.attrTemplate, { name: this.name });

    if (this.parseJson) 
		ret[attrname] = jsonParse(sh(this.cmd));
    else
    	ret[attrname] = sh(this.cmd);

    return ret;
}

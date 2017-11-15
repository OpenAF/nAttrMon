/**
 * <odoc>
 * <key>nattrmon.nInput_Shell(aMap)</key>
 * Creates a nattrmon input to execute a given command (cmd). The stdout result is directly assign as the attribute value
 * or parsed as json if parseJson = true. Optionally you can provide an attrTemplate otherwise the default will be:
 * "Server status/[aCommand]". The parameter aMap can have the following values:\
 * \
 *    - cmd (the command-line to execute)\
 *    - parseJson (boolean to indicate if the cmd output is json parsable)\
 *    - attrTemplate (a string template for the name of the attribute)\
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

/**
 * <odoc>
 * <key>nattrmon.nInput_Shell(aMap)</key>
 * Creates a nattrmon input to execute a given command (cmd). The stdout result is directly assign as the attribute value
 * or parsed as json if parseJson = true. Optionally you can provide an attrTemplate otherwise the default will be:
 * "Server status/[aCommand]". If keys or chKeys is provided the command will be executed remotelly. The parameter aMap can have the following values:\
 * \
 *    - cmd (the command-line to execute)\
 *    - parseJson (boolean to indicate if the cmd output is json parsable)\
 *    - attrTemplate (a string template for the name of the attribute)\
 *    - keys (a map with a SSH key or array of maps with SSH keys)\
 *    - chKeys (a channel with similar maps as keys)\
 * \
 * </odoc>
 */
var nInput_Shell = function(aCommand, isJson, attributeName) {
	if (isObject(aCommand)) {
		this.params = aCommand;
		this.cmd = (isDef(aCommand.cmd) ? aCommand.cmd : ""); 
		this.parseJson = (isDef(aCommand.parseJson) ? aCommand.parseJson : false);
		this.name = (isDef(aCommand.name) ? aCommand.name : this.cmd);
		this.attrTemplate = (isDef(aCommand.attrTemplate) ? aCommand.attrTemplate : "Server status/{{name}}"); 
	} else {
    	this.cmd = aCommand;
    	this.parseJson = isJson;
    	this.name = "";
		this.attrTemplate = (isUnDef(attributeName)) ? "Server status/" + aCommand : attributeName;
	}

	nInput.call(this, this.input);
};
inherit(nInput_Shell, nInput);

/**
 */
nInput_Shell.prototype.input = function(scope, args) {
    var ret = {};

	if (isDef(this.params.chKeys) || isDef(this.params.keys)) {
		var res = [], attrname;
		_$(this.cmd).isString().$_(); // Ensure cmd is string for ssh

		if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

		for(var i in this.params.keys) {
			nattrmon.useObject(this.params.keys[i], (ssh) => {
				if (this.parseJson) {
					res.push({
						key: this.params.keys[i],
						result: jsonParse(ssh.exec(templify(this.cmd)))
					});
				} else {
					res.push({
						key: this.params.keys[i],
						result: ssh.exec(templify(this.cmd))
					});
				}
			});

		}

		if (this.params.keys.length == 1) {
			attrname = templify(this.attrTemplate, { name: this.name, key: this.params.keys[0]});
			res = res[0].result;
		} else {
			attrname = templify(this.attrTemplate, { name: this.name });
		}

		ret[attrname] = res;
	} else {
		var attrname = templify(this.attrTemplate, { name: this.name });
		var value = $sh(templify(this.cmd)).get(0);

		value = (isDef(value.stdin) ? value.stdin : "") + (isDef(value.stdout) ? value.stdout : "");

		if (this.parseJson) {
			ret[attrname] = jsonParse(value);
		} else {
			ret[attrname] = value;
		}
	}

    return ret;
};

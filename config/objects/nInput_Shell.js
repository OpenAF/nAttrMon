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
		var parent = this;

		if (isArray(this.cmd)) this.cmd = this.cmd.join(" && ");
		_$(this.cmd).isString().$_();

		if (isDef(this.params.chKeys)) this.params.keys = $ch(this.params.chKeys).getKeys().map(r => r.key); 

		for(var i in this.params.keys) { 
			var v = $ch(this.params.chKeys).get({ key: this.params.keys[i] });
			v = __nam_getSec(v);
			
			try {
				switch(v.type) {
				case "kube":
					if (isUnDef(getOPackPath("Kube"))) {
						throw "Kube opack not installed.";
					} 
	
					var s = $sec(v.secRepo, v.secBucket, v.secBucketPass, v.secMainPass, v.secFile);
					var k;
					if (isDef(v.secObjKey)) {
						var k = s.getObj(v.secObjKey);
					}
					if (isDef(v.secKey)) {
						var ka = s.get(v.secKey);
						k = new Kube(ka.url, ka.user, ka.pass, ka.wsTimeout, ka.token);
					}
					if (isUnDef(k) || isUnDef(k.getNamespaces)) {
						throw "The secObjKey = '" + v.secObjKey + "' is not a valid Kube object.";
					}
	
					var epods = [];
					if (isUnDef(v.pod)) {
						if (isDef(v.podTemplate)) {
							var pods = k.getPods(v.namespace);
							epods = $from(pods)
									.equals("Kind", "Pod")
									.match("Metadata.Name", v.podTemplate)
									.select(r => r.Metadata.Name);
						} else {
							throw "No pod determined for '" + v.secObjKey + "'";
						}
					} else {
						epods = [ v.pod ];
					}
				
					epods.forEach(pod => {
						try {
							var rr = String(k.exec(v.namespace, pod, [ templify(parent.cmd) ], void 0, true));
							if (parent.parseJson) {
								res.push({
									key: parent.params.keys[i],
									result: jsonParse(rr, true)
								});
							} else {
								res.push({
									key: parent.params.keys[i],
									result: rr
								});
							}
							;
						} catch(e) {
							logErr("nInput_Shell | Error on namespace '"+ v.namespace + "', pod '" + pod + "': " + String(e));
						}
					});
					
					break;
				case "ssh":
				default:
					nattrmon.useObject(this.params.keys[i], (ssh) => {
						if (this.parseJson) {
							res.push({
								key: this.params.keys[i],
								result: jsonParse(ssh.exec(templify(this.cmd)), true)
							});
						} else {
							res.push({
								key: this.params.keys[i],
								result: ssh.exec(templify(this.cmd))
							});
						}
					});
				}
			} catch(pke) {
				logErr(" nInput_Shell | " + this.params.keys[i] + " | " + pke)
			}
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
			ret[attrname] = jsonParse(value, true);
		} else {
			ret[attrname] = value;
		}
	}

    return ret;
};

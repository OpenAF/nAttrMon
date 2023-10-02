/**
 * <odoc>
 * <key>nattrmon.nInput_Shell(aMap)</key>
 * Creates a nattrmon input to execute a given command (cmd). The stdout result is directly assign as the attribute value
 * or parsed as json if parseJson = true. Optionally you can provide an attrTemplate otherwise the default will be:
 * "Server status/[aCommand]". If keys or chKeys is provided the command will be executed remotelly. The parameter aMap can have the following values:\
 * \
 *    - cmd (the command-line to execute)\
 *    - parseJson (boolean to indicate if the cmd output is json parsable)\
 *    - parseYaml (boolean to indicate if the cmd output is yaml parsable)\
 *    - attrTemplate (a string template for the name of the attribute)\
 *    - keys (a map with a SSH key or array of maps with SSH keys)\
 *    - chKeys (a channel with similar maps as keys)\
 * \
 * </odoc>
 */
var nInput_Shell = function(params) {
	if (isMap(params)) {
		this.params = params
		this.cmd = (isDef(params.cmd) ? params.cmd : "")
		this.cmdEach = (isDef(params.cmdEach) ? params.cmdEach : "")
		this.parseJson = (isDef(params.parseJson) ? params.parseJson : false)
		this.parseYaml = (isDef(params.parseYaml) ? params.parseYaml : false)
		this.eachParseJson = (isDef(params.eachParseJson) ? params.eachParseJson : false)
		this.eachParseYaml = (isDef(params.eachParseYaml) ? params.eachParseYaml : false)
		this.posExec = (isDef(params.posExec) ? params.posExec : __)
		this.name = (isDef(params.name) ? params.name : this.cmd)
		this.attrTemplate = (isDef(params.attrTemplate) ? params.attrTemplate : "Shell/{{name}}")
	}

	nInput.call(this, this.input)
};
inherit(nInput_Shell, nInput)

/**
 */
nInput_Shell.prototype.input = function(scope, args) {
    var ret = {}

	// Generic parsing functions
	var _parse = s => {
		if (this.params.parseJson) return jsonParse(s, true)
		if (this.params.parseYaml) return af.fromYAML(s)
	}
    var _parseEach = s => {
		if (this.params.eachParseJson) return jsonParse(s, true)
		if (this.params.eachParseYaml) return af.fromYAML(s)
	}

    var setSec = aEntry => {
        if (isDef(aEntry.secKey)) {
            return __nam_getSec(aEntry)
        } else {
            return aEntry
        }
    }

	// Generic execution functions
	var _exec = (fn, cmd, cmdEach) => {
		if (isDef(cmdEach)) {
			var lst = _parse(fn(cmd))
			if (isArray(lst)) {
				var _r = []
				lst.forEach(v => {
					//lprint(templify(cmdEach, v))
					var __r = _parseEach(fn(templify(cmdEach, v)))
					_r.push(__r)
				})
			} else {
				throw "nInput_Shell | Not a list/array (" + af.toSLON(lst) + ")"
			}
			return _r
		} else {
			return _parse(fn(cmd))
		}
	}

	// Determine attribute name
	var attrname
	if (isArray(this.params.keys) && this.params.keys.length == 1) {
		attrname = templify(this.attrTemplate, { name: this.name, key: this.params.keys[0]})
	} else {
		attrname = templify(this.attrTemplate, { name: this.name })
	}

	// Pos-execution function
	var _posExecFn
	var _posExec = (inO) => {
		if (isString(this.params.posExec)) {
			try {
				if (isUnDef(_posExecFn)) _posExecFn = af.eval("(val, attrname) => { " + this.params.posExec + " }")
				if (isFunction(_posExecFn)) {
					if (isArray(inO)) {
						return inO.map(r => _posExecFn(r, attrname))
					} else {
						return _posExecFn(inO, attrname)
					}
				}
			} catch(pefe) {
				logErr("nInput_Shell | " + attrname + " | posExecFn | " + pefe)
			}
		}
		return inO
	}

	if (isDef(this.params.chKeys) || isDef(this.params.keys)) {
		var res = []
		var parent = this

		if (isArray(this.cmd)) this.cmd = this.cmd.join(" && ")
		_$(this.cmd).isString().$_()

		if (isDef(this.params.chKeys)) this.params.keys = $ch(this.params.chKeys).getKeys().map(r => r.key)

		for(var i in this.params.keys) { 
			var v = $ch(this.params.chKeys).get({ key: this.params.keys[i] })
			v = __nam_getSec(v)
			
			try {
				switch(v.type) {
				case "kube":
					if (isUnDef(getOPackPath("Kube"))) {
						throw "Kube opack not installed."
					} 
	
					var s = $sec(v.secRepo, v.secBucket, v.secBucketPass, v.secMainPass, v.secFile)
					var k;
					if (isDef(v.secObjKey)) {
						var k = s.getObj(v.secObjKey)
					}
					if (isDef(v.secKey)) {
						var ka = s.get(v.secKey)
						k = new Kube(ka.url, ka.user, ka.pass, ka.wsTimeout, ka.token)
					}
					if (isUnDef(k) || isUnDef(k.getNamespaces)) {
						throw "The secObjKey = '" + v.secObjKey + "' is not a valid Kube object."
					}
	
					var epods = []
					if (isUnDef(v.pod)) {
						if (isDef(v.podTemplate)) {
							var pods = k.getPods(v.namespace)
							epods = $from(pods)
									.equals("Kind", "Pod")
									.match("Metadata.Name", v.podTemplate)
									.select(r => r.Metadata.Name)
						} else {
							throw "No pod determined for '" + v.secObjKey + "'"
						}
					} else {
						epods = [ v.pod ]
					}
				
					epods.forEach(pod => {
						try {
							//var rr = String(k.exec(v.namespace, pod, [ templify(parent.cmd) ], __, true))
							if (parent.parseJson || parent.parseYaml) {
								res.push({
									key: parent.params.keys[i],
									result: _posExec(_exec(c => {
										return String(k.exec(v.namespace, pod, [ templify(c) ], __, true))
									}, parent.cmd, parent.cmdEach))
								});
							} else {
								res.push({
									key: parent.params.keys[i],
									result: _posExec(_exec(c => {
										return String(k.exec(v.namespace, pod, [ templify(c) ], __, true))
									}, parent.cmd, parent.cmdEach))
								});
							}
							;
						} catch(e) {
							logErr("nInput_Shell | Error on namespace '"+ v.namespace + "', pod '" + pod + "': " + String(e))
						}
					})
					
					break
				case "ssh":
				default:
					nattrmon.useObject(this.params.keys[i], (ssh) => {
						if (this.parseJson || this.parseYaml) {
							res.push({
								key: this.params.keys[i],
								result: _posExec(_exec(c => {
									return ssh.exec(templify(c))
								}, this.cmd, this.cmdEach))
							})
						} else {
							res.push({
								key: this.params.keys[i],
								result: _posExec(_exec(c => {
									return ssh.exec(templify(c))
								}, this.cmd, this.cmdEach))
							})
						}
					})
				}
			} catch(pke) {
				logErr(" nInput_Shell | " + this.params.keys[i] + " | " + pke)
			}
		}

		if (this.params.keys.length == 1) {
			//attrname = templify(this.attrTemplate, { name: this.name, key: this.params.keys[0]})
			res = res[0].result
		} else {
			//attrname = templify(this.attrTemplate, { name: this.name })
		}

		ret[attrname] = res
	} else {
	    //attrname = templify(this.attrTemplate, { name: this.name })
		switch(this.params.type) {
		case "kube":
			if (isUnDef(getOPackPath("Kube"))) throw "Kube opack not installed."
			loadLib("kube.js")

			this.params.kube = _$(this.params.kube, "kube").isMap().default({})

			var m       = setSec(this.params.kube)
			traverse(m, (aK, aV, aP, aO) => {
				if (isString(aV)) aO[aK] = templify(aV, m)
			})
			m.kind      = _$(m.kind, "kube.kind").isString().default("FPO")
			m.namespace = _$(m.namespace, "kube.namespace").isString().default("default")

			var nss = m.namespace.split(/ *, */), lst = []

			nss.forEach(ns => {
				var its = $kube(m)["get" + m.kind](ns)
				if (isMap(its) && isArray(its.items)) lst = lst.concat(its.items)
			})

			if (isMap(m.selector)) {
				ow.obj.filter(lst, m.selector).forEach(r => {
					var newM = clone(m)
					traverse(newM, (aK, aV, aP, aO) => {
						if (isString(aV)) aO[aK] = templify(aV, r)
					})
				})
			}

			ow.obj.filter(lst, m.selector).forEach(r => {
				var newM    = clone(m)
				newM.pod       = r.metadata.name
				newM.namespace = r.metadata.namespace
				try {
					var fn = c => {
						var res = nattrmon.shExec("kube", newM).exec(["/bin/sh", "-c", c])
						if (isDef(res.stdout)) {
							return res.stdout
						} else {
							return __
						}
					}

					if (isUnDef(ret[attrname])) ret[attrname] = []
					var _v = _posExec(_exec(fn, this.cmd, this.cmdEach))
					if (isArray(_v)) ret[attrname] = ret[attrname].concat(_v); else ret[attrname].push(_v)
				} catch(fe) { logErr("nInput_Shell | Kube " + newM.namespace + "::" + newM.pod + " | " + fe) }
			})
			break
		case "local":
		default     :
			var fn = c => {
				var value = $sh(templify(c)).get(0)
				value = (isDef(value.stdin) ? value.stdin : "") + (isDef(value.stdout) ? value.stdout : "")
				return value
			}
			
			ret[attrname] = _posExec(_exec(fn, this.cmd, this.cmdEach))
		}
	}

    return ret
}
/**
 * <odoc>
 * <key>nattrmon.nInput_Filesystem(aMap)</key>
 * Gathers filesystem information (total, used and free storage space + total, used, free inode usage) per operating system volume using
 * the unix "df" command. On can provide on aMap:\
 * \
 *    - volumeNames (an array of strings with the device volumes on the unix operating system)\
 *    - useMountPoint (if useMountPoint=true the mount point will be used instead of the filesystem)
 *    - keys (a map with a SSH key or array of maps with SSH keys)\
 *    - chKeys (a channel with similar maps as keys)\
 *    - execTimeout (timeout for the exec instruction, default 120000 miliseconds - 2 minutes)\
 * \
 * </odoc>
 */
nInput_Filesystem = function (aMap) {
	if (isMap(aMap)) {
		this.params = aMap
		this.params.attrTemplate = _$(this.params.attrTemplate, "attrTemplate").isString().default("Server status/Filesystem")
	} else {
		this.params = {};
	}
	this.params.useMountPoint = _$(this.params.useMountPoint, "useMountPoint").isBoolean().default(false)
	this.params.execTimeout = _$(this.params.execTimeout, "execTimeout").isNumber().default(120000)
	if (!isArray(this.params.volumeNames) || this.params.volumeNames.length == 0) throw "No volumeNames defined.";

	nInput.call(this, this.input);
};
inherit(nInput_Filesystem, nInput);

nInput_Filesystem.prototype.__parseCmd = function (resSpace, resINode) {
	var dfs = [];
	var linesSpace = resSpace.split(/\n/);
	var linesINode = resINode.split(/\n/);

	for (var j in this.params.volumeNames) {
		var vname = this.params.volumeNames[j];
		var space = {};
		var inode = {};
		var match_regex;

		if (this.params.useMountPoint) {
			match_regex = new RegExp(" " + vname + "$");
		} else {
			match_regex = new RegExp("^" + vname + "\\s+");
		}

		for (var i in linesSpace) {
			if (linesSpace[i].match(match_regex)) {
				var line = linesSpace[i].split(/\s+/);
				space = {
					"total": line[1],
					"used": line[2],
					"free": line[3],
					"perc": line[4]
				};
			}
		}

		for (var i in linesINode) {
			if (linesINode[i].match(match_regex)) {
				var line = linesINode[i].split(/\s+/);
				inode = {
					"total": line[1],
					"used": line[2],
					"free": line[3],
					"perc": line[4]
				};
			}
		}

		dfs.push({
			"Volume": vname,
			"Total space": space.total,
			"Used space": space.used,
			"Free space": space.free,
			"% Used space": space.perc,
			"Total inode": inode.total,
			"Used inode": inode.used,
			"Free inode": inode.free,
			"% Used inode": inode.perc
		});
	}

	return dfs;
};

nInput_Filesystem.prototype.input = function (scope, args) {
	var ddfs = [];
	var ret = {};
	var parent = this;

	try {
		var resSpace, resINode;

		if (isDef(this.params.chKeys) || isDef(this.params.keys)) {
			if (isDef(this.params.chKeys)) this.params.keys = $ch(this.params.chKeys).getKeys().map(r => r.key); 

			for (var i in this.params.keys) {
				var v
				if (isDef(this.params.chKeys)) 
					$ch(this.params.chKeys).get({ key: this.params.keys[i] })
				else
					v = this.params.keys[i]
				v = __nam_getSec(v);
				
				switch(v.type) {
				case "kube":
					if (isUnDef(getOPackPath("Kube"))) {
						throw "Kube opack not installed.";
					}  
					loadLib("kube.js")
					var s = $sec(v.secRepo, v.secBucket, v.secBucketPass, v.secMainPass, v.secFile);
					var ka, km
					if (isDef(v.secObjKey)) {
						var k = s.getObj(v.secObjKey);
					}
					if (isDef(v.secKey)) {
						var ka = s.get(v.secKey);
						km = {
							url: ka.url,
							user: ka.user,
							pass: ka.pass,
							wsTimeout: ka.wsTimeout,
							token: ka.token
						}
					}

					var epods = [];
					if (isUnDef(v.pod)) {
						if (isDef(v.podTemplate)) {
							var pods = $kube(km).getFPO(v.namespace)
							epods = $from(pods.items)
							        .equals("kind", "Pod")
							        .match("metadata.name", v.podTemplate)
						          	.select(r => r.metadata.name)
						} else {
							throw "nInput_Filesystem | No pod determined for '" + v.secObjKey + "'";
						}
					} else {
						epods = [ v.pod ];
					}
				    var step;
					epods.forEach(pod => {
						try {
							step = "Retrieve filesystem information";
							resSpace = String( isDef(v.namespace) ? $kube(km).ns(v.namespace).exec(pod, "df -P", parent.params.execTimeout) : $kube(km).exec(pod, "df -P", parent.params.execTimeout) )
							step = "Retrieve inode information";
							resINode = String( isDef(v.namespace) ? $kube(km).ns(v.namespace).exec(pod, "df -i -P", parent.params.execTimeout) : $kube(km).exec(pod, "df -i -P", parent.params.execTimeout) )
                            step = "Parse filesystem information";
							var rr = parent.__parseCmd(resSpace, resINode).map(r => {
								var res = { key: parent.params.keys[i], pod: pod };
								return merge(res, r);
							});
							step = "Adding parsed filesystem information";
							ddfs = ddfs.concat(rr);
						} catch(e) {
							logErr("nInput_Filesystem | Error on namespace '"+ v.namespace + "', pod '" + pod + "' - " + step + ": " + String(e));
						}
					})

					break;
				case "ssh":
				default   :
					// Default SSH
					nattrmon.useObject(this.params.keys[i], (ssh) => {
						resSpace = ssh.exec("df -P", parent.params.execTimeout);
						resINode = ssh.exec("df -i -P", parent.params.execTimeout);
					});
					var rr = this.__parseCmd(resSpace, resINode).map(r => {
						var res = { key: this.params.keys[i] };
						return merge(res, r);
					});
					ddfs = ddfs.concat(rr);
				}
			}

            if (ddfs.length > 0) {
				if (this.params.keys.length == 1 && ddfs.length == 1) {
					attrname = templify(this.params.attrTemplate, {
						name: this.name,
						key: this.params.keys[0]
					});

					if (isDef(ddfs[0].result)) {
						ddfs = ddfs[0].result;
					} else {
						ddfs = ddfs[0];
					}				
				} else {
					attrname = templify(this.params.attrTemplate, {
						name: this.name
					});
				}

				ret[attrname] = ddfs;
			}
		} else {
			resSpace = sh("df -P");
			resINode = sh("df -i -P");

			ddfs = this.__parseCmd(resSpace, resINode);
			if (ddfs.length > 0) { 
				ret[templify(this.params.attrTemplate)] = ddfs; 
			}
		}

	} catch (e) {
		logErr("nInput_Filesystem | Error executing command: " + e.message);
	}

	return ret;
};
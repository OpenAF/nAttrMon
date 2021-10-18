/**
 * <odoc>
 * <key>nattrmon.nInput_Filesystem(aMap)</key>
 * Gathers filesystem information (total, used and free storage space + total, used, free inode usage) per operating system volume using
 * the unix "df" command. On can provide on aMap:\
 * \
 *    - volumeNames (an array of strings with the device volumes on the unix operating system)\
 *    - keys (a map with a SSH key or array of maps with SSH keys)\
 *    - chKeys (a channel with similar maps as keys)\
 * \
 * </odoc>
 */
nInput_Filesystem = function (aMap) {
	if (isObject(aMap)) {
		this.params = aMap;
		if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Server status/Filesystem";
	} else {
		this.params = {};
	}
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

		for (var i in linesSpace) {
			if (linesSpace[i].match(new RegExp("^" + vname))) {
				var line = linesSpace[i].split(/\s+/);
				space = {
					"total": line[1],
					"free": line[2],
					"used": line[3],
					"perc": line[4]
				};
			}
		}

		for (var i in linesINode) {
			if (linesINode[i].match(new RegExp("^" + vname))) {
				var line = linesINode[i].split(/\s+/);
				inode = {
					"total": line[1],
					"free": line[2],
					"used": line[3],
					"perc": line[4]
				};
			}
		}

		dfs.push({
			"Volume": vname,
			"Total space": space.total,
			"Used space": space.free,
			"Free space": space.used,
			"% Used space": space.perc,
			"Total inode": inode.total,
			"Used inode": inode.free,
			"Free inode": inode.used,
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
				var v = $ch(this.params.chKeys).get({ key: this.params.keys[i] });
				v = __nam_getSec(v);
				
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
						throw "Couldn't create a valid Kube object.";
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
							resSpace = String( k.exec(v.namespace, pod, "df -P") );
							resINode = String( k.exec(v.namespace, pod, "df -i -P") );

							var rr = parent.__parseCmd(resSpace, resINode).map(r => {
								var res = { key: parent.params.keys[i], pod: pod };
								return merge(res, r);
							});
							ddfs = ddfs.concat(rr);
						} catch(e) {
							logErr("nInput_Filesystem | Error on namespace '"+ v.namespace + "', pod '" + pod + "': " + String(e));
						}
					})

					break;
				case "ssh":
				default   :
					// Default SSH
					nattrmon.useObject(this.params.keys[i], (ssh) => {
						resSpace = ssh.exec("df -P");
						resINode = ssh.exec("df -i -P");
					});
					var rr = this.__parseCmd(resSpace, resINode).map(r => {
						var res = { key: this.params.keys[i] };
						return merge(res, r);
					});
					ddfs = ddfs.concat(rr);
				}
			}

			if (this.params.keys.length == 1 && ddfs.length == 1) {
				attrname = templify(this.params.attrTemplate, {
					name: this.name,
					key: this.params.keys[0]
				});
				ddfs = ddfs[0].result;
			} else {
				attrname = templify(this.params.attrTemplate, {
					name: this.name
				});
			}

			ret[attrname] = ddfs;
		} else {
			resSpace = sh("df -P");
			resINode = sh("df -i -P");

			ddfs = this.__parseCmd(resSpace, resINode);
			
			ret[templify(this.params.attrTemplate)] = ddfs;
		}

	} catch (e) {
		logErr("Error executing command: " + e.message);
	}

	return ret;
};
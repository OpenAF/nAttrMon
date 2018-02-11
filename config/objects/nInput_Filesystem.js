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

	nInput.call(this, this.input);
};
inherit(nInput_Filesystem, nInput);

nInput_Filesystem.prototype.__parseCmd = function (resSpace, resINode) {
	var dfs = [];
	var linesSpace = resSpace.split(/\n/);
	var linesINode = resINode.split(/\n/);

	for (var j in this.params.volumeNames) {
		var vname = this.params.volumeNames[j];
		var space;
		var inode;

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
	var dfs = [];
	var ret = {};

	try {
		var resSpace, resINode;

		if (isDef(this.params.chKeys) || isDef(this.params.keys)) {
			if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

			for (var i in this.params.keys) {
				nattrmon.useObject(this.params.keys[i], (ssh) => {
					resSpace = ssh.exec("df -P");
					resINode = ssh.exec("df -i -P");
				});
				dfs.push({
					key: this.params.keys[i],
					result: this.__parseCmd(resSpace, resINode)
				});
			}

			if (this.params.keys.length == 1) {
				attrname = templify(this.params.attrTemplate, {
					name: this.name,
					key: this.params.keys[0]
				});
				dfs = dfs[0].result;
			} else {
				attrname = templify(this.params.attrTemplate, {
					name: this.name
				});
			}

			ret[attrname] = dfs;
		} else {
			resSpace = sh("df -P");
			resINode = sh("df -i -P");

			dfs = this.__parseCmd(resSpace, resINode);
			
			ret[templify(this.params.attrTemplate)] = dfs;
		}

	} catch (e) {
		logErr("Error executing command: " + e.message);
	}

	return ret;
};
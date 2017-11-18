/**
 * <odoc>
 * <key>nattrmon.nInput_Filesystem(aMap)</key>
 * Gathers filesystem information (total, used and free storage space + total, used, free inode usage) per operating system volume using
 * the unix "df" command. On can provide on aMap:\
 * \
 *    - volumeNames (an array of strings with the device volumes on the unix operating system)\
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

nInput_Filesystem.prototype.input = function (scope, args) {
	var dfs = [];
	var ret = {};

	try {
		var resSpace = af.sh("df -P");
		var resINode = af.sh("df -i -P");

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

	} catch (e) {
		logErr("Error executing command: " + e.message);
	}

	ret[templify(this.params.attrTemplate)] = dfs;

	return ret;
};
nInput_Filesystem = function(volumeNames, attributePrefix) {
	this.volumenames = volumeNames;
        this.attributePrefix = (isUndefined(attributePrefix)) ? "Server status/Filesystem" : attributePrefix;
	
	nInput.call(this, this.input);
}
inherit(nInput_Filesystem, nInput);

nInput_Filesystem.prototype.input = function(scope, args) {
	var dfs = [];
	var ret = {};

	try {
		var resSpace = af.sh("df -P");
                var resINode = af.sh("df -i -P");

		var linesSpace = resSpace.split(/\n/);
		var linesINode = resINode.split(/\n/);

		for(j in this.volumenames) {
			var vname = this.volumenames[j];
			var space;
			var inode;

			for(i in linesSpace) {
				if (linesSpace[i].match(new RegExp("^" + vname))) {
					var line = linesSpace[i].split(/\s+/);
					space = { "total": line[1], "free": line[2], "used": line[3], "perc": line[4] };
				}
			}

			for(i in linesINode) {
				if (linesINode[i].match(new RegExp("^" + vname))) {
					var line = linesINode[i].split(/\s+/);
					inode = { "total": line[1], "free": line[2], "used": line[3], "perc": line[4] };
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
		
	} catch(e) {
		logErr("Error executing command: " + e.message);
	}

	ret[this.attributePrefix] = dfs;

	return ret;
}

//var nnn = new nInput_Filesystem(["/dev/mapper/vg_rd8tnsapp01-lv_root"]);
//print(beautifier(nnn.input()));

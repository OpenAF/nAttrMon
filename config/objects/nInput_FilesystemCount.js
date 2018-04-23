/**
 * <odoc>
 * <key>nattrmon.nInput_FilesystemCount(aMap) : nInput</key>
 * aMap is composed of:\
 *    - chFolders (a channel name for the folders map info)\
 *    - attrTemplate (a template for the name of the attribute)\
 *    - folders (an array of folders map info)\
 *    - keys (a map with a SSH key or array of maps with SSH keys)\
 *    - chKeys (a channel with similar maps as keys)\
 * \
 * Folders Map Info Example:\
 *    - name   : Folder 1\
 *      folder : /my/folder/1\
 *      pattern: .* 
 * </odoc>
 */
var nInput_FilesystemCount = function(aMap) {
	if (isObject(aMap)) {
		this.params = aMap;

		if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Filesystem/Count";

		this.foldersandpatterns = this.params.folders;
		this.chFolders = this.params.chFolders;
	} else {
		this.params = {};
	}
	
	nInput.call(this, this.input);
};
inherit(nInput_FilesystemCount, nInput);

nInput_FilesystemCount.prototype.__parse = function(isLocal, ssh) {
	var ret = [];
	if (isDef(this.chFolders)) this.foldersandpatterns = $ch(this.chFolders).getAll();

	for (var i in this.foldersandpatterns) {
		var item = this.foldersandpatterns[i];

		try {
			var list;
			if (isLocal) {
				list = io.listFiles(item.folder).files;
			} else {
				list = ssh.listFiles(item.folder).files;
			}
			var minSize = void 0;
			var maxSize = void 0;
			var newModify = void 0;
			var oldModify = void 0;
			var totalSize = 0;
			var totalCount = 0;

			for (var j in list) {
				if (list[j].isFile &&
					list[j].filename.match(new RegExp(item.pattern))) {
					if (isUnDef(minSize) || list[j].size < minSize) minSize = list[j].size;
					if (isUnDef(maxSize) || list[j].size > maxSize) maxSize = list[j].size;
					if (isUnDef(oldModify) || list[j].lastModified < oldModify) oldModify = list[j].lastModified;
					if (isUnDef(newModify) || list[j].lastModified > newModify) newModify = list[j].lastModified;
					totalSize += list[j].size;
					totalCount++;
				}
			}

			ret.push({
				"Name": item.name,
				"Total Count": totalCount,
				"Total Size": (isUnDef(totalSize)) ? "n/a" : totalSize,
				"Min size": (isUnDef(minSize)) ? "n/a" : minSize,
				"Max size": (isUnDef(maxSize)) ? "n/a" : maxSize,
				"Avg size": (isUnDef(totalSize)) ? "n/a" : Math.round(totalSize / totalCount),
				"Newest": (isUnDef(newModify)) ? "n/a" : new Date((isLocal) ? newModify : ow.format.fromUnixDate(newModify)),
				"Oldest": (isUnDef(oldModify)) ? "n/a" : new Date((isLocal) ? oldModify : ow.format.fromUnixDate(oldModify))
			});
		} catch (e) {
			logErr("Error listing files on " + item.folder + " for " + this.attributename + " - " + e.message);
		}
	}
	return ret;
};

nInput_FilesystemCount.prototype.input = function (scope, args) {
	var ret = [];
	var attr = {};

	if (isDef(this.params.chKeys) || isDef(this.params.keys)) {
		if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();
		for (var i in this.params.keys) {
			nattrmon.useObject(this.params.keys[i], (ssh) => {
				ret.push({
					key: this.params.keys[i],
					result: this.__parse(false, ssh)
				});
			});
		}

		if (this.params.keys.length == 1) {
			attrname = templify(this.params.attrTemplate, {
				name: this.name,
				key: this.params.keys[0]
			});
			ret = ret[0].result;
		} else {
			attrname = templify(this.params.attrTemplate, {
				name: this.name
			});
		}

		attr[attrname] = ret;
	} else {
		ret = this.__parse(true);

		attr[templify(this.params.attrTemplate)] = ret;
	}

	return attr;
};
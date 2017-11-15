/**
 * <odoc>
 * <key>nattrmon.nInput_FilesystemCount(aMap) : nInput</key>
 * aMap is composed of:\
 *    - chFolders (a channel name for the folders map info)\
 *    - attrTemplate (a template for the name of the attribute)\
 *    - folders (an array of folders map info)\
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
};

nInput_FilesystemCount.prototype.exec = function (scope, args) {
	var ret = [];
	var attr = {};

	if (isDef(this.chFolders)) this.foldersandpatterns = $ch(this.chFolders).getAll();

	for (var i in this.foldersandpatterns) {
		var item = this.foldersandpatterns[i];

		try {
			var list = io.listFiles(item.folder).files;
			var minSize = undefined;
			var maxSize = undefined;
			var newModify = undefined;
			var oldModify = undefined;
			var totalSize = 0;
			var totalCount = 0;

			for (var j in list) {
				if (list[j].isFile &&
					list[j].filename.match(new RegExp(item.pattern))) {
					if (isUndefined(minSize) || list[j].size < minSize) minSize = list[j].size;
					if (isUndefined(maxSize) || list[j].size > maxSize) maxSize = list[j].size;
					if (isUndefined(oldModify) || list[j].lastModified < oldModify) oldModify = list[j].lastModified;
					if (isUndefined(newModify) || list[j].lastModified > newModify) newModify = list[j].lastModified;
					totalSize += list[j].size;
					totalCount++;
				}
			}

			ret.push({
				"Name": item.name,
				"Total Count": totalCount,
				"Total Size": (isUndefined(totalSize)) ? "n/a" : totalSize,
				"Min size": (isUndefined(minSize)) ? "n/a" : minSize,
				"Max size": (isUndefined(maxSize)) ? "n/a" : maxSize,
				"Avg size": (isUndefined(totalSize)) ? "n/a" : Math.round(totalSize / totalCount),
				"Newest": (isUndefined(newModify)) ? "n/a" : new Date(newModify),
				"Oldest": (isUndefined(oldModify)) ? "n/a" : new Date(oldModify)
			});
		} catch (e) {
			logErr("Error listing files on " + item.folder + " for " + this.attributename + " - " + e.message);
		}
	}

	attr[templify(this.params.attrTemplate)] = ret;
	return attr;
};

/**
 */
var nOutput_DSV = function(aMap) {
	if (isUnDef(aMap) || !isObject(aMap)) aMap = {};
	this.afilename = (isUnDef(aMap.filename)) ? "nattrmon.csv" : aMap.filename;
	this.lastTime = {};

	this.headerTemplate = (isUnDef(aMap.headerTemplate)) ? void 0 : aMap.headerTemplate;
	this.outputTemplate = (isUnDef(aMap.outputTemplate)) ? "Please define an outputTemplate." : aMap.outputTemplate;

	this.afolder = (isUnDef(aMap.folder)) ? void 0 : aMap.folder;
	this.filenameTemplate = (isUnDef(aMap.filenameTemplate)) ? "{{timedate}}.csv" : aMap.filenameTemplate;
	this.afiletemp = (isUnDef(aMap.fileDateFormat)) ? "yyyy-MM-dd" : aMap.fileDateFormat;
	this.afilepatt = (isUnDef(aMap.backupFilenameTemplate)) ? "\\d{4}-\\d{2}-\\d{2}\\.csv" : aMap.backupFilenameTemplate;
    this.howLongAgoInMinutes = (isUnDef(aMap.howLongAgoInMinutes)) ? 7200 : aMap.howLongAgoInMinutes;
	this.dontCompress = (isUnDef(aMap.dontCompress)) ? false : aMap.dontCompress;

	this.idKey = (isUnDef(aMap.idKey)) ? "name" : aMap.idKey;

	this.include = aMap.include;
	this.exclude = aMap.exclude;

	if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";

	nOutput.call(this, this.output);
};
inherit(nOutput_DSV, nOutput);

/**
 */
nOutput_DSV.prototype.output = function(scope, args) {
	if (args.op == "set") {
		if (isDef(this.include) || isDef(this.exclude)) {
			var k = ow.obj.getPath(args.k, this.idKey);

			if ((isDef(this.include) && this.include.indexOf(k) < 0) || 
				(isDef(this.exclude) && this.exclude.indexOf(k) >= 0 )) return;
		}
	} else {
		if (args.op == "setall" && (isDef(this.include) || isDef(this.exclude))) {
			throw "Setall/Buffer channel subscription not supported with include/exclude arguments.";
		}
	}

	var newd = new Date();

	var makeLine = (data) => {
		return templify(this.outputTemplate, data);
	};

	var makeHeader = (data) => {
		return templify(this.headerTemplate, data);
	};

	var writeLine = (line) => {
		if (isUnDef(this.afolder)) {
			io.writeFileString(this.afilename, line + "\n", void 0, true);
		} else {
			var f = this.afolder + "/" + templify(this.filenameTemplate, {
				timedate: ow.format.fromDate(newd, this.afiletemp)
			});
			io.writeFileString(f, line + "\n", void 0, true);
		}
	};

	if (isDef(this.afolder)) {
		io.mkdir(this.afolder);
		var listFilesFolder = io.listFiles(this.afolder).files;

		var donttouch = $from(listFilesFolder)
			.equals("isFile", true)
			.match("filename", new RegExp(this.afilepatt))
			.notEnds("filename", ".gz")
			.sort("-lastModified")
			.first();

		if (isDef(donttouch)) donttouch = donttouch.filename;

		// Search files for compression
		if (!this.dontCompress) {
			$from(listFilesFolder)
				.notEquals("filename", donttouch)
				.notEnds("filename", ".gz")
				.match("filename", new RegExp(this.afilepatt))
				.select((r) => {
					ioStreamCopy(io.writeFileGzipStream(this.afolder + "/" + r.filename + ".gz"),
						io.readFileStream(r.filepath));
					io.rm(r.filepath);
				});
		}

		// Delete files from backup folder
		if (isDef(this.howLongAgoInMinutes)) {
			$from(io.listFiles(this.afolder).files)
				.notEquals("filename", donttouch)
				.match("filename", new RegExp(this.afilepatt + "\\.gz$"))
				.less("createTime", new Date() - (this.howLongAgoInMinutes * 60 * 1000))
				.select((r) => {
					io.rm(r.filepath);
				});
		}
	}

	var data = {
		datetime: newd,
        values: scope.getCurrentValues(),
        warnings: scope.getWarnings(),
        lastvalues: scope.getLastValues(),
        attributes: ow.obj.fromArray2Obj(scope.getAttributes(true), "name", true)
    };

	if (isDef(this.headerTemplate)) {
		if (isDef(this.afolder)) {
			var f = this.afolder + "/" + templify(this.filenameTemplate, {
				timedate: ow.format.fromDate(newd, this.afiletemp)
			});
			if (!io.fileExists(f)) {
				writeLine(makeHeader(data));
			}
		} else {
			if (!io.fileExists(this.afilename)) {
				writeLine(makeHeader(data));
			}
		}
	}

	writeLine(makeLine(data));
};
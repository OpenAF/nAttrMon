// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_NDJson(aMap)</key>
 * Outputs cvals, lvals or warnings as ndjson files.
 * </odoc>
 */
var nOutput_NDJson = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap
    } else {
        this.params = {}
    }

    if (isUnDef(aMap) || !isObject(aMap)) aMap = {}
    this.lastTime = {}

    this.folder                 = _$(aMap.folder, "folder").isString().default("output_ndjson")
    this.dontCompress           = _$(aMap.dontCompress, "dontCompress").isBoolean().default(false)
    this.filenameTemplate       = _$(aMap.filenameTemplate, "filenameTemplate").isString().default("{{timedate}}.ndjson")
    this.fileDateFormat         = _$(aMap.fileDateFormat, "fileDateFormat").isString().default("yyyy-MM-dd") 
    this.backupFilenameTemplate = _$(aMap.backupFilenameTemplate, "backupFilenameTemplate").isString().default("\\d{4}-\\d{2}-\\d{2}\\.ndjson")
    this.howLongAgoInMinutes    = _$(aMap.howLongAgoInMinutes, "howLongAgoInMinutes").isNumber().default(7200)

    this.includeValues  = _$(aMap.includeValues, "includeValues").isBoolean().default(true)
    this.includeWarns   = _$(aMap.includeWarns, "includeWarns").isBoolean().default(false)
    this.includeLValues = _$(aMap.includeLValues, "includeLValues").isBoolean().default(false)
    this.includeAttrs   = _$(aMap.includeAttrs, "includeAttrs").isBoolean().default(false)

    this.include = aMap.include
	this.exclude = aMap.exclude

    if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array"
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array"
	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true

    nOutput.call(this, this.output)
};
inherit(nOutput_NDJson, nOutput)

nOutput_NDJson.prototype.output = function(scope, args) {
	if (args.op != "setall" && args.op != "set") return
	if (args.op == "setall" && !this.considerSetAll) return

	var k, v, ch = args.ch
	if (args.op == "set") {
		k = [args.k]
		v = [args.v]
	} else {
		k = args.k
		v = args.v
	}

    var newd = new Date()

    var writeLine = data => {
        var f = this.folder + "/" + templify(this.filenameTemplate, {
            timedate: ow.format.fromDate(newd, this.fileDateFormat)
        })

        io.writeFileString(f, stringify(data, __, "") + "\n", __, true)
    }

    v.forEach(value => {
		var isok = isDef(this.include) ? false : true
		var isWarns = (ch == "nattrmon::warnings" || ch == "nattrmon::warnings::buffer")
		var kk = (isWarns) ? value.title : value.name

        if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0
        if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0
        if (isok) {
            var newd = new Date()

            io.mkdir(this.folder)
            var listFilesFolder = io.listFiles(this.folder).files

            var donttouch = $from(listFilesFolder)
                            .equals("isFile", true)
                            .match("filename", new RegExp(this.backupFilenameTemplate))
                            .notEnds("filename", ".gz")
                            .sort("-lastModified")
                            .first()

            if (isDef(donttouch)) donttouch = donttouch.filename

            // Search files for compression
            if (!this.dontCompress) {
                $from(listFilesFolder)
				.notEquals("filename", donttouch)
				.notEnds("filename", ".gz")
				.match("filename", new RegExp(this.backupFilenameTemplate))
				.select(r => {
					ioStreamCopy(io.writeFileGzipStream(this.folder + "/" + r.filename + ".gz"), io.readFileStream(r.filepath))
					io.rm(r.filepath)
				})
            }

            // Delete files from backup folder
            if (isDef(this.howLongAgoInMinutes)) {
                $from(io.listFiles(this.folder).files)
                    .notEquals("filename", donttouch)
                    .match("filename", new RegExp(this.backupFilenameTemplate + "\\.gz$"))
                    .less("createTime", new Date() - (this.howLongAgoInMinutes * 60 * 1000))
                    .select((r) => {
                        io.rm(r.filepath)
                    })
            }
        }

        var data = {
            datetime  : newd,
            values    : this.includeValues ? scope.getCurrentValues() : __,
            warnings  : this.includeWarns ? scope.getWarnings() : __,
            lastvalues: this.includeLValues ? scope.getLastValues() : __,
            attributes: this.includeAttrs ? ow.obj.fromArray2Obj(scope.getAttributes(true), "name", true) : __
        }

        writeLine(data)
    })
}
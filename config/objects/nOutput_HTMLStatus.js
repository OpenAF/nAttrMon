/**
 * Author: Nuno Aguiar
 */
 var nOutput_HTMLStatus = function(aMap) {
	if (isUnDef(aMap) || !isObject(aMap)) aMap = {}; 

    this.file           = _$(aMap.file, "file").isString().$_();
    this.path           = isDef(aMap.path) ? aMap.path : io.fileInfo(nattrmon.getConfigPath()).canonicalPath;
    this.levelsIncluded = _$(aMap.levelsIncluded, "levelsIncluded").isArray().default([ "HIGH", "MEDIUM", "LOW", "INFO"]);
    this.redLevels      = _$(aMap.redLevels, "redLevels").isArray().default(["HIGH"]);
    this.yellowLevels   = _$(aMap.yellowLevels, "yellowLevels").isArray().default(["MEDIUM"]);
    this.greenLevels    = _$(aMap.greenLevels, "greenLevels").isArray().default(["LOW", "INFO"]);
    this.controls       = _$(aMap.controls, "controls").isArray().default(__);

    this.levelsIncluded = this.levelsIncluded.map(r => r.toUpperCase());
    this.redLevels      = this.redLevels.map(r => r.toUpperCase());
    this.yellowLevels   = this.yellowLevels.map(r => r.toUpperCase());
    this.greenLevels    = this.greenLevels.map(r => r.toUpperCase());

	nOutput.call(this, this.output);
};
inherit(nOutput_HTMLStatus, nOutput);

/**
 */
nOutput_HTMLStatus.prototype.output = function(scope, args) {
    var warns = [];
    var data = scope.getWarnings();
    
    Object.keys(data).forEach(l => {
        switch(l.toUpperCase()) {
        case "HIGH"  : warns = warns.concat(data[nWarning.LEVEL_HIGH]); break;
        case "MEDIUM": warns = warns.concat(data[nWarning.LEVEL_MEDIUM]); break;
        case "LOW"   : warns = warns.concat(data[nWarning.LEVEL_LOW]); break;
        case "INFO"  : warns = warns.concat(data[nWarning.LEVEL_INFO]); break;
        case "CLOSED": warns = warns.concat(data[nWarning.LEVEL_CLOSED]); break;
        }
    });

    var cwarns = [];
    if (isUnDef(this.controls)) {
        cwarns = warns;
    } else {
        this.controls.forEach(ctl => {
            warns.forEach(l => {
                if (l.title.match(new RegExp(ctl))) {
                    cwarns.push(l);
                }
            });
        });
    }
                  
    var apath = this.path + "/objects.assets/noutputstatus";
    var red = io.readFileString(apath + "/red.md");
    var yellow = io.readFileString(apath + "/yellow.md");
    var green = io.readFileString(apath + "/green.md");

    var out = $from(cwarns)
              .sort("title")
              .select(r => {
                var status = green;
                if (this.greenLevels.indexOf(r.level.toUpperCase()) >= 0)  status = green; 
                if (this.yellowLevels.indexOf(r.level.toUpperCase()) >= 0) status = yellow; 
                if (this.redLevels.indexOf(r.level.toUpperCase()) >= 0)    status = red;
                return {
                    control: r.title,
                    status : status
                };
              });

    var md = templify(io.readFileString(apath + "/status.md"), {
        statuses: out,
        date    : (new Date()).toISOString()
    })
    io.writeFileString(this.file, ow.template.html.genStaticVersion4MD(md));
};
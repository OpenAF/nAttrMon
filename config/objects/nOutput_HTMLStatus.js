/**
 * Author: Nuno Aguiar
 */
 var nOutput_HTMLStatus = function(aMap) {
	if (isUnDef(aMap) || !isObject(aMap)) aMap = {};

    this.file           = _$(aMap.file, "file").isString().$_();
    this.levelsIncluded = _$(aMap.levelsIncluded, "levelsIncluded").isArray().default([ "HIGH", "MEDIUM", "LOW"]);

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
    })
    
    var out = $from(warns)
              .select(r => ({
                Issue: r.title,
                Level: r.level
              }));
              
    var html = ow.template.html.parseMap(out, true);
    io.writeFileString(this.file, templify("<html><head><style>{{{css}}}</style></head><body>{{{out}}}</body></html>", html));
};
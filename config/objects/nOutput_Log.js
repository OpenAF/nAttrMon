
/**
 * [nOutput_Log description]
 * @param  {[type]} scope [description]
 * @return {[type]}       [description]
 */
var nOutput_Log = function(aFileName) {
	this.afilename = (isUndefined(aFileName)) ? "nattrmon.log" : aFileName;
	this.firstTime = {};

	nOutput.call(this, this.output);
}
inherit(nOutput_Log, nOutput);

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_Log.prototype.output = function(scope, args) {
	var stuffdone = false;

	for(key in scope.getCurrentValues()) {
		var attribute = scope.getCurrentValues()[key];
		var last = scope.getLastValues()[key];

		if((args.onlyOnEvent && this.see(key, attribute)) || isUndefined(this.firstTime[key])) {
			// THIS MAY CAUSE MEMORY ISSUES IN THE FUTURE :(
			var lines = [];
			try {
				lines = af.readFileAsArray(this.afilename);
			} catch(e) {
				if(!e.message.match(/FileNotFoundException/)) {
					logErr("Error while reading file: " + e.message);
				}
			}
			lines.push(attribute.getDate() + " | " + key + " | " + attribute.getValueString());
			af.writeFileAsArray(this.afilename, lines);
			this.firstTime[key] = true;
		}
	}
}
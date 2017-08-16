
/**
 * [nOutput_Stdout description]
 * @param  {[type]} scope [description]
 * @return {[type]}       [description]
 */
var nOutput_Stdout = function() {
	this.firstTime = {};

	nOutput.call(this, this.output);
}
inherit(nOutput_Stdout, nOutput);

/**
 * [exec description]
 * @param  {[type]} scope [description]
 * @param  {[type]} args  [description]
 * @return {[type]}       [description]
 */
nOutput_Stdout.prototype.output = function(scope, args) {
	var stuffdone = false;

	for(key in scope.getCurrentValues()) {
		var attribute = scope.getCurrentValues()[key];
		var last = scope.getLastValues()[key];

		if( (args.onlyOnEvent && this.see(key, attribute)) || isUndefined(this.firstTime[key])) {
			print(attribute.getDate() + " | " + key + " | " + attribute.getValueString());
			this.firstTime[key] = true;
		}
	}
}
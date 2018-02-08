/**
 * <odoc>
 * <key>nattrmon.nValidation_AFPing(aMap)</key>
 * Creates a nattrmon validation for AFPing. On aMap you can provide:\
 *    - attrPattern       (a regular expression to determine the attributes for which to alarm on (defaults to 'Server status/Ping'))\
 *    - warnTitleTemplate (a template for the warning title using Name if avaiable on the attribute)\
 *    - warnDescTemplate  (a template for the warning description using Name if available on the attribute)\
 * \
 * </odoc>
 */
var nValidation_AFPing = function(aMap) {
	if (isUnDef(aMap)) {
		this.params = {};
	} else {
		this.params = aMap;
	}

	if (isUnDef(this.params.attrPattern))       this.params.attrPattern       = "Server status/Ping";
	if (isUnDef(this.params.warnTitleTemplate)) this.params.warnTitleTemplate = "RAID {{Name}} down";
	if (isUnDef(this.params.warnDescTemplate))  this.params.warnDescTemplate  = "An AF ping to the {{Name}} RAID server failed. The server could be down or not responsive. Check the server status and restart if needed.";

	nValidation.call(this, this.validate);
};
inherit(nValidation_AFPing, nValidation);

nValidation_AFPing.prototype.validate = function(warns, scope, args) {
	var ret = [];

	if (isDef(args.k) && isDef(args.k.name)) {
		var createWarns = (val, data) => {
			if (isDef(val) && (val.Alive == false || val == false)) {
				ret.push(new nWarning(nWarning.LEVEL_HIGH, 
						 templify(this.params.warnTitleTemplate, data), 
						 templify(this.params.warnDescTemplate, data)));
			} else {
				if (val) this.closeWarning(templify(this.params.warnTitleTemplate, data));
			}
		};

		if (args.k.name.match(new RegExp(this.params.attrPattern))) {
			if (isArray(args.v.val)) {
				for(var i in args.v.val) {
					createWarns(args.v.val[i], args.v.val[i]);
				}
			} else {
				createWarns(args.v.val, {});
			}
		}
	}
	return ret;
};
/**
 * <odoc>
 * <key>nattrmon.nValidation_AFPing(anMonitoredAFObjectKey, aPingAttribute, aWarningName, aWarningDesc)</key>
 * Creates a nattrmon validation for AFPing. You should provide anMonitoredAFObjectKey and, optionally, aPingAttribute, aWarningName and aWarningDesc
 * </odoc>
 */
var nValidation_AFPing = function(anMonitoredAFObjectKey, aPingAttribute, aWarningName, aWarningDesc) {
	if (nattrmon.isObjectPool(anMonitoredAFObjectKey)) {
		this.objectPoolKey = anMonitoredAFObjectKey;
		this.monitoredObjectKey = anMonitoredAFObjectKey; // just for reference
	} else {
		this.monitoredObjectKey = anMonitoredAFObjectKey;
		if (nattrmon.hasMonitoredObject(anMonitoredAFObjectKey))
			this.server = nattrmon.getMonitoredObject(anMonitoredAFObjectKey);
		else
			throw "Key " + anMonitoredAFObjectKey + " not found.";
	}

/*	
	this.pingattribute = (isUndefined(aPingAttribute)) ? "Server status/{{name}} alive" : aPingAttribute;
	this.warningname = (isUndefined(aWarningName)) ? "Server {{name}} down!" : aWarningName;
	this.warningdesc = (isUndefined(aWarningDesc)) ? "A AF ping to the {{name}} server failed. Server could be down or not responsive. Check the server status and restart if needed." : aWarningDesc;
	
	this.pingattribute = ow.template.getTemplate(this.pingattribute);
	this.warningname   = ow.template.getTemplate(this.warningname);
	this.warningdesc   = ow.template.getTemplate(this.warningdesc);

*/

	this.pingattribute = (isUndefined(aPingAttribute)) ? "Server status/" + anMonitoredAFObjectKey + " alive" : aPingAttribute;
    this.warningname = (isUndefined(aWarningName)) ? "Server " + anMonitoredAFObjectKey + " down!" : aWarningName;
    this.warningdesc = (isUndefined(aWarningDesc)) ? "A AF ping to the " + anMonitoredAFObjectKey + " server failed. Server could be down or not responsive. Check the server status and restart if needed." : aWarningDesc;


	nValidation.call(this, this.validate);
}
inherit(nValidation_AFPing, nValidation);

nValidation_AFPing.prototype.validate = function(warns, scope, args) {
	var ret = [];

	//sprint("[DEBUG] this.pingattribute: "+this.pingattribute);
	//sprint("[DEBUG] scope.getCurrentValues()[this.pingattribute]: "+ scope.getCurrentValues()[this.pingattribute])

	if (!isUndefined(scope.getCurrentValues()[this.pingattribute]) &&
		scope.getCurrentValues()[this.pingattribute].val == false) {
		ret.push(new nWarning(
				nWarning.LEVEL_HIGH, 
				this.warningname, 
				this.warningdesc
		));
	} else {
		this.closeWarning(this.warningname);
	}

	return ret;
}
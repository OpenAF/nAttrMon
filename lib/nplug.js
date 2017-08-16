var nPlug = function(aInputMeta, args, aObject) {
	this.aName         = (isUndefined(aInputMeta.name)) ? "untitled" : aInputMeta.name;
	this.aCategory     = (isUndefined(aInputMeta.category)) ? "uncategorized" : aInputMeta.category;
	this.aTime         = (isUndefined(aInputMeta.timeInterval)) ? 60000 : aInputMeta.timeInterval;
	this.waitForFinish = (isUndefined(aInputMeta.waitForFinish)) ? true : aInputMeta.waitForFinish;
	this.onlyOnEvent   = (isUndefined(aInputMeta.onlyOnEvent)) ? false : aInputMeta.onlyOnEvent;
	this.aCron         = (isUndefined(aInputMeta.cron)) ? undefined : aInputMeta.cron;
	this.aObject = aObject;
	this.args = args;
}

nPlug.prototype.exec = function(aScope) {
	var argsToSend = {};
	argsToSend.aTime = this.aTime;
	argsToSend.waitForFinish = this.waitForFinish;
	argsToSend.onlyOnEvent = this.onlyOnEvent;
	for (i in this.args) {
		argsToSend[i] = this.args[i];
	}
	return this.aObject.exec(aScope, argsToSend, this);
}

nPlug.prototype.close = function() {
	try {
		this.aObject.close();
	} catch(e) {
		return e;
	}
}

nPlug.prototype.getName = function() { return this.aName; }
nPlug.prototype.getCategory = function() { return this.aCategory; }
nPlug.prototype.getTime = function() { return this.aTime; }
nPlug.prototype.getWaitForFinish = function() { return this.waitForFinish; }
nPlug.prototype.getOnlyOnEvent = function() { return this.onlyOnEvent; }
nPlug.prototype.getCron = function() { return this.aCron; }

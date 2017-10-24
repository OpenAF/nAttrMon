var nPlug = function(aInputMeta, args, aObject) {
	this.aName         = (isUnDef(aInputMeta.name)) ? "untitled" : aInputMeta.name;
	this.aCategory     = (isUnDef(aInputMeta.category)) ? "uncategorized" : aInputMeta.category;
	this.aTime         = (isUnDef(aInputMeta.timeInterval)) ? -1 : aInputMeta.timeInterval;
	this.waitForFinish = (isUnDef(aInputMeta.waitForFinish)) ? true : aInputMeta.waitForFinish;
	this.onlyOnEvent   = (isUnDef(aInputMeta.onlyOnEvent)) ? false : aInputMeta.onlyOnEvent;
	this.aCron         = (isUnDef(aInputMeta.cron)) ? undefined : aInputMeta.cron;
	this.type          = (isUnDef(aInputMeta.type)) ? "system" : aInputMeta.type;
	this.aObject = aObject;
	this.args = args;
}

nPlug.prototype.exec = function(aScope) {
	var argsToSend = {};
	argsToSend.aTime = this.aTime;
	argsToSend.waitForFinish = this.waitForFinish;
	argsToSend.onlyOnEvent = this.onlyOnEvent;
	for (var i in this.args) {
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

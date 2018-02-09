var nPlug = function(aInputMeta, args, aObject) {
	this.aName         = (isUnDef(aInputMeta.name)) ? "untitled" : aInputMeta.name;
	this.type          = (isUnDef(aInputMeta.type)) ? "system" : aInputMeta.type;
	this.aCategory     = (isUnDef(aInputMeta.category)) ? "uncategorized" : aInputMeta.category;
	this.aCron         = (isUnDef(aInputMeta.cron)) ? void 0 : aInputMeta.cron;
	this.chSubscribe   = (isUnDef(aInputMeta.chSubscribe)) ? void 0: aInputMeta.chSubscribe;
	this.aTime         = (isUnDef(aInputMeta.timeInterval)) ? -1 : aInputMeta.timeInterval;
	this.waitForFinish = (isUnDef(aInputMeta.waitForFinish)) ? true : aInputMeta.waitForFinish;
	this.onlyOnEvent   = (isUnDef(aInputMeta.onlyOnEvent)) ? false : aInputMeta.onlyOnEvent;
	this.help          = (isUnDef(aInputMeta.help)) ? void 0 : aInputMeta.help;
	this.created       = new Date();
	this.aObject = aObject;
	this.args = args;

	this.chPlugs = "nattrmon::plugs";
	$ch(this.chPlugs).create();
	this.touch();

	if (isDef(this.help) && isObject(this.help)) {
		for(var attr in this.help) {
			nattrmon.setAttribute(attr, this.help[attr]);
		}
	}
}

/**
 * <odoc>
 * <key>nattrmon.getCh() : Channel</key>
 * Retrieves the current openaf channel for plugs.
 * </odoc>
 */
nPlug.prototype.getCh = function() {
	return $ch(this.chPlugs);
}

nPlug.prototype.exec = function(aScope, extraArgs) {
	var argsToSend = {};
	argsToSend.aTime = this.aTime;
	argsToSend.waitForFinish = this.waitForFinish;
	argsToSend.onlyOnEvent = this.onlyOnEvent;
	for (var i in this.args) {
		argsToSend[i] = this.args[i];
	}
	argsToSend = merge(argsToSend, extraArgs);
	return this.aObject.exec(aScope, argsToSend, this);
}

nPlug.prototype.close = function() {
	try {
		this.aObject.close();
	} catch(e) {
		return e;
	}
}

nPlug.prototype.touch = function() {
	$ch(this.chPlugs).set({ 
		name: this.aName
	}, { 
		meta: {
			name: this.aName,
			type: this.type,
			category: this.aCategory,
			cron: this.aCron,
			chSubscribe: this.chSubscribe,
			timeInterval: this.aTime,
			waitForFinish: this.waitForFinish,
			onlyOnEvent: this.onlyOnEvent
		},
		args: this.args, 
		last: new Date(),
		created: this.created
	});
}

nPlug.prototype.getName = function() { return this.aName; }
nPlug.prototype.getCategory = function() { return this.aCategory; }
nPlug.prototype.getTime = function() { return this.aTime; }
nPlug.prototype.getWaitForFinish = function() { return this.waitForFinish; }
nPlug.prototype.getOnlyOnEvent = function() { return this.onlyOnEvent; }
nPlug.prototype.getCron = function() { return this.aCron; }

/**
 * [nWarning description]
 * @param  {[type]} aLevel       [description]
 * @param  {[type]} aTitle       [description]
 * @param  {[type]} aDescription [description]
 * @return {[type]}              [description]
 */
var nWarning = function(aLevel, aTitle, aDescription, healingArgs) {
	if (isObject(aLevel)) {
		this.setData(aLevel);
	} else {
		this.level 		 = aLevel;
		this.title 		 = aTitle;
		this.description = aDescription;
		this.lastupdate  = new Date();
		this.createdate  = new Date();
		this.category    = this.getFolders();
		this.notified    = {};
		this.simpletitle = this.getSimpleTitle();
		this.healingArgs = this.setHealing(healingArgs);
	}
};

nWarning.LEVEL_HIGH   = "High";
nWarning.LEVEL_MEDIUM = "Medium";
nWarning.LEVEL_LOW    = "Low";
nWarning.LEVEL_INFO   = "Info";
nWarning.LEVEL_CLOSED = "Closed";

nWarning.prototype.setHealing = function(__args) {
	if (isUnDef(__args) || !isObject(__args)) return {};
	if (isUnDef(__args.__executed)) __args.__executed = false;

	var parent = this;
	sync(() => {
		__args = merge(nattrmon.getWarnings(true).getHealArgs(), __args);
		sprint(__args);
		var ex = (isDef(__args) && __args.__executed && __args.__uuid) ? true : false;
		if (!ex) {
			var execute = true, executeAt = 0;
			if (now() <= __args.execAt) {
				execute = true;
				executeAt = __args.execAt - now();
			} else {
				if (isDef(__args.execExpire) &&
					(now() <= (__args.execAt + __args.execExpire))) {
					execute = true;
					executeAt = (__args.execAt + __args.execExpire) - now();
				} else {
					execute = false;
				}
			}
	
			print("EXECUTE = " + execute + " -- executeAt " + executeAt);
			if (execute && isUnDef(__args.__uuid)) {
				__args.__uuid = nattrmon.addAdHocExecution(function(uuid) {
					try {
						nattrmon.getWarnings(true).setHealExecuted(parent.title);
						var _args = parent.getHealingArgs();
						if (!(nattrmon.getWarnings(true).getHealExecuted(parent.title))) {
							if (isDef(_args.execOJob)) { }
							if (isDef(_args.execSH))   { }
							if (isDef(_args.exec))     { (new Function('args', _args.exec))(_args.execArgs); }
						}
					} catch(e) {
						logErr("AdHoc execution (" + uuid + ") of " + stringify(parent) + " -- " + String(e));
					}
				}, executeAt);
			}
		}
	});
	
	return clone(__args);
};

nWarning.prototype.getData = function() {
	return {
		"level": this.level,
		"title": this.title,
		"description": this.description,
		"lastupdate": this.lastupdate,
		"createdate": this.createdate,
		"notified": this.notified,
		"category": this.category,
		"simpletitle": this.simpletitle,
		"healingArgs": this.healingArgs
	};
};

// Ensure dates are converted from strings in channels
nWarning.prototype.convertDates = function(aCh, aOp, aK, aV) {
	if((aOp == "set" || aOp == "setall")) {
		var aVs = (aOp == "set") ? [ aV ] : aV;
		var changes = [];
		for(var i in aVs) {
			var v = aVs[i];
			
			if (isUnDef(v.lastupdate)) {
				v.date = new Date(); changes.push(v);
			}

			if (isString(v.lastupdate) && new Date(v.lastupdate) != null) {
				v.lastupdate = new Date(v.lastupdate); changes.push(v);
			}

			if (isUnDef(v.createdate)) {
				v.date = new Date(); changes.push(v);
			}

			if (isString(v.createdate) && new Date(v.createdate) != null) {
				v.createdate = new Date(v.createdate); changes.push(v);
			}
		}
		if (changes.length > 0) {
			$ch(aCh).setAll([ "title" ], changes);
		}
	}
};

nWarning.prototype.setData = function(aStruct) {
	if (isUnDef(aStruct)) return;
	
	this.level = aStruct.level;
	this.title = aStruct.title;
	this.description = aStruct.description;
	this.lastupdate = aStruct.lastupdate;
	this.createdate = aStruct.createdate;
	this.notified = aStruct.notified;
	this.category = aStruct.category;
	this.simpletitle = aStruct.simpletitle;
	this.healingArgs = this.setHealing(aStruct.healingArgs);
};

/**
 * [getLevel description]
 * @return {[type]} [description]
 */
nWarning.prototype.getLevel = function() {
	return this.level;
}

/**
 * [getTitle description]
 * @return {[type]} [description]
 */
nWarning.prototype.getTitle = function() {
	return this.title;
}

nWarning.prototype.close = function() {
 	this.level = nWarning.LEVEL_CLOSED;
}

/**
 * [getDescription description]
 * @return {[type]} [description]
 */
nWarning.prototype.getDescription = function() {
	return this.description;
}

nWarning.prototype.getLastUpdate = function() {
	return this.lastupdate;
}

nWarning.prototype.getCreateDate = function() {
	return this.createdate;
}

nWarning.prototype.getNotified = function() {
	return this.notified;
}

nWarning.prototype.getHealingArgs = function() {
	return this.healingArgs;
};

nWarning.prototype.update = function(aWarning) {
	if (isUnDef(aWarning)) return;
	
	this.level = aWarning.getLevel();
	this.title = aWarning.getTitle();
	this.description = aWarning.getDescription();
	this.lastupdate = new Date();
	this.notified = merge(this.notified, aWarning.getNotified());
	this.category = this.getFolders();
	this.simpletitle = this.getSimpleTitle();
	this.healingArgs = aWarning.getHealingArgs();
};

/**
 * <odoc>
 * <key>nattrmon.nWarning.getFolders() : String</key>
 * Gets the warnings' folders.
 * </odoc>
 */
nWarning.prototype.getFolders = function() {
	if (isUnDef(this.getTitle())) return [];

	var elems = this.getTitle().split(/\//g);
	return elems.slice(0, -1);
};

/**
 * <odoc>
 * <key>nattrmon.nWarning.getSimpleTitle() : String</key>
 * Removes all warning folder paths and returns just the warning's simple title
 * </odoc>
 */
nWarning.prototype.getSimpleTitle = function() {
	if (isUnDef(this.getTitle())) return "";

	this.simpletitle = this.getTitle().split(/\//g).slice(-1)[0];
	return this.simpletitle;
}
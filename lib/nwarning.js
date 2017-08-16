/**
 * [nWarning description]
 * @param  {[type]} aLevel       [description]
 * @param  {[type]} aTitle       [description]
 * @param  {[type]} aDescription [description]
 * @return {[type]}              [description]
 */
var nWarning = function(aLevel, aTitle, aDescription) {
	if (isObject(aLevel)) {
		this.setData(aLevel);
	} else {
		this.level 		= aLevel;
		this.title 		= aTitle;
		this.description = aDescription;
		this.lastupdate  = new Date();
		this.createdate  = new Date();
		this.notified = {};
	}
}

nWarning.LEVEL_HIGH   = "High";
nWarning.LEVEL_MEDIUM = "Medium";
nWarning.LEVEL_LOW    = "Low";
nWarning.LEVEL_CLOSED = "Closed";

nWarning.prototype.getData = function() {
	return {
		"level": this.level,
		"title": this.title,
		"description": this.description,
		"lastupdate": this.lastupdate,
		"createdate": this.createdate,
		"notified": this.notified
	}
}

nWarning.prototype.setData = function(aStruct) {
	this.level = aStruct.level;
	this.title = aStruct.title;
	this.description = aStruct.description;
	this.lastupdate = aStruct.lastupdate;
	this.createdate = aStruct.createdate;
	this.notified = aStruct.notified;
}

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

nWarning.prototype.update = function(aWarning) {
	this.level = aWarning.getLevel();
	this.title = aWarning.getTitle();
	this.description = aWarning.getDescription();
	this.lastupdate = new Date();
      	this.notified = merge(this.notified, aWarning.getNotified());
}


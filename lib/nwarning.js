// nAttrMon warning functionality
// Copyright 2023 Nuno Aguiar

// Warning wrapper
// ----------------------------------------
// aLevel       = warning level or warning struct
// aTitle       = warning title
// aDescription = warning description
// ----------------------------------------
var nWarning = function(aLevel, aTitle, aDescription) {
	if (isObject(aLevel)) {
		this.setData(aLevel)
	} else {
		this.level 		 = aLevel
		this.title 		 = aTitle
		this.description = aDescription
		this.lastupdate  = new Date()
		this.createdate  = new Date()
		this.category    = this.getFolders()
		this.notified    = {}
		this.simpletitle = this.getSimpleTitle()
	}
}

nWarning.LEVEL_HIGH   = "High"
nWarning.LEVEL_MEDIUM = "Medium"
nWarning.LEVEL_LOW    = "Low"
nWarning.LEVEL_INFO   = "Info"
nWarning.LEVEL_CLOSED = "Closed"

// Get warning serialized data
// ----------------------------------------
// Returns map with warning fields
// ----------------------------------------
nWarning.prototype.getData = function() {
	return {
		"level": this.level,
		"title": this.title,
		"description": this.description,
		"lastupdate": this.lastupdate,
		"createdate": this.createdate,
		"notified": this.notified,
		"category": this.category,
		"simpletitle": this.simpletitle
	}
}

// Normalize warning dates coming from channel updates
// ----------------------------------------
// aCh = channel name
// aOp = operation (set/setall)
// aK  = channel key
// aV  = channel value
// ----------------------------------------
nWarning.prototype.convertDates = function(aCh, aOp, aK, aV) {
	if((aOp == "set" || aOp == "setall")) {
		var aVs = (aOp == "set") ? [ aV ] : aV
		var changes = []
		for(var i in aVs) {
			var v = aVs[i]
			
			if (isUnDef(v.lastupdate)) {
				v.date = new Date(); changes.push(v)
			}

			if (isString(v.lastupdate) && new Date(v.lastupdate) != null) {
				v.lastupdate = new Date(v.lastupdate); changes.push(v)
			}

			if (isUnDef(v.createdate)) {
				v.date = new Date(); changes.push(v)
			}

			if (isString(v.createdate) && new Date(v.createdate) != null) {
				v.createdate = new Date(v.createdate); changes.push(v)
			}
		}
		if (changes.length > 0) {
			$ch(aCh).setAll([ "title" ], changes)
		}
	}
}

// Set warning data from struct
// ----------------------------------------
// aStruct = warning struct
// ----------------------------------------
nWarning.prototype.setData = function(aStruct) {
	if (isUnDef(aStruct)) return
	
	this.level = aStruct.level
	this.title = aStruct.title
	this.description = aStruct.description
	this.lastupdate = aStruct.lastupdate
	this.createdate = aStruct.createdate
	this.notified = aStruct.notified
	this.category = aStruct.category
	this.simpletitle = aStruct.simpletitle
}

// Compare warning against provided map without timestamps
// ----------------------------------------
// aMap = map to compare
// Returns true if equal ignoring date fields
// ----------------------------------------
nWarning.prototype.compare = function(aMap) {
	if (isUnDef(aMap)) return

	var eq = true
	if (this.level != aMap.level) eq = false
	if (this.title != aMap.title) eq = false
	if (this.description != aMap.description) eq = false
	if (this.simpletitle != aMap.simpletitle) eq = false
	if (!compare(this.notified, aMap.notified)) eq = false
	if (!compare(this.category, aMap.category)) eq = false

	return eq
}

// Get warning level
// ----------------------------------------
// Returns warning level
// ----------------------------------------
nWarning.prototype.getLevel = function() {
	return this.level
}

// Get warning title
// ----------------------------------------
// Returns warning title
// ----------------------------------------
nWarning.prototype.getTitle = function() {
	return this.title
}

// Mark warning as closed
// ----------------------------------------
// No parameters
// ----------------------------------------
nWarning.prototype.close = function() {
 	this.level = nWarning.LEVEL_CLOSED
}

// Get warning description
// ----------------------------------------
// Returns description string
// ----------------------------------------
nWarning.prototype.getDescription = function() {
	return this.description
}

// Get warning last update timestamp
// ----------------------------------------
// Returns Date instance
// ----------------------------------------
nWarning.prototype.getLastUpdate = function() {
	return this.lastupdate
}

// Get warning creation timestamp
// ----------------------------------------
// Returns Date instance
// ----------------------------------------
nWarning.prototype.getCreateDate = function() {
	return this.createdate
}

// Get notified origins
// ----------------------------------------
// Returns notified map
// ----------------------------------------
nWarning.prototype.getNotified = function() {
	return this.notified
}

// Update warning contents from another warning
// ----------------------------------------
// aWarning = warning instance to copy from
// ----------------------------------------
nWarning.prototype.update = function(aWarning) {
	if (isUnDef(aWarning)) return
	
	this.level = aWarning.getLevel()
	this.title = aWarning.getTitle()
	this.description = aWarning.getDescription()
	this.lastupdate = new Date()
	this.notified = merge(this.notified, aWarning.getNotified())
	this.category = this.getFolders()
	this.simpletitle = this.getSimpleTitle()
}

/**
 * <odoc>
 * <key>nattrmon.nWarning.getFolders() : String</key>
 * Gets the warnings' folders.
 * </odoc>
 */
nWarning.prototype.getFolders = function() {
	if (isUnDef(this.getTitle())) return []

	var elems = this.getTitle().split(/\//g)
	return elems.slice(0, -1)
}

/**
 * <odoc>
 * <key>nattrmon.nWarning.getSimpleTitle() : String</key>
 * Removes all warning folder paths and returns just the warning's simple title
 * </odoc>
 */
nWarning.prototype.getSimpleTitle = function() {
	if (isUnDef(this.getTitle())) return ""

	this.simpletitle = this.getTitle().split(/\//g).slice(-1)[0]
	return this.simpletitle
}

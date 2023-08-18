// nAttrMon attribute functionality
// Copyright 2023 Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nAttribute(anAttributeStruct) : nAttribute</key>
 * Given anAttributeStruct creates a nAttribute object instance.
 * </odoc>
 */
var nAttribute = function(aName, aDescription, aType, aTags) {
	if (isObject(aName)) {
		// Instanciating from an existing
		this.setData(aName);
	} else {
		// Creating a new
		this.description = aDescription;
		this.name = (isUnDef(aName)) ? "Untitled/Untitled" : aName;
		this.type = (isUnDef(aType)) ? nAttribute.TYPE_STRING : aType;
		this.category = this.getFolders();
		this.lastcheck = undefined;
		this.simplename = this.getSimpleName();
  		this.tags = (isUnDef(aTags)) ? [] : aTags;
	}
}

// Types of attributes
nAttribute.TYPE_SEMAPHORE = "sem";
nAttribute.TYPE_STRING    = "str";
nAttribute.TYPE_NUMBER    = "num";
nAttribute.TYPE_TABLE     = "tab";
nAttribute.TYPE_STATUS    = "sta";

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getData() : anAttributeStruct</key>
 * Returns the current object instance anAttributeStruct.
 * </odoc>
 */
nAttribute.prototype.getData = function() {
	return {
		"description": this.description,
		"name": this.name,
		"type": this.type,
		"category": this.category,
		"lastcheck": this.lastcheck,
		"simplename": this.simplename,
		"tags": this.tags
	};
};

// Ensure dates are converted from strings in channels
nAttribute.prototype.convertDates = function(aCh, aOp, aK, aV) {
	if((aOp == "set" || aOp == "setall")) {
		var aVs = (aOp == "set") ? [ aV ] : aV;
		var changes = [];
		for(var i in aVs) {
			var v = aVs[i];

			if (isString(v.lastcheck) && new Date(v.lastcheck) != null) {
				v.lastcheck = new Date(v.lastcheck); changes.push(v);
			}
		}
		if (changes.length > 0) {
			$ch(aCh).setAll([ "name" ], changes);
		}
	}
};

/**
 * <odoc>
 * <key>nattrmon.nAttribute.setData(anAttributeStruct)</key>
 * Forces the object instance internal values to anAttributeStruct.
 * NOTE: should use the constructor that will call this internally.
 * </odoc>
 */
nAttribute.prototype.setData = function(aStruct) {
	this.description = aStruct.description;
	this.name = aStruct.name;
	this.type = aStruct.type;
	this.category = aStruct.category;
	this.lastcheck = aStruct.lastcheck;
	this.simplename = aStruct.simplename;
	this.tags = aStruct.tags;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getDescription() : String</key>
 * Gets the attribute description.
 * </odoc>
 */
nAttribute.prototype.getDescription = function() {
	return this.description;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.setDescription(aDescription)</key>
 * Sets the attribute description.
 * </odoc>
 */
nAttribute.prototype.setDescription = function(aDescription) {
	this.description = aDescription;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getName() : String</key>
 * Gets the attribute's name.
 * </odoc>
 */
nAttribute.prototype.getName = function() {
	return this.name;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getSimpleName() : String</key>
 * Removes all attribute folder paths and returns just the attribute's simple name
 * </odoc>
 */
nAttribute.prototype.getSimpleName = function() {
	//this.simplename = this.getName().replace(/[^\/]+\/(.+)/, "$1");
	this.simplename = this.getName().split(/\//g).slice(-1)[0];
	return this.simplename;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.setName()</key>
 * Sets the attribute's name.
 * </odoc>
 */

nAttribute.prototype.setName = function(aName) {
	this.name = aName;
	this.category = this.getFolders();
	this.simplename = this.getSimpleName();
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.touch()</key>
 * Sets to now the lastcheck attribute internal field.
 * </odoc>
 */

nAttribute.prototype.touch = function() {
	this.lastcheck = new Date();
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getFolders() : String</key>
 * Gets the attributes' folders.
 * </odoc>
 */
nAttribute.prototype.getFolders = function() {
	var elems = this.getName().split(/\//g);
	return elems.slice(0, -1);
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getType() : String</key>
 * Returns the attributes' type.
 * </odoc>
 */
nAttribute.prototype.getType = function() {
	return this.type;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.getTags() : Array</key>
 * Return the current associated tags. 
 * </odoc>
 */
nAttribute.prototype.getTags = function() {
	return this.tags;
}

/**
 * <odoc>
 * <key>nattrmon.nAttribute.setTags(anArrayOfTags)</key> 
 * Set the list of tags for the attribute.
 * </odoc>
 */
nAttribute.prototype.setTags = function(aTags) {
	this.tags = aTags;
}

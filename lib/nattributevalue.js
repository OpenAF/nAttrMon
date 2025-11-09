// nAttrMon attribute value functionality
// Copyright 2023 Nuno Aguiar

// Attribute value wrapper
// ----------------------------------------
// aName  = attribute name or attribute struct
// aValue = attribute value
// aDate  = attribute timestamp
// ----------------------------------------
var nAttributeValue = function(aName, aValue, aDate) {
	if (isObject(aName)) {
		this.setData(aName)
	} else {
		this.name = (isUndefined(aName)) ? "Untitled" : aName
		this.val = (isUndefined(aValue)) ? undefined : aValue
		this.date = (isUndefined(aDate)) ? new Date() : aDate
	}
}

// Normalize value dates coming from channel updates
// ----------------------------------------
// aCh = channel name
// aOp = channel operation (set/setall)
// aK  = channel key
// aV  = channel value
// ----------------------------------------
nAttributeValue.prototype.convertDates = function(aCh, aOp, aK, aV) {
	if((aOp == "set" || aOp == "setall")) {
		var aVs = (aOp == "set") ? [ aV ] : aV
		var changes = []
		for(var i in aVs) {
			var v = aVs[i]
			
			if (isUnDef(v.date)) {
				v.date = new Date(); changes.push(v)
			}

			if (isString(v.date) && new Date(v.date) != null) {
				v.date = new Date(v.date); changes.push(v)
			}
		}
		if (changes.length > 0) {
			$ch(aCh).setAll([ "name" ], changes)
		}
	}
}

/**
 * <odoc>
 * <key>nattrmon.nAttributeValue.getData() : anAttributeValueStruct</key>
 * Returns the current object instance anAttributeValueStruct.
 * </odoc>
 */
nAttributeValue.prototype.getData = function() {
	return {
		"name": this.getName(),
		"val": this.getValue(),
		"date": this.getDate()
	}
}

/**
 * <odoc>
 * <key>nattrmon.nAttributeValue.setData(anAttributeValueStruct)</key>
 * Forces the object instance internal values to anAttributeValueStruct.
 * NOTE: should use the constructor that will call this internally.
 * </odoc>
 */
nAttributeValue.prototype.setData = function(aStruct) {
	this.name = aStruct.name
	this.val = aStruct.val
	this.date = aStruct.date
}

// Get current attribute value
// ----------------------------------------
// Returns stored value
// ----------------------------------------
nAttributeValue.prototype.getValue = function() {
	return this.val
}

// Get attribute value string representation
// ----------------------------------------
// Returns JSON string representation
// ----------------------------------------
nAttributeValue.prototype.getValueString = function() {
	return JSON.stringify(this.getValue())
}

// Get attribute timestamp
// ----------------------------------------
// Returns stored date
// ----------------------------------------
nAttributeValue.prototype.getDate = function() {
	return this.date
}

// Get attribute name
// ----------------------------------------
// Returns stored name
// ----------------------------------------
nAttributeValue.prototype.getName = function() {
	return this.name
}

// Clone attribute value
// ----------------------------------------
// Returns new nAttributeValue instance
// ----------------------------------------
nAttributeValue.prototype.clone = function() {
	return new nAttributeValue(this.getName(), this.getValue(), this.getDate())
}

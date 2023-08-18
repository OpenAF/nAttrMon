// nAttrMon attribute value functionality
// Copyright 2023 Nuno Aguiar

/**
 * [nAttributeValue description]
 */
var nAttributeValue = function(aName, aValue, aDate) {
	if (isObject(aName)) {
		this.setData(aName);
	} else {
		this.name = (isUndefined(aName)) ? "Untitled" : aName;
		this.val = (isUndefined(aValue)) ? undefined : aValue;
		this.date = (isUndefined(aDate)) ? new Date() : aDate;
	}
};

// Ensure dates are converted from strings in channels
nAttributeValue.prototype.convertDates = function(aCh, aOp, aK, aV) {
	if((aOp == "set" || aOp == "setall")) {
		var aVs = (aOp == "set") ? [ aV ] : aV;
		var changes = [];
		for(var i in aVs) {
			var v = aVs[i];
			
			if (isUnDef(v.date)) {
				v.date = new Date(); changes.push(v);
			}

			if (isString(v.date) && new Date(v.date) != null) {
				v.date = new Date(v.date); changes.push(v);
			}
		}
		if (changes.length > 0) {
			$ch(aCh).setAll([ "name" ], changes);
		}
	}
};

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
	this.name = aStruct.name;
	this.val = aStruct.val;
	this.date = aStruct.date;
}

/**
 * [getValue description]
 * @return {[type]} [description]
 */
nAttributeValue.prototype.getValue = function() {
	return this.val;
}

nAttributeValue.prototype.getValueString = function() {
	return JSON.stringify(this.getValue());
}

/**
 * [getDate description]
 * @return {[type]} [description]
 */
nAttributeValue.prototype.getDate = function() {
	return this.date;
}

nAttributeValue.prototype.getName = function() {
	return this.name;
}

nAttributeValue.prototype.clone = function() {
	return new nAttributeValue(this.getName(), this.getValue(), this.getDate());
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes(anArrayOfAttributes)</key>
 * Builds a set of nAttribute objects based on anArrayOfAttributes (if provided).
 * This anArrayOfAttributes should be an array of anAttributeStruct.
 * The set will be based on the channel 'nattrmon::attributes'.
 * </odoc>
 */
var nAttributes = function(arrayOfAttributes) {
	this.chAttributes = "nattrmon::attributes";
	$ch(this.chAttributes).create(1, "simple");

	this.addAttributes(arrayOfAttributes);
}

/**
 * <odoc>
 * <key>nattrmon.getCh() : Channel</key>
 * Retrieves the current openaf channel for attributes.
 * </odoc>
 */
nAttributes.prototype.getCh = function() {
	return $ch(this.chAttributes);
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes.addAttributes(arrayOfAttributes)</key>
 * Adds a set of anAttributeStructs.
 * </odoc>
 */
nAttributes.prototype.addAttributes = function(arrayOfAttributes) {
	for(var i in arrayOfAttributes) {
		this.setAttribute(new nAttribute(arrayOfAttributes[i]));
	}
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes.rmAttribute(anAttributeObject)</key>
 * Removes the attribute object from the current set.
 * </odoc>
 */
nAttributes.prototype.rmAttribute = function(anAttr) {
	$ch(this.chAttributes).unset({ "name": anAttr.getName() });
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes.setAttribute(anAttributeObject)</key>
 * Adds or sets the anAttributeObject on the current set.
 * </odoc>
 */
nAttributes.prototype.setAttribute = function(anAttribute) {
	if (isUnDef(anAttribute) || anAttribute == {}) return;
	if (anAttribute.getType() != nAttribute.TYPE_SEMAPHORE &&
		anAttribute.getType() != nAttribute.TYPE_STRING &&
		anAttribute.getType() != nAttribute.TYPE_NUMBER &&
		anAttribute.getType() != nAttribute.TYPE_TABLE &&
		anAttribute.getType() != nAttribute.TYPE_STATUS) return;

	var existing = $ch(this.chAttributes).get({ "name": anAttribute.getName() });
	if (isDef(existing)) {
		existing = new nAttribute(existing);
		existing.setDescription(anAttribute.getDescription());
		existing.lastcheck = anAttribute.lastcheck;
		if (isUnDef(existing.getType())) existing.setType(anAttribute.getType());
		if (isUnDef(existing.getTags())) existing.setTags(anAttribute.getTags());

		anAttribute = existing;
	}
	var res = $ch(this.chAttributes).getSet({ "name": anAttribute.getName() }, { "name": anAttribute.getName() }, anAttribute.getData());
	if (isUnDef(res)) $ch(this.chAttributes).set({ "name": anAttribute.getName() }, anAttribute.getData());
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes.touchAttribute(anAttributeName)</key>
 * Resets the check date for the attribute of anAttributeName on the current set to now.
 * </odoc>
 */
nAttributes.prototype.touchAttribute = function(anAttributeName) {
	var atr = this.getAttributeByName(anAttributeName);
	atr.touch();
	this.setAttribute(atr);
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes.getAttributes(justData) : anArrayOfAttributes</key>
 * Returns the current set as an array of nAttribute objects. Optionally 
 * if justData = true an array of attributeStruct will be returned.
 * </odoc>
 */
nAttributes.prototype.getAttributes = function(justData) {
	var arr = $ch(this.chAttributes).getAll();
	if (!justData) { 
		for(var i in arr) {
			arr[i] = new nAttribute(arr[i]);
		}
	}
	return arr;
}

nAttributes.prototype.setAttributes = function(anAttributesSnapshot) {
	this.addAttributes(anAttributesSnapshot);
}
/**
 * <odoc>
 * <key>nattrmon.nAttributes.exists(anAttributeName) : boolean</key>
 * Checks if anAttributeName exists on the current set.
 * </odoc>
 */
nAttributes.prototype.exists = function(anAttributeName) {
	var ks = $ch(this.chAttributes).getKeys();
	for(var i in ks) {
		if (ks[i].name == anAttributeName) {
			return true;
		}
	}
	return false;
}

/**
 * <odoc>
 * <key>nattrmon.nAttributes.getAttributeByName(anAttributeName) : nAttribute</key>
 * Returns nAttribute object from the set given anAttributeName. 
 * </odoc>
 */
nAttributes.prototype.getAttributeByName = function(anAttributeName) {
	var atr = $ch(this.chAttributes).get({ "name": anAttributeName })
	return (isDef(atr) ? new nAttribute(atr) : atr);
}

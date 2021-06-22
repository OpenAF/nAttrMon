// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_HK(aMap)</key>
 * Perform housekeeping on current values and/or last values and/or warnings (no matter the current
 * level).
 * \
 * On aMap expects:\
 * \
 *    - include                    (Array)   Array of regex attributes/warnings to include on output.\
 *    - exclude                    (Array)   Array of regex attributes/warnings to exclude from output.\
 *    - warningUpdateDeleteAfter   (Number)  Number of minutes after the last update of a warning that determines that it should be deleted.\
 *    - attributeUpdateDeleteAfter (Number)  Number of minutes after the last update of a the current value of an attribute that determines that it should be deleted.\
 *    - warningDeleteAfter         (Number)  Number of minutes after the creation of a warning that determines that it should be deleted.\
 *    - attributeDeleteAfter       (Number)  Number of minutes after the last check of an attribute that determines that it should be deleted.\
 * \
 * </odoc>
 */
 var nOutput_HK = function(aMap) {
    // Set parameters from Map
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.include = this.params.include;
	this.exclude = this.params.exclude;

    if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";
	
    this.warningUpdateDeleteAfter   = _$(this.params.warningUpdateDeleteAfter, "warningUpdateDeleteAfter").isNumber().default(-1);
    this.attributeUpdateDeleteAfter = _$(this.params.attributeUpdateDeleteAfter, "attributeUpdateDeleteAfter").isNumber().default(-1);
    this.warningDeleteAfter         = _$(this.params.warningDeleteAfter, "warningDeleteAfter").isNumber().default(-1);
    this.attributeDeleteAfter       = _$(this.params.attributeDeleteAfter, "attributeDeleteAfter").isNumber().default(-1);

    // call super
    nOutput.call(this, this.output);
};
inherit(nOutput_HK, nOutput);

nOutput_HK.prototype.output = function(scope, args) {
    // Only act if an attribute argument was provided
    if (this.attributeUpdateDeleteAfter > -1 || this.attributeDeleteAfter > -1) {
        // List of attributes needs to be built from the current list and current values as old attributes might get deleted from attributes.
        var attrs = uniqArray( nattrmon.listOfAttributes.getCh().getKeys().concat(nattrmon.currentValues.getKeys()) );

        // Go through each known attribute
        for(var iattr in attrs) {
            // Process include/exclude arguments
            var attr = attrs[iattr];
            var isok = isDef(this.include) ? false : true;
            var kk = attr.name;

            if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0;
            if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0;

            // If it's okay to proceed with this attribute
            if (isok) {
                var shouldDelete = false;
                // Get current value for current attribute
                var cval = nattrmon.currentValues.get({ name: attr.name });

                // Mark to delete if current value date older than
                if (isDef(cval) && this.attributeUpdateDeleteAfter > -1 && 
                    ow.format.dateDiff.inMinutes(new Date(cval.date)) >= this.attributeUpdateDeleteAfter) {
                        shouldDelete = true;
                        logWarn("nOutput_HK | Attribute '" + cval.name + "' being deleted after check " + ow.format.timeago(new Date(cval.date)));
                }
                // Mark to delete if last check date older than
                if (this.attributeDeleteAfter > -1 && 
                    ow.format.dateDiff.inMinutes(new Date(attr.lastcheck)) >= this.attributeDeleteAfter) {
                        shouldDelete = true;
                        logWarn("nOutput_HK | Attribute '" + attr.name + "' being deleted after check " + ow.format.timeago(new Date(attr.lastcheck)));
                }
                // Properly delete the attribute from all channels if needed
                if (shouldDelete) {
                    nattrmon.listOfAttributes.getCh().unset({
                        name: attr.name
                    });
                    nattrmon.currentValues.unset({
                        name: attr.name
                    });
                    nattrmon.lastValues.unset({
                        name: attr.name
                    });
                }
            }
        }
    }

    // Only act if a warning argument was provided
    if (this.warningUpdateDeleteAfter > -1 || this.warningDeleteAfter > -1) {
        var warns = nattrmon.listOfWarnings.getCh().getAll();

        // Process include/exclude arguments
        for (var warn in warns) {
            var isok = isDef(this.include) ? false : true;
            var kk = warn.title;

            if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0;
            if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0;

            // If it's okay to proceed with this warning
            if (isok) {
                var shouldDelete = false;
                // Mark to delete if current warning last update older than
                if (this.warningUpdateDeleteAfter > -1 && 
                    ow.format.dateDiff.inMinutes(new Date(warns[warn].lastupdate)) >= this.warningUpdateDeleteAfter) {
                        shouldDelete = true;
                        logWarn("nOutput_HK | Warning '" + warns[warn].title + "' being deleted after update " + ow.format.timeago(new Date(warns[warn].lastupdate)));
                }
                // Mark to delete if current warning creation date older than
                if (this.warningDeleteAfter > -1 && 
                    ow.format.dateDiff.inMinutes(new Date(warns[warn].createdate)) >= this.warningDeleteAfter) {
                        shouldDelete = true;
                        logWarn("nOutput_HK | Warning '" + warns[warn].title + "' being deleted after creation " + ow.format.timeago(new Date(warns[warn].createdate)));
                }
                // Properly delete the warning if needed
                if (shouldDelete) {
                    nattrmon.listOfWarnings.getCh().unset({
                        title: warns[warn].title
                    });
                }
            }
        }
    }

    return true;
};
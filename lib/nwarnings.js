/**
 * [nWarnings description]
 * @return {[type]} [description]
 */
var nWarnings = function() {
	this.chWarnings = "nattrmon::warnings";

	$ch(this.chWarnings).create();

	/*this.warnings = {};
	this.warnings[nWarning.LEVEL_HIGH] = {};
    this.warnings[nWarning.LEVEL_MEDIUM] = {};
    this.warnings[nWarning.LEVEL_LOW] = {};
    this.warnings[nWarning.LEVEL_CLOSED] = {};
    */
}

nWarnings.prototype.getCh = function() {
	return $ch(this.chWarnings);
}

/**
 * [addWarning description]
 * @param {[type]} aWarning [description]
 */
nWarnings.prototype.setWarning = function(aWarning) {
	//if (isUndefined(this.warnings[aWarning.getLevel()]))
	//	this.warnings[aWarning.getLevel()] = {};

	// Validations
	if (isUnDef(aWarning) || aWarning == {}) return;
	if (aWarning.level != nWarning.LEVEL_HIGH &&
	    aWarning.level != nWarning.LEVEL_MEDIUM &&
	    aWarning.level != nWarning.LEVEL_LOW &&
	    aWarning.level != nWarning.LEVEL_INFO &&
	    aWarning.level != nWarning.LEVEL_CLOSED) return; 

	// Clean closed alarms from other levels
        var parent = this;
        if (aWarning.level == nWarning.LEVEL_CLOSED) {
    	    $ch(this.chWarnings).forEach(function(k, v) {
    		var w = new nWarning(v);
    		if (w.title == aWarning.title) {
    			$ch(parent.chWarnings).unset(k);
                }
    	    });
		/*for(var i in this.warnings) {
			delete this.warnings[i][aWarning.getTitle()];
		}*/
        } else {
    	    // If it's new, add it
    	    var toAdd;
    	    var anExisting = $ch(this.chWarnings).get({ "title": aWarning.title });
  		if (isDef(anExisting) && anExisting != {}) {
  			toAdd = new nWarning(anExisting);
    			toAdd.update(aWarning);
  		} else {
  			toAdd = new nWarning(aWarning);
  		}
    	    if (toAdd.getData() != {}) {
	     	$ch(this.chWarnings).set(
	    		{ "title": toAdd.title },
	    		toAdd.getData()
	        );
     	    }	

        /*
		if (isUndefined(this.warnings[aWarning.getLevel()][aWarning.getTitle()])) {
			// Clean from other levels
			for(var i in this.warnings) {
				if (i != aWarning.getLevel()) {
					delete this.warnings[i][aWarning.getTitle()];
				}
			}

			// Add it
			this.warnings[aWarning.getLevel()][aWarning.getTitle()] = aWarning;
		} else {
			// If it exists already
			for(var i in this.warnings) {
				if(i != aWarning.getLevel()) {
					delete this.warnings[i][aWarning.getTitle()];
				} else	{
					this.warnings[i][aWarning.getTitle()].update(aWarning);
				}
			}
		}*/
	}
}

nWarnings.prototype.getWarnings = function() {
	if ($ch(this.chWarnings).size() <= 0) return [];
	return $stream($ch(this.chWarnings).getAll()).groupBy("level");
}

nWarnings.prototype.setWarnings = function(aWarningsSnapshot) {
	this.addWarnings(aWarningsSnapshot);
}

nWarnings.prototype.getWarningByName = function(anWarningName) {
	var war = $ch(this.chWarnings).get({ "title": anWarningName });
	return (isDef(war) ? new nWarning(war) : war);
}

nWarnings.prototype.setWarningByName = function(anWarningName, aWarning) {
 	$ch(this.chWarnings).set({ title: anWarningName }, aWarning);
}

nWarnings.prototype.addWarnings = function(arrayOfWarnings) {
	for(var i in arrayOfWarnings) {
		this.setWarning(new nWarning(arrayOfWarnings[i]));
	}
}

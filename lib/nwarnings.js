/**
 * [nWarnings description]
 * @return {[type]} [description]
 */
var nWarnings = function () {
	this.chWarnings = "nattrmon::warnings";

	$ch(this.chWarnings).create();

	// Housekeeping of closed warnings
	var parent = this;
	this.getCh().subscribe((aC, aO, aK, aV) => {
		if (aO == "set" || aO == "setall") {
			$from(parent.getCh().getAll())
				.equals("level", nWarning.LEVEL_CLOSED)
				.select((r) => {
					parent.getCh().unset({ title: r.title });
				});
		}
	});
};

nWarnings.prototype.getCh = function () {
	return $ch(this.chWarnings);
};

/**
 * [addWarning description]
 * @param {[type]} aWarning [description]
 */
nWarnings.prototype.setWarning = function(aWarning) {
	// Validations
	if (isUnDef(aWarning) || aWarning == {}) return;
	if (aWarning.level != nWarning.LEVEL_HIGH &&
		aWarning.level != nWarning.LEVEL_MEDIUM &&
		aWarning.level != nWarning.LEVEL_LOW &&
		aWarning.level != nWarning.LEVEL_INFO &&
		aWarning.level != nWarning.LEVEL_CLOSED) return;

	// Clean closed alarms from other levels
	var parent = this;
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
};

nWarnings.prototype.getWarnings = function () {
	var o;

	if ($ch(this.chWarnings).size() <= 0) return {
		"Low": [], "Medium": [], "High": [], "Info": []
	};
	o = $from($ch(this.chWarnings).getAll()).group("level");
	if (isDef(o.LOW))    { o.Low = o.LOW; delete o.LOW; }
	if (isDef(o.HIGH))   { o.High = o.HIGH; delete o.HIGH; }
	if (isDef(o.MEDIUM)) { o.Medium = o.MEDIUM; delete o.MEDIUM; }
	if (isDef(o.INFO))   { o.Info = o.INFO; delete o.INFO; }
	if (isDef(o.CLOSED)) { o.Closed = o.CLOSED; delete o.CLOSED; }

	return o;
};

nWarnings.prototype.setWarnings = function (aWarningsSnapshot) {
	this.addWarnings(aWarningsSnapshot);
};

nWarnings.prototype.getWarningByName = function (anWarningName) {
	var war = $ch(this.chWarnings).get({ "title": anWarningName });
	return (isDef(war) ? new nWarning(war) : war);
};

nWarnings.prototype.setWarningByName = function (anWarningName, aWarning) {
	$ch(this.chWarnings).getSet({ title: anWarningName }, { title: anWarningName }, aWarning);
};

nWarnings.prototype.addWarnings = function (arrayOfWarnings) {
	for (var i in arrayOfWarnings) {
		this.setWarning(new nWarning(arrayOfWarnings[i]));
	}
};
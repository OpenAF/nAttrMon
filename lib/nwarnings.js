/**
 * [nWarnings description]
 * @return {[type]} [description]
 */
var nWarnings = function () {
	this.chWarnings = "nattrmon::warnings";

	var parent = this;
	
	if (isDef(__NAM_CHANNEL_WARNS)) {
		var o = jsonParse(__NAM_CHANNEL_WARNS, true);
		o.options = __nam_getSec(o.options);
		o = __nam_getChExtraOptions(o, "title");
		$ch(this.chWarnings).create(1, o.type, o.options);
	} else {
		$ch(this.chWarnings).create(1, "simple");
	}

	// Buffer cvals
	if (__NAM_BUFFERCHANNELS) {
		$ch(this.chWarnings).subscribe(ow.ch.utils.getBufferSubscriber(this.chWarnings, [ "title" ], __NAM_BUFFERBYNUMBER, __NAM_BUFFERBYTIME), true);
	}

    // Housekeeping of closed warnings given __NAM_CLOSEDHK_HOWLONGAGOINMS
	// if __NAM_CLOSEDHK_HOWLONGAGOINMS is negative disable the functionality
	if (__NAM_CLOSEDHK_HOWLONGAGOINMS > 0) {
		// Cache it for slower getAll channel types
		$cache("nattrmon::warnings")
		.ttl(__NAM_CLOSEDHK_HOWLONGAGOINMS)
		.fn(aK => {
			return parent.getCh().getAll()
		})
		.create()
		// Do it now if it's needed
		if (__NAM_CLOSEDHK_ONSTARTUP) {
			$from($cache("nattrmon::warnings").get({}))
			.equals("level", nWarning.LEVEL_CLOSED)
			.select((r) => {
				if ((now() - (new Date(r.updatedate)).getTime()) > __NAM_CLOSEDHK_HOWLONGAGOINMS) {
					parent.getCh().unset({ title: r.title });
				}
			})
		}
		// Set the a trigger on set/setall
		this.getCh().subscribe((aC, aO, aK, aV) => {
			if (aO == "set" || aO == "setall") {
				$from($cache("nattrmon::warnings").get({}))
					.equals("level", nWarning.LEVEL_CLOSED)
					.select((r) => {
						if ((now() - (new Date(r.updatedate)).getTime()) > __NAM_CLOSEDHK_HOWLONGAGOINMS) {
							parent.getCh().unset({ title: r.title });
						}
					});
			}
		}, true);
	}
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
	var toAdd, update = false;
	var anExisting = $ch(this.chWarnings).get({ "title": aWarning.title });
	if (isDef(anExisting) && anExisting != {}) {
		// Only update if not exactly equal (minus date fields)
		if (!aWarning.compare(anExisting)) {
			toAdd = new nWarning(anExisting);
			toAdd.update(aWarning);
			update = true;
		}
	} else {
		toAdd = new nWarning(aWarning);
		update = true;
	}
	if (update && toAdd.getData() != {}) {
		$ch(this.chWarnings).set(
			{ "title": toAdd.title },
			toAdd.getData()
		);
	}
};

nWarnings.prototype.getWarnings = function () {
	var o = { "Low": [], "Medium": [], "High": [], "Info": [], "Closed": [] };

	if ($ch(this.chWarnings).size() <= 0) return o;

	var res = $from($ch(this.chWarnings).getAll()).group("level");

	if (isDef(res[nWarning.LEVEL_LOW]))    { o.Low = res[nWarning.LEVEL_LOW]; }
	if (isDef(res[nWarning.LEVEL_HIGH]))   { o.High = res[nWarning.LEVEL_HIGH]; }
	if (isDef(res[nWarning.LEVEL_MEDIUM])) { o.Medium = res[nWarning.LEVEL_MEDIUM]; }
	if (isDef(res[nWarning.LEVEL_INFO]))   { o.Info = res[nWarning.LEVEL_INFO]; }
	if (isDef(res[nWarning.LEVEL_CLOSED])) { o.Closed = res[nWarning.LEVEL_CLOSED]; }

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
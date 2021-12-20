// nAttrMon template helpers -----------------------------------------------------------------
// -------------------------------------------------------------------------------------------

ow.template.addHelper("attr", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getAttributes().getAttributeByName(a);
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("dateDiff", (a, p, isN) => {
	if (isDef(a) && a != null) {
			var res = "seconds";
			if (isDef(p) && p != null && isString(p)) res = p;
			try {
					switch(res) {
					case "minutes": return ow.format.dateDiff.inMinutes(new Date(a));
					case "hours"  : return ow.format.dateDiff.inHours(new Date(a));
					case "days"   : return ow.format.dateDiff.inDays(new Date(a));
					case "months" : return ow.format.dateDiff.inMonths(new Date(a));
					case "weeks"  : return ow.format.dateDiff.inWeeks(new Date(a));
					case "years"  : return ow.format.dateDiff.inYears(new Date(a));
					case "seconds":
					default:
							return ow.format.dateDiff.inSeconds(new Date(a));
					}
			} catch(e) {
					return (isString(isN) ? isN : null);
			}
	} else {
			return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("cval", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getCurrentValues(true).get({ name: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("lval", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getLastValues(true).get({ name: a });
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("warn", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getWarnings(true).getWarningByName(a);
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p);
		} else {
			res = stringify(res, void 0, "");
		}
		return (isDef(res) ? res : isN);
	} else {
		return (isString(isN) ? isN : null);
	}
});
ow.template.addHelper("countWarns", (a, p) => {
	var warns = nattrmon.getWarnings()

	if (isString(a) && a != "all") {
		if (isString(p)) {
			return $from(warns[a]).match("title", p).count()
		} else {
			return warns[a].length
		}
	} else {
		var c = 0
		if (isString(p)) {
			Object.keys(warns).forEach(_l => c += $from(warns[_l]).match("title", p).count())
		} else {
			
			Object.keys(warns).forEach(_l => c += warns[_l].length)
		}
		return c
	}
})

ow.template.addHelper("debug", (s) => { sprint(s); });
ow.template.addHelper("stringify", (s) => { return stringify(s); });
ow.template.addHelper("stringifyInLine", (s) => { return stringify(s, void 0, ""); });
ow.template.addHelper("toSLON", (s) => { return ow.format.toSLON(s) });
ow.template.addHelper("toYAML", (s) => { return af.toYAML(s); });
ow.template.addHelper("env", (s) => { return java.lang.System.getenv().get(s); });
ow.template.addHelper("escape", (s) => { return s.replace(/['"]/g, "\\$1"); });
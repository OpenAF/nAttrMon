// nAttrMon template helpers -----------------------------------------------------------------
// Copyright 2023 Nuno Aguiar
// -------------------------------------------------------------------------------------------

// Template helper: attr
// ----------------------------------------
// a   = attribute name
// p   = optional property path
// isN = fallback value
// Returns attribute or fallback
// ----------------------------------------
ow.template.addHelper("attr", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getAttributes().getAttributeByName(a)
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p)
		} else {
			res = stringify(res, void 0, "")
		}
		return (isDef(res) ? res : isN)
	} else {
		return (isString(isN) ? isN : null)
	}
})
// Template helper: dateDiff
// ----------------------------------------
// a   = date input
// p   = unit (seconds, minutes, hours, days, months, weeks, years)
// isN = fallback value
// Returns difference between now and provided date
// ----------------------------------------
ow.template.addHelper("dateDiff", (a, p, isN) => {
	if (isDef(a) && a != null) {
			var res = "seconds"
			if (isDef(p) && p != null && isString(p)) res = p
			try {
					switch(res) {
					case "minutes": return ow.format.dateDiff.inMinutes(new Date(a))
					case "hours"  : return ow.format.dateDiff.inHours(new Date(a))
					case "days"   : return ow.format.dateDiff.inDays(new Date(a))
					case "months" : return ow.format.dateDiff.inMonths(new Date(a))
					case "weeks"  : return ow.format.dateDiff.inWeeks(new Date(a))
					case "years"  : return ow.format.dateDiff.inYears(new Date(a))
					case "seconds":
					default:
							return ow.format.dateDiff.inSeconds(new Date(a))
					}
			} catch(e) {
					return (isString(isN) ? isN : null)
			}
	} else {
			return (isString(isN) ? isN : null)
	}
})
// Template helper: cval
// ----------------------------------------
// a   = attribute name
// p   = optional property path
// isN = fallback value
// Returns current value entry or fallback
// ----------------------------------------
ow.template.addHelper("cval", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getCurrentValues(true).get({ name: a })
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p)
		} else {
			res = stringify(res, void 0, "")
		}
		return (isDef(res) ? res : isN)
	} else {
		return (isString(isN) ? isN : null)
	}
})
// Template helper: lval
// ----------------------------------------
// a   = attribute name
// p   = optional property path
// isN = fallback value
// Returns last value entry or fallback
// ----------------------------------------
ow.template.addHelper("lval", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getLastValues(true).get({ name: a })
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p)
		} else {
			res = stringify(res, void 0, "")
		}
		return (isDef(res) ? res : isN)
	} else {
		return (isString(isN) ? isN : null)
	}
})
// Template helper: warn
// ----------------------------------------
// a   = warning title
// p   = optional property path
// isN = fallback value
// Returns warning data or fallback
// ----------------------------------------
ow.template.addHelper("warn", (a, p, isN) => {
	if (isDef(a) && a != null) {
		var res = nattrmon.getWarnings(true).getWarningByName(a)
		if (isDef(p) && p != null && isString(p)) {
			res = ow.obj.getPath(res, p)
		} else {
			res = stringify(res, void 0, "")
		}
		return (isDef(res) ? res : isN)
	} else {
		return (isString(isN) ? isN : null)
	}
})
// Template helper: countWarns
// ----------------------------------------
// a = level name or "all"
// p = optional title regex
// Returns count of matching warnings
// ----------------------------------------
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

// Template helper: debug
// ----------------------------------------
// s = value to print for debugging
// ----------------------------------------
ow.template.addHelper("debug", (s) => { sprint(s); })

// Template helper: stringify
// ----------------------------------------
// s = value to stringify
// ----------------------------------------
ow.template.addHelper("stringify", (s) => { return stringify(s); })

// Template helper: stringifyInLine
// ----------------------------------------
// s = value to stringify without indentation
// ----------------------------------------
ow.template.addHelper("stringifyInLine", (s) => { return stringify(s, void 0, ""); })

// Template helper: toSLON
// ----------------------------------------
// s = object to convert to SLON
// ----------------------------------------
ow.template.addHelper("toSLON", (s) => { return ow.format.toSLON(s) })

// Template helper: toYAML
// ----------------------------------------
// s = object to convert to YAML
// ----------------------------------------
ow.template.addHelper("toYAML", (s) => { return af.toYAML(s); })

// Template helper: env
// ----------------------------------------
// s = environment variable name
// ----------------------------------------
ow.template.addHelper("env", (s) => { return java.lang.System.getenv().get(s); })

// Template helper: escape
// ----------------------------------------
// s = string to escape quotes
// ----------------------------------------
ow.template.addHelper("escape", (s) => { return s.replace(/['"]/g, "\\$1"); })

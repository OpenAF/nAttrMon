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

ow.template.addHelper("debug", (s) => { sprint(s); });
ow.template.addHelper("stringify", (s) => { return stringify(s); });
ow.template.addHelper("stringifyInLine", (s) => { return stringify(s, void 0, ""); });
ow.template.addHelper("toSLON", (s) => { return ow.format.toSLON(s) });
ow.template.addHelper("toYAML", (s) => { return af.toYAML(s); });
ow.template.addHelper("env", (s) => { return java.lang.System.getenv().get(s); });
ow.template.addHelper("escape", (s) => { return s.replace(/['"]/g, "\\$1"); });
/**
 * Author: Nuno Aguiar
 */
 var nOutput_ES = function (aMap) {
	if (isUnDef(aMap) || !isObject(aMap)) aMap = {};

	if (isUnDef(aMap.url)) {
		throw "You need to define an URL";
	} else {
		this.url = aMap.url;
	}

	this.user = aMap.user;
	this.pass = aMap.pass;

	if (isUnDef(aMap.index) && isUnDef(aMap.funcIndex)) {
		throw "Please define either an index or a funcIndex";
	} else {
		if (isUnDef(aMap.format))
			this.funcIndex = (isDef(aMap.funcIndex)) ? af.eval(aMap.funcIndex) : new Function("return '" + aMap.index + "'");
		else
			this.funcIndex = aMap.index;
	}

	this.format = aMap.format;

	this.include = aMap.include;
	this.exclude = aMap.exclude;
	this.includeRE = aMap.includeRE;
	this.excludeRE = aMap.excludeRE;

	this.unique = aMap.unique;
	this.noDateDocId = _$(aMap.noDateDocId, "noDateDocId").isBoolean().default(false)

	if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";
	if (isDef(this.includeRE) && !isArray(this.includeRE)) throw "IncludeRE needs to be an array";
	if (isDef(this.excludeRE) && !isArray(this.excludeRE)) throw "ExcludeRE needs to be an array";

	// Compile each pattern once into a RegExp array (was: new RegExp(anArray), which
	// coerces the whole array to a comma-joined string -- multi-element lists never
	// worked -- and recompiled per value per run)
	this.includeRE = isDef(this.includeRE) ? this.includeRE.map(r => new RegExp(r)) : __;
	this.excludeRE = isDef(this.excludeRE) ? this.excludeRE.map(r => new RegExp(r)) : __;

	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true;
	this.stampMap = aMap.stampMap;
	this.dontUseStampMapTemplating = _$(aMap.dontUseStampMapTemplating).isBoolean().default(false)

	this.keyMap = _$(aMap.keyMap, "keyMap").isMap().default({})

	this.myUUID = genUUID();
	this.ch = "__es_ " + this.myUUID;
	$ch(this.ch).create(__, "elasticsearch", {
		url   : this.url,
		idKey : "id",
		index : this.funcIndex,
		format: this.format,
		user  : this.user,
		pass  : this.pass
	});

	nOutput.call(this, this.output);
};
inherit(nOutput_ES, nOutput);

// Determines whether an attribute/warning name should be sent to ES, given
// include/exclude (exact match) and includeRE/excludeRE (compiled RegExp array,
// matched with .some()) filters. Extracted from output() for unit testing.
// ----------------------------------------
// kk = the attribute name (or warning title)
// Returns true/false
// ----------------------------------------
nOutput_ES.prototype.__selected = function (kk) {
	var isok = (isDef(this.include) || isDef(this.includeRE)) ? false : true

	if (isDef(this.include) && this.include.indexOf(kk) >= 0) isok = true
	if (isDef(this.exclude) && this.exclude.indexOf(kk) >= 0) isok = false
	if (isDef(this.includeRE) && this.includeRE.some(re => re.test(kk))) isok = true
	if (isDef(this.excludeRE) && this.excludeRE.some(re => re.test(kk))) isok = false

	return isok
}

nOutput_ES.prototype.addKeys = function(aVal, aOrig, aKeyMap) {
	Object.keys(aKeyMap).forEach(k => {
		$$(aVal).set(k, $$(aOrig).get(aKeyMap[k]))
	})
}

nOutput_ES.prototype.addToES = function (aCh, aVal, useTitle) {
	var obj = {};
	var data = [];
	var extra = ""

	if (useTitle) {
		obj = {
			title: String(aVal.title.replace(/[\/ ]/g, "_")),
			date: aVal.createdate,
            level: aVal.level
		};
	} else {
		obj = {
			name: String(aVal.name.replace(/[\/ ]/g, "_")),
			date: aVal.date
		};
	}

	try {
		if (isArray(aVal.val)) {
			for (var i in aVal.val) {
				// Calculate extra based on stampMap
				var stampM = isDef(this.stampMap) ? clone(this.stampMap) : __
				if (!this.dontUseStampMapTemplating) {
					traverse(stampM, (k, v, p, o) => {
						if (isString(v)) {
							o[k] = templify(v, { name: aVal.name, val: aVal.val[i], date: aVal.date })
						}
					})
				}
				if (isDef(stampM)) extra = stringify(sortMapKeys(stampM), __, "")

				// A fresh object per element (was: mutating/reusing the shared `obj` across
				// iterations then cloning it at the end -- which could leak fields from one
				// element into the next when they didn't all set the same keys)
				var elObj = merge(clone(obj), stampM)
				elObj.id = sha1(obj.name + (this.unique ? "" : (this.noDateDocId ? "" : obj.date)) + i + extra)
				elObj[elObj.name] = clone(aVal.val[i]);
				this.addKeys(elObj, elObj[elObj.name], this.keyMap)

				traverse(elObj, function (k, v, p, o) {
					if (v == null || v == "n/a") {
						delete o[k];
					} else {
						if (k.match(/[\/ ]/)) {
							o[k.replace(/[\/ ]/g, "_")] = o[k];
							delete o[k];
						}
					}
				});
				data.push(elObj);
			}
		} else {
			// Calculate extra based on stampMap
			var stampM = isDef(this.stampMap) ? clone(this.stampMap) : __
			if (!this.dontUseStampMapTemplating) {
				traverse(stampM, (k, v, p, o) => {
					if (isString(v)) {
						o[k] = templify(v, aVal)
					}
				})
			}
			if (isDef(stampM)) extra = stringify(sortMapKeys(stampM), __, "")

			if (useTitle) {
				obj.id = sha1(obj.title + (this.noDateDocId ? "" : (this.unique ? obj.createdate : obj.date)) + obj.level + extra)
				obj = merge(obj, stampM)
				obj = merge(obj, clone(aVal))
				this.addKeys(obj, obj, this.keyMap)
			} else {
				obj.id = sha1(obj.name + (this.unique ? "" : (this.noDateDocId ? "" : obj.date)) + extra)
				obj = merge(obj, stampM)
				obj[obj.name] = (isMap(aVal.val) ? clone(aVal.val) : aVal.val)
				this.addKeys(obj, obj[obj.name], this.keyMap)
			}
			traverse(obj, function (k, v, p, o) {
				if (v == null) {
					delete o[k];
				} else {
					if (k.match(/[\/ ]/)) {
						o[k.replace(/[\/ ]/g, "_")] = o[k];
						delete o[k];
					}
				}
			});
			data.push(obj);
		}
	} catch (e) {
		logErr("nOutput_ES | " + e + " - " + stringify(obj) + " - (" + stringify(aVal) + ")");
	}


	try {
		var cont = true, res;
		if (isArray(data) && data.length == 0) cont = false;
		//if (cont) res = aCh.setAll(["id"], merge(data, this.stampMap));
		res = aCh.setAll(["id"], data)
		if (cont && isMap(res) && isDef(res.response)) {
		   var t = jsonParse(res.response);
		   if (isDef(t.errors) && t.errors) {
			  logErr("nOutput_ES | Error on sending '" + $from(data).select((r)=>{return r.name}).join(", ") + "': " + stringify(t));
		   }
		}		
		if (cont && isMap(res) && isDef(res.error)) {
			logErr("nOutput_ES | Error on sending '" + af.toSLON(res.error) + "'");
		}
		if (cont && isMap(res) && isDef(res.errors) && res.errors) {
			logErr("nOutput_ES | Error on sending '" + $from(data).select((r)=>{return r.name}).join(", ") + "': " + stringify(res));
		}
	} catch (e) {
		logErr("nOutput_ES | " + e + " -- " + af.toSLON(data))
	}
};

/**
 */
nOutput_ES.prototype.output = function (scope, args) {
	if (args.op != "setall" && args.op != "set") return;
	if (args.op == "setall" && !this.considerSetAll) return;

	var k, v;
	if (args.op == "set") {
		k = [args.k];
		v = [args.v];
	} else {
		k = args.k;
		v = args.v;
	}

	for (var vi in v) {
		var value = v[vi];
		var isWarns = (args.ch == "nattrmon::warnings" || args.ch == "nattrmon::warnings::buffer");
		var kk = (isWarns) ? v[vi].title : v[vi].name;

		if (this.__selected(kk)) { this.addToES($ch(this.ch), value, isWarns); }
	}
};
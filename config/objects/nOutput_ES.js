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

	this.unique = aMap.unique;
	this.noDateDocId = _$(aMap.noDateDocId, "noDateDocId").isBoolean().default(false)

	if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";

	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true;
	this.stampMap = aMap.stampMap;

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

nOutput_ES.prototype.addToES = function (aCh, aVal, useTitle) {
	var obj = {};
	var data = [];
	var extra = ""

	if (isDef(this.stampMap)) extra = stringify(sortMapKeys(this.stampMap), __, "")

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
				obj.id = sha1(obj.name + (this.unique ? "" : (this.noDateDocId ? "" : obj.date)) + i + extra);
				obj[obj.name] = clone(aVal.val[i]);
				
				traverse(obj, function (k, v, p, o) {
					if (v == null || v == "n/a") {
						delete o[k];
					} else {
						if (k.match(/[\/ ]/)) {
							o[k.replace(/[\/ ]/g, "_")] = o[k];
							delete o[k];
						}
					}
				});
				data.push(clone(obj));
			}
		} else {
			if (useTitle) {
				obj.id = sha1(obj.title + (this.noDateDocId ? "" : (this.unique ? obj.createdate : obj.date)) + obj.level + extra);
				obj = merge(obj, clone(aVal));
			} else {
				obj.id = sha1(obj.name + (this.unique ? "" : (this.noDateDocId ? "" : obj.date)) + extra);
				obj[obj.name] = (isMap(aVal.val) ? clone(aVal.val) : aVal.val)
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
		logErr(e + " - " + stringify(obj) + " - (" + stringify(aVal) + ")");
	}


	try {
		var cont = true, res;
		if (isArray(data) && data.length == 0) cont = false;
		if (cont) res = aCh.setAll(["id"], merge(data, this.stampMap));
		if (cont && isMap(res) && isDef(res.response)) {
		   var t = jsonParse(res.response);
		   if (isDef(t.errors) && t.errors) {
			  logErr("Error on sending '" + $from(data).select((r)=>{return r.name}).join(", ") + "': " + stringify(t));
		   }
		}		
		if (cont && isMap(res) && isDef(res.error)) {
			logErr("Error on sending '" + af.toSLON(res.error) + "'");
		}
		if (cont && isMap(res) && isDef(res.errors) && res.errors) {
			logErr("Error on sending '" + $from(data).select((r)=>{return r.name}).join(", ") + "': " + stringify(res));
		}
	} catch (e) {
		sprintErr(e + " -- " + stringify(data));
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
		var isok = isDef(this.include) ? false : true;
		var isWarns = (args.ch == "nattrmon::warnings" || args.ch == "nattrmon::warnings::buffer");
		var kk = (isWarns) ? v[vi].title : v[vi].name;

		if (isDef(this.include) && this.include.indexOf(kk) >= 0) isok = true;
		if (isDef(this.exclude) && this.exclude.indexOf(kk) >= 0) isok = false;
		if (isok) { this.addToES($ch(this.ch), value, isWarns); }
	}
};
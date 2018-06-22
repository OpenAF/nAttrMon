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
		this.funcIndex = (isDef(aMap.funcIndex)) ? af.eval(aMap.funcIndex) : new Function("return '" + aMap.index + "'");
	}

	this.include = aMap.include;
	this.exclude = aMap.exclude;

	if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";

	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : false;
	this.stampMap = aMap.stampMap;

	this.myUUID = genUUID();
	this.ch = "__es_ " + this.myUUID;
	$ch(this.ch).create(void 0, "elasticsearch", {
		url: this.url,
		idKey: "id",
		index: this.funcIndex,
		user: this.user,
		pass: this.pass
	});

	nOutput.call(this, this.output);
};
inherit(nOutput_ES, nOutput);

nOutput_ES.prototype.addToES = function (aCh, aVal, useTitle) {
	var obj = {};
	var data = [];

	if (useTitle) {
		obj = {
			title: String(aVal.title.replace(/[\/ ]/g, "_")),
			date: aVal.createdate
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
				if (useTitle) {
					obj.id = sha1(obj.title + obj.date + i);
					obj[obj.title] = aVal.val[i];
				} else {
					obj.id = sha1(obj.name + obj.date + i);
					obj[obj.name] = aVal.val[i];
				}
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
				obj.id = sha1(obj.title + obj.date + i);
				obj[obj.title] = aVal.val;
			} else {
				obj.id = sha1(obj.name + obj.date);
				obj[obj.name] = aVal.val;
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
			data.push(clone(obj));
		}
	} catch (e) {
		logErr(e + " - " + stringify(obj) + " - (" + stringify(aVal) + ")");
	}


	try {
		var cont = true, res;
		if (isArray(data) && data.length == 0) cont = false;
		if (cont) res = aCh.setAll(["id"], merge(data, this.stampMap));
		if (isDef(res) && isDef(res.response)) {
		   var t = jsonParse(res.response);
		   if (isDef(t.errors) && t.errors) {
			  logErr("Error on sending '" + $from(data).select((r)=>{return r.name}).join(", ") + "': " + stringify(t));
		   }
		}		
	} catch (e) {
		sprintErr(e + " -- " + stringify(data));
	}
};

/**
 */
nOutput_ES.prototype.output = function (scope, args) {
	if (args.op != "setall" && args.op != "set") return;
	if (args.op == "setall" && this.considerSetAll) return;

	var k, v;
	if (args.op == "set") {
		k = [args.k];
		v = [args.v];
	}

	for (var vi in v) {
		var value = v[vi];
		var isok = isDef(this.include) ? false : true;
		var isWarns = (args.ch == "nattrmon::warnings");
		var kk = (isWarns) ? k[vi].title : k[vi].name;

		if (isDef(this.include) && this.include.indexOf(kk) >= 0) isok = true;
		if (isDef(this.exclude) && this.exclude.indexOf(kk) >= 0) isok = false;
		if (isok) { this.addToES($ch(this.ch), value, isWarns); }
	}
};
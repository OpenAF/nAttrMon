/**
 * <odoc>
 * <key>nattrmon.nValidation_Generic(aMap)</key>
 * Creates a nattrmon validation for Generic. On aMap you can provide:\
 * execArgs     :
 *    checks:
 *       - attrPattern      : test$
 *         expr             : {{value}} < 200 && {{value}} >= 100
 *         warnLevel        : HIGH
 *         warnTitleTemplate: A test warning
 *         warnDescTemplate : This is just a test warning. 
 * 
 *       - attrPattern      : test3
 *         expr             : {{value.c}} == 3
 *         warnLevel        : INFO
 *         warnTitleTemplate: A test info warning
 *         warnDescTemplate : This is just a info given {{name}} because the values was {{value}} for '{{map.a}}'.          
 *    k: 
 *      name: test3
 *    v: 
 *      name: test3
 *      val : 
 *        - a: Linha 1
 *          b: 2
 *          c: 3 
 *        - a: Linha 4
 *          b: 5
 *          c: 6
 * </odoc>
 */
 var nValidation_Generic = function (aMap) {
    this.params = aMap;

    nValidation.call(this, this.validate);
};
inherit(nValidation_Generic, nValidation);

nValidation_Generic.prototype.pathMapper = function(path) {
    if (path == ".") return obj => obj

    if (path.indexOf('.') < 0) {
        return (obj) => {
            return obj[path];
        };
    }

    var paths = path.split('.');
    return (obj) => {
        var current = obj;
        for (var i = 0; i < paths.length; i++) {
            var path = paths[i];
            current = current[path];
        }
        return current;
    };
};

nValidation_Generic.prototype.levelMapper = function(aLevel) {
    switch (aLevel) {
    case "HIGH": return nWarning.LEVEL_HIGH;
    case "MEDIUM": return nWarning.LEVEL_MEDIUM;
    case "LOW": return nWarning.LEVEL_LOW;
    case "INFO": return nWarning.LEVEL_INFO;
    default: return nWarning.LEVEL_INFO;
    }
};
 
nValidation_Generic.prototype.checkEntry = function(ret, k, v, args) {
    for (var i in this.params.checks) {
        var check = this.params.checks[i]; 
        var go = false

        if (isDef(v) && 
            ((isDef(check.attribute) && v.name == check.attribute) || 
             (isDef(check.attrPattern) && v.name.match(new RegExp(check.attrPattern)))
            )
           ) {
            go = true
        }

        if (isDef(v) && 
            ((isDef(check.title) && v.title == check.title) || 
             (isDef(check.titlePattern) && v.title.match(new RegExp(check.titlePattern)))
            )
           ) {
            go = true
            if (isUnDef(check.map)) check.map = "."
        }

        if (go) {
            var uuid;
            if (check.debug) uuid = genUUID();

            var warnLevel = this.levelMapper(check.warnLevel);

            var vals = [];
            if (isDef(v.val)) {
                if (!(isArray(v.val))) vals = [v.val]; else vals = v.val
            } else {
                if (!(isArray(v))) vals = [v]; else vals = v
            }

            for (var vv in vals) {
                var val;
                if (check.map) { val = this.pathMapper(check.map)(vals[vv]); } else val = vals[vv];

                if (isUnDef(val)) {
                    if (check.debug) { sprint(merge(v, {
                            execId: uuid,
                            reason: "undefined value"
                        }));
                    }
                    continue;
                }

                if (isUnDef(check.warnTitleTemplate)) check.warnTitleTemplate = "{{name}}: Change me with warnTitleTemplate";
                if (isUnDef(check.warnDescTemplate))  check.warnDescTemplate  = "{{name}}: Change me with warnDescTemplate";

                if (check.expr) {
                    var generateWarning = true;
                    var data = args;

                    var evalCond = (aV) => { 
                        var _decision = (isDef(check.not) && check.not) ? !aV : aV

                        if (isDef(check.for)) {
                            var _k = "nValidation_Generic|" + md5(stringify(check,__,""))
                            var _p = $get(_k)
                            if (_decision) {
                                var _f = nattrmon.fromTimeAbbreviation(check.for)
                                if (isDef(_p)) {
                                    if (_f > (nowUTC() - _p)) _decision = false
                                } else {
                                    $set(_k, nowUTC())
                                    _decision = false
                                }
                            } else {
                                if (isDef(_p)) $unset(_k)
                            }
                        }

                        generateWarning = _decision
                    }

                    data.value = val;
                    data.originalValue = v.val;
                    data.name = v.name;

                    if (isUnDef(val)) {
                       if (check.debug) { sprint(merge(v, {
                            execId: uuid,
                            reason: "undefined value"
                          }));
                       }
                       continue
                    }

                    if (isString(val) && new Date(val) != null) val = new Date(val);
                    if (Object.prototype.toString.call(val) == "[object Date]") {
                        data = merge(data, {
                            dateAgo: {
                                seconds: ow.format.dateDiff.inSeconds(val),
                                minutes: ow.format.dateDiff.inMinutes(val),
                                hours  : ow.format.dateDiff.inHours(val),
                                days   : ow.format.dateDiff.inDays(val)
                            }
                        });
                    }

                    if (isString(v.date) && new Date(v.date) != null) v.date = new Date(v.date);
                    if (isDef(v.date) && Object.prototype.toString.call(v.date) == "[object Date]") {
                        data = merge(data, {
                            modifiedAgo: {
                                seconds: ow.format.dateDiff.inSeconds(v.date),
                                minutes: ow.format.dateDiff.inMinutes(v.date),
                                hours  : ow.format.dateDiff.inHours(v.date),
                                days   : ow.format.dateDiff.inDays(v.date)
                            }
                        });
                    }
                    data.dateModified = v.date;
    
                    var expr = templify(check.expr, data).replace(/\n/g, "");
                    try {
                        if (check.debug) {
                            sprint({
                                execId: uuid,
                                evaluatedExpression: expr,
                                originalExpression: check.expr,
                                data: data
                            });
                        }
                        if (af.eval(expr)) evalCond(true); else evalCond(false);
                    } catch(e) {
                        evalCond(false);
                        logWarn("Couldn't evaluate expression: " + check.expr + " for attribute " + stringify(v, undefined, "") + " [" + String(e) + "]");
                    }

                    // Prepare warning data
                    var warnTitle = templify(check.warnTitleTemplate, data);
                    var warnDesc = templify(check.warnDescTemplate, data);
                    
                    // Generate or close warnings
                    if (!generateWarning) {
                        if (check.debug) {
                            sprint({
                                execId: uuid,
                                closeAlarm: {
                                    title: warnTitle
                                }
                            });
                        }
                        this.closeWarning(warnTitle);
                    } else {
                        if (check.debug) {
                            sprint({
                                execId: uuid,
                                createAlarm: {
                                    level: warnLevel,
                                    title: warnTitle,
                                    description: warnDesc
                                }
                            });
                        }

                        var warn = new nWarning(warnLevel, warnTitle, warnDesc);

                        if (isDef(check.healing) && isObject(check.healing)) {
                            var hc = sha1(warnLevel + md5(warnTitle) + stringify(check.healing, void 0, ""));

                            var cHealing = clone(check.healing);
                            traverse(cHealing, (aK, aV, aP, aO) => {
                                if (isString(aO[aK]) && aK != "exec" && aK != "execOJob" && !aK.startsWith("warn")) {
                                    aO[aK] = templify(aO[aK], data).replace(/\n/g, "");
                                    try { 
                                        aO[aK] = af.eval(aO[aK]);
                                    } catch(e) {
                                        if (check.debug) 
                                            sprint({
                                                execId: uuid,
                                                healing: {
                                                    line: aO[aK],
                                                    exception: e
                                                }
                                            });
                                    }
                                }
                            });

                            var runHealing = isUnDef(nattrmon.isNotified(warnTitle, hc)) || cHealing.always
                            if (!runHealing && isNumber(cHealing.retryInMS) && !cHealing.always) {
                                var w = nattrmon.isNotified(warnTitle, hc);
                                var _w = nattrmon.getWarnings(true).getWarningByName(warnTitle)
                                if (isUnDef(cHealing.endRetriesInMS) || isDef(_w) && now() - (new Date(_w.createdate)).getTime() < cHealing.endRetriesInMS) {
                                    if (isDef(w) && now() - (new Date(w)).getTime() > cHealing.retryInMS) {
                                        runHealing = true;
                                        logWarn("Retrying healing for '" + warnTitle + "'...");
                                    }
                                }
                            }
                            if (runHealing) {
                                try {
                                    if (!cHealing.always && !(nattrmon.setNotified(warnTitle, hc, new Date()))) {
                                        if (isUnDef(warn.notified)) warn.notified = {};
                                        warn.notified[hc] = true;
                                    }
                                    if (isDef(cHealing.exec)) {
                                        logWarn("Running healing execution for '" + warnTitle + "'");
                                        (new Function('args', cHealing.exec))(cHealing.execArgs);
                                    }
                                    if (isDef(cHealing.execOJob)) {
                                        logWarn("Running healing ojob for '" + warnTitle + "'");
                                        oJobRunFile(cHealing.execOJob, cHealing.execArgs);
                                    }
                                    if (isMap(cHealing.execSh)) {
                                        logWarn("Running healing shell command for '" + warnTitle + "'")
                                        cHealing.execSh.cmd = _$(cHealing.execSh.cmd, "execSh.cmd").$_()
                                        cHealing.execSh.pwd = _$(cHealing.execSh.pwd, "execSh.pwd").isString().default(__)
                                        cHealing.execSh.dontWait = _$(cHealing.execSh.dontWait, "execSh.dontWait").isBoolean().default(__)
                                        cHealing.execSh.prefix = _$(cHealing.execSh.prefix, "execSh.prefix").isString().default(__)
                                        cHealing.execSh.envs = _$(cHealing.execSh.envs, "execSh.envs").isMap().default(__)
                                        cHealing.execSh.timeout = _$(cHealing.execSh.timeout, "execSh.timeout").isNumber().default(__)

                                        var _s = $sh(cHealing.execSh.cmd)
                                        if (isDef(cHealing.execSh.pwd))      _s = _s.pwd(cHealing.execSh.pwd)
                                        if (isDef(cHealing.execSh.dontWait)) _s = _s.dontWait(cHealing.execSh.dontWait)
                                        if (isDef(cHealing.execSh.prefix))   _s = _s.prefix(cHealing.execSh.prefix)
                                        if (isDef(cHealing.execSh.envs))     _s = _s.envs(cHealing.execSh.envs)
                                        if (isDef(cHealing.execSh.timeout))  _s = _s.timeout(cHealing.execSh.timeout)
                                        
                                        var _r 
                                        if (isDef(cHealing.execSh.prefix) && isUnDef(cHealing.execSh.timeout)) _r = _s.get(0); else _r = _s.exec(0)
                                        if (!cHealing.execSh.dontWait && _r.exitcode != 0) throw af.toSLON(_r)
                                    }
                                } catch(e) {
                                    logErr("Healing job failed for '" + warnTitle + "' with exception: " + String(e));
                                    if (cHealing.warnTitleTemplate) {
                                        var healWarnTitle = templify(cHealing.warnTitleTemplate, merge(data, { exceptionMessage: String(e) }));
                                        var healWarnDesc = templify(cHealing.warnDescTemplate, merge(data, { exceptionMessage: String(e) }));
                                        var healWarnLevel = this.levelMapper(cHealing.warnLevel);
                                        ret.push(new nWarning(healWarnLevel, healWarnTitle, healWarnDesc));
                                    }
                                }
                            }
                        }
                        ret.push(warn);
                    }
                }
            }
        }
    }
    return ret;
};

nValidation_Generic.prototype.validate = function(warns, scope, args) {
    var ret = [];
    
    if (isDef(args) && isDef(args.k) && isDef(args.v)) {
        if (args.op == "setall") {
            for(var ii in args.v) {
                var go = true
                if (isDef(this.params.attrPattern) && !args.v[ii].name.match(new RegExp(this.params.attrPattern))) go = false
                if (isDef(this.params.attribute) && !args.v[ii].name.match(new RegExp(this.params.attribute))) go = false
                if (isDef(this.params.titlePattern) && !args.v[ii].title.match(new RegExp(this.params.titlePattern))) go = false
                if (isDef(this.params.title) && !args.v[ii].title.match(new RegExp(this.params.title))) go = false
                if (go) ret = this.checkEntry(ret, args.k, args.v[ii], args)
            }
        }
        if (args.op == "set") {
            var go = true
            if (isDef(this.params.attrPattern) && !args.v.name.match(new RegExp(this.params.attrPattern))) go = false
            if (isDef(this.params.attribute) && !args.v.name.match(new RegExp(this.params.attribute))) go = false
            if (isDef(this.params.titlePattern) && !args.v.title.match(new RegExp(this.params.titlePattern))) go = false
            if (isDef(this.params.title) && !args.v.title.match(new RegExp(this.params.title))) go = false
            if (go) ret = this.checkEntry(ret, args.k, args.v, args)
        }
    } else {
        var cvals = scope.getCurrentValues();
        for(var i in cvals) {
            var go = true
            if (isDef(this.params.attrPattern) && !cvals[i].name.match(new RegExp(this.params.attrPattern))) go = false
            if (isDef(this.params.attribute) && !cvals[i].name.match(new RegExp(this.params.attribute))) go = false
            if (isDef(this.params.titlePattern) && !cvals[i].title.match(new RegExp(this.params.titlePattern))) go = false
            if (isDef(this.params.title) && !cvals[i].title.match(new RegExp(this.params.title))) go = false
            if (go) ret = this.checkEntry(ret, { name: cvals[i].name }, cvals[i], args)
        }
    }

    return ret;
};

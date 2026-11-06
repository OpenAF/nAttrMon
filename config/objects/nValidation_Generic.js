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
    this.__timedGroups = {};

    nValidation.call(this, this.validate);
};
inherit(nValidation_Generic, nValidation);

// Keep reconciliation and the wrapper's warning commit in one critical section.
// Otherwise an older failing run could commit after a newer healthy run closed it.
nValidation_Generic.prototype.exec = function(scope, args, meta) {
    return syncFn(() => nValidation.prototype.exec.call(this, scope, args, meta), this);
};

// Compiles (once per distinct pattern) and caches a RegExp -- was: `new RegExp`
// recompiled on every value/every event for what are, in practice, static patterns
// coming from this.params/check config. Bounded implicitly by the (small, static)
// set of distinct patterns actually configured.
// ----------------------------------------
// aPattern = regex source string
// Returns the cached RegExp
// ----------------------------------------
nValidation_Generic.prototype.__getRE = function(aPattern) {
    if (isUnDef(this.__reCache)) this.__reCache = {};
    if (isUnDef(this.__reCache[aPattern])) this.__reCache[aPattern] = new RegExp(aPattern);
    return this.__reCache[aPattern];
};

// Compiles (once per distinct source) and caches a healing-exec function -- was:
// `new Function` recompiled on every healing run for a static, per-check exec body.
// ----------------------------------------
// aSource = function body source string
// Returns the cached function
// ----------------------------------------
nValidation_Generic.prototype.__getFn = function(aSource) {
    if (isUnDef(this.__fnCache)) this.__fnCache = {};
    if (isUnDef(this.__fnCache[aSource])) this.__fnCache[aSource] = new Function('args', aSource);
    return this.__fnCache[aSource];
};

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

nValidation_Generic.prototype.checkEntry = function(ret, k, v, args, timedCandidates) {
    for (var i in this.params.checks) {
        var check = this.params.checks[i];
        if (isDef(check.for) != isDef(timedCandidates)) continue;
        var go = false

        if (isDef(v) &&
            ((isDef(check.attribute) && v.name == check.attribute) ||
             (isDef(check.attrPattern) && isString(v.name) && v.name.match(this.__getRE(check.attrPattern)))
            )
           ) {
            go = true
        }

        if (isDef(v) &&
            ((isDef(check.title) && v.title == check.title) ||
             (isDef(check.titlePattern) && isString(v.title) && v.title.match(this.__getRE(check.titlePattern)))
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
                    var data = {};
                    Object.keys(args || {}).forEach(key => { data[key] = args[key]; });

                    var evalCond = (aV) => {
                        var _decision = (isDef(check.not) && check.not) ? !aV : aV


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

                    var candidate = {
                        check: check, checkId: String(i), generateWarning: generateWarning,
                        data: data, uuid: uuid, warnLevel: warnLevel,
                        warnTitle: warnTitle, warnDesc: warnDesc
                    };
                    if (isDef(timedCandidates)) timedCandidates.push(candidate);
                    else this.__applyCheck(ret, candidate);
                }
            }
        }
    }
    return ret;
};

// Rendering and healing share the same row order for timed and untimed checks.
nValidation_Generic.prototype.__applyCheck = function(ret, candidate) {
    var check = candidate.check, generateWarning = candidate.generateWarning;
    var data = candidate.data, uuid = candidate.uuid, warnLevel = candidate.warnLevel;
    var warnTitle = candidate.warnTitle, warnDesc = candidate.warnDesc;
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
                        this.__getFn(cHealing.exec)(cHealing.execArgs);
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
};

nValidation_Generic.prototype.__matches = function(v) {
    if (isUnDef(v)) return false;
    var fields = { attrPattern: "name", attribute: "name", titlePattern: "title", title: "title" };
    for (var key in fields) {
        if (isDef(this.params[key]) && (!isString(v[fields[key]]) || !v[fields[key]].match(this.__getRE(this.params[key])))) return false;
    }
    return true;
};

// Buffered subscriptions reconcile against their source, not the partial event.
nValidation_Generic.prototype.__sourceSnapshot = function(scope, args) {
    var domain = isDef(args.ch) ? String(args.ch).replace(/::buffer$/, "") : "nattrmon::cvals";
    var rows;
    if (isDef(args.ch)) {
        if ($ch().list().indexOf(domain) < 0) throw "Timed validation source channel is unavailable: " + domain;
        rows = $ch(domain).getAll();
    } else {
        rows = scope.getCurrentValues();
    }
    if (!isArray(rows) && !isMap(rows)) throw "Timed validation snapshot is unavailable: " + domain;
    return { domain: domain, rows: clone(isArray(rows) ? rows : Object.keys(rows).map(key => rows[key])) };
};

nValidation_Generic.prototype.__reconcileTimed = function(ret, scope, args) {
    // Read before touching timer state. A failed read must never heal a warning.
    var snapshot = this.__sourceSnapshot(scope, args), candidates = [], groups = {};
    snapshot.rows.forEach(v => {
        if (this.__matches(v)) this.checkEntry(ret, { name: v.name, title: v.title }, v, args, candidates);
    });
    candidates.forEach(candidate => {
        var key = stringify([snapshot.domain, candidate.checkId, candidate.warnTitle], __, "");
        candidate.groupKey = key;
        if (isUnDef(groups[key])) groups[key] = { title: candidate.warnTitle, failing: false, check: candidate.check };
        if (candidate.generateWarning) groups[key].failing = true;
    });
    var time = nowUTC(), eligible = {}, previous = this.__timedGroups, closeTitles = [];
    Object.keys(groups).forEach(key => {
        var group = groups[key], old = previous[key];
        group.domain = snapshot.domain;
        if (group.failing) {
            group.since = isDef(old) && old.failing ? old.since : time;
            eligible[key] = time - group.since >= nattrmon.fromTimeAbbreviation(group.check.for);
        } else if (isUnDef(old) || old.failing) {
            closeTitles.push(group.title);
        }
        previous[key] = group;
    });
    Object.keys(previous).forEach(key => {
        var old = previous[key];
        if (old.domain == snapshot.domain && isUnDef(groups[key])) {
            if (old.failing) closeTitles.push(old.title);
            delete previous[key];
        }
    });
    closeTitles.forEach(title => this.closeWarning(title));
    candidates.forEach(candidate => {
        if (candidate.generateWarning && eligible[candidate.groupKey]) this.__applyCheck(ret, candidate);
    });
    return snapshot;
};

nValidation_Generic.prototype.validate = function(warns, scope, args) {
    args = args || {};
    var ret = [];
    var hasTimed = this.params.checks.some(check => isDef(check.for));
    var snapshot;
    if (hasTimed) snapshot = syncFn(() => this.__reconcileTimed(ret, scope, args), this);
    if (!this.params.checks.some(check => isUnDef(check.for))) return ret;

    // Untimed checks deliberately retain their event-local behavior.
    if (isDef(args.k) && isDef(args.v)) {
        if (args.op == "set" || args.op == "setall") {
            var values = args.op == "setall" ? args.v : [args.v];
            values.forEach(v => {
                if (this.__matches(v)) this.checkEntry(ret, args.k, v, args);
            });
        }
    } else if (args.op != "unset" && args.op != "unsetall") {
        var cvals = isDef(snapshot) ? snapshot.rows : scope.getCurrentValues();
        for (var i in cvals) {
            if (this.__matches(cvals[i])) this.checkEntry(ret, { name: cvals[i].name }, cvals[i], args);
        }
    }
    return ret;
};

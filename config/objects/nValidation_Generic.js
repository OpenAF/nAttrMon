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

nValidation_Generic.prototype.pathMapper = function (path) {
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

nValidation_Generic.prototype.checkEntry = function(ret, k, v, args) {
    for (var i in this.params.checks) {
        var check = this.params.checks[i]; 

        if (isDef(k) && 
            ((isDef(check.attribute) && k.name == check.attribute) || 
             (isDef(check.attrPattern) && k.name.match(new RegExp(check.attrPattern))) 
            )
           ) {
            var uuid;
            if (check.debug) uuid = genUUID();

            var warnLevel;
            switch (check.warnLevel) {
            case "HIGH": warnLevel = nWarning.LEVEL_HIGH; break;
            case "MEDIUM": warnLevel = nWarning.LEVEL_MEDIUM; break;
            case "LOW": warnLevel = nWarning.LEVEL_LOW; break;
            case "INFO": warnLevel = nWarning.LEVEL_INFO; break;
            default: warnLevel = nWarning.LEVEL_INFO; break;
            }

            var vals = [];
            if (!(isArray(v.val))) vals = [v.val]; else vals = v.val;

            for (var vv in vals) {
                var val;
                if (check.map) { val = this.pathMapper(check.map)(vals[vv]); print(val);} else val = vals[vv];

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

                    var evalCond = (aV) => { generateWarning = aV; };

                    data.value = val;
                    data.originalValue = v.val;
                    data.name = v.name;

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

                    var expr = templify(check.expr, data);
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
                        logWarn("Couldn't evalute expression: " + check.expr + " for attribute " + stringify(v, undefined, "") + "");
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
                        ret.push(new nWarning(warnLevel, warnTitle, warnDesc));
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
        ret = this.checkEntry(ret, args.k, args.v, args);
    } else {
        var cvals = scope.getCurrentValues();
        for(var i in cvals) {
            ret = this.checkEntry(ret, { name: cvals[i].name }, cvals[i], args);
        }
    }

    return ret;
};
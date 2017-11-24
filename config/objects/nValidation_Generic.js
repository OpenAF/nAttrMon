/**
 * <odoc>
 * <key>nattrmon.nValidation_Generic(aMap)</key>
 * Creates a nattrmon validation for Generic. On aMap you can provide:\
 * execArgs     :
 *    checks:
 *       - attrPattern      : test$
 *         less             : 200
 *         greaterEquals    : 100
 *         warnLevel        : HIGH
 *         warnTitleTemplate: A test warning
 *         warnDescTemplate : This is just a test warning. 
 * 
 *       - attrPattern      : test3
 *         map              : c
 *         equal            : 3
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

        if (isDef(k) && k.name.match(new RegExp(check.attrPattern))) {
            var warnLevel;
            switch (check.warnLevel) {
            case "HIGH": warnLevel = nWarning.LEVEL_HIGH; break;
            case "MEDIUM": warnLevel = nWarning.LEVEL_MEDIUM; break;
            case "LOW": warnLevel = nWarning.LEVEL_LOW; break;
            case "INFO": warnLevel = nWarning.LEVEL_INFO; break;
            default: warnLevel = nWarning.LEVEL_INFO; break;
            }

            var evalCond = (v) => { generateWarning = (check.or) ? generateWarning || v : generateWarning && v; };

            var vals = [];
            if (!(isArray(v.val))) vals = [v.val]; else vals = v.val;

            for (var v in vals) {
                var val;
                if (check.map) val = pathMapper(check.map)(vals[v]);
                else val = vals[v];

                if (isUnDef(check.warnTitleTemplate)) check.warnTitleTemplate = "{{name}}: Change me with warnTitleTemplate";
                if (isUnDef(check.warnDescTemplate))  check.warnDescTemplate  = "{{name}}: Change me with warnDescTemplate";

                var warnTitle = templify(check.warnTitleTemplate, merge(args, {
                    name: v.name,
                    value: val,
                    map: vals[v],
                    dateModified: v.date
                }));
                var warnDesc = templify(check.warnDescTemplate, merge(args, {
                    name: v.name,
                    value: val,
                    map: vals[v],
                    dateModified: v.date
                }));

                var generateWarning = true;
                if (Number.parseFloat(val) != null) {
                    if (check.less)          if (val < check.less) evalCond(true); else evalCond(false);
                    if (check.lessEquals)    if (val <= check.lessEquals) evalCond(true); else evalCond(false);
                    if (check.greater)       if (val > check.greater) evalCond(true); else evalCond(false);
                    if (check.greaterEquals) if (val >= check.greaterEquals) evalCond(true); else evalCond(false);
                }

                if (Object.prototype.toString.call(val) == "[object Date]") {
                    if (check.minutesLess)          if (ow.format.dateDiff.inMinutes(val) < check.minutesLess) evalCond(true); else evalCond(false);
                    if (check.minutesLessEquals)    if (ow.format.dateDiff.inMinutes(val) <= check.minutesLessEquals) evalCond(true); else evalCond(false);
                    if (check.minutesGreater)       if (ow.format.dateDiff.inMinutes(val) > check.minutesGreater) evalCond(true); else evalCond(false);
                    if (check.minutesGreaterEquals) if (ow.format.dateDiff.inMinutes(val) >= check.minutesGreaterEquals) evalCond(true); else evalCond(false);
                }
                
                if (isDef(v.date) && Object.prototype.toString.call(v.date) == "[object Date]") {
                    if (check.modifiedSecondsAgo)   if (ow.format.dateDiff.inSeconds(v.date) >= check.modifiedSecondsAgo) evalCond(true); else evalCond(false);
                    if (check.modifiedMinutesAgo)   if (ow.format.dateDiff.inMinutes(v.date) >= check.modifiedMinutesAgo) evalCond(true); else evalCond(false);
                    if (check.modifiedHoursAgo)     if (ow.format.dateDiff.inHours(v.date) >= check.modifiedHoursAgo) evalCond(true); else evalCond(false);
                    if (check.modifiedDaysAgo)      if (ow.format.dateDiff.inDays(v.date) >= check.modifiedDaysAgo) evalCond(true); else evalCond(false);
                }

                if (check.equal)
                    if (val == check.equal) evalCond(true);
                    else evalCond(false);
                if (check.not) generateWarning = !generateWarning;

                if (!generateWarning) {
                    this.closeWarning(warnTitle);
                } else {
                    ret.push(new nWarning(warnLevel, warnTitle, warnDesc));
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
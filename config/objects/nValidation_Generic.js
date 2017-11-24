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

nValidation_Generic.prototype.validate = function (warns, scope, args) {
    var ret = [];

    for (var i in args.checks) {
        if (args.k.name.match(new RegExp(args.checks[i].attrPattern))) {
            var warnLevel;
            switch (args.checks[i].warnLevel) {
                case "HIGH":
                    warnLevel = nWarning.LEVEL_HIGH;
                    break;
                case "MEDIUM":
                    warnLevel = nWarning.LEVEL_MEDIUM;
                    break;
                case "LOW":
                    warnLevel = nWarning.LEVEL_LOW;
                    break;
                case "INFO":
                    warnLevel = nWarning.LEVEL_INFO;
                    break;
            }

            var evalCond = (v) => {
                generateWarning = (args.checks[i].or) ? generateWarning || v : generateWarning && v;
            }

            var vals = [];
            if (!(isArray(args.v.val))) vals = [args.v.val];
            else vals = args.v.val;
            for (var v in vals) {
                var val;
                if (args.checks[i].map) val = pathMapper(args.checks[i].map)(vals[v]);
                else val = vals[v];

                var warnTitle = templify(args.checks[i].warnTitleTemplate, merge(args, {
                    name: args.v.name,
                    value: val,
                    map: vals[v],
                    dateModified: args.v.date
                }));
                var warnDesc = templify(args.checks[i].warnDescTemplate, merge(args, {
                    name: args.v.name,
                    value: val,
                    map: vals[v],
                    dateModified: args.v.date
                }));

                var generateWarning = true;
                if (isNumber(val)) {
                    if (args.checks[i].less)
                        if (val < args.checks[i].less) evalCond(true);
                        else evalCond(false);
                    if (args.checks[i].lessEquals)
                        if (val <= args.checks[i].lessEquals) evalCond(true);
                        else evalCond(false);
                    if (args.checks[i].greater)
                        if (val > args.checks[i].greater) evalCond(true);
                        else evalCond(false);
                    if (args.checks[i].greaterEquals)
                        if (val >= args.checks[i].greaterEquals) evalCond(true);
                        else evalCond(false);
                }

                if (args.checks[i].equal)
                    if (val == args.checks[i].equal) evalCond(true);
                    else evalCond(false);
                if (args.checks[i].not) generateWarning = !generateWarning;

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
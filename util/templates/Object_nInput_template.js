// Author: who

/**
 * <odoc>
 * <key>nattrmon.nInput_SomeObject(aMap)</key>
 * Provide some explanation of the objective of your input object.
 * On aMap expects:\
 * \
 *    - someVariable (Type) Description of variable.\
 *    - attrTemplate (String) The attribute template where to store the result.\
 * \
 * </odoc>
 */
var nInput_SomeObject = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Some default category/Some object";

    nInput.call(this, this.input);
};
inherit(nInput_SomeObject, nInput);

nInput_SomeObject.prototype.input = function(scope, args) {
    var ret = {};

    ret[templify(this.params.attrTemplate)] = {
        something: true
    };

    return ret;
};
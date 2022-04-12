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
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Some default category/Some object";

    nInput.call(this, this.input);
};
inherit(nInput_SomeObject, nInput);

nInput_SomeObject.prototype.get = function(keyData, extra) {
    extra = _$(extra, "extra").isMap().default(__)
    // Get metrics based on keyData or, if no chKeys is provided, check this.params
    var res = isString(keyData) ? { key: keyData } : {}

    // TODO

    return merge(res, extra)
}

nInput_SomeObject.prototype.input = function(scope, args) {
    var ret = {}

    /*ret[templify(this.params.attrTemplate)] = {
        something: true
    };*/

	if (isDef(this.params.chKeys)) {
        var arr = []
        $ch(this.params.chKeys).forEach((k, v) => {
            arr.push(this.get(merge(k, v)))
        })
        ret[templify(this.params.attrTemplate, this.params)] = arr
    } else {
        ret[templify(this.params.attrTemplate, this.params)] = this.get()
    }

    return ret;
};
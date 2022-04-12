// Author: who

/**
 * <odoc>
 * <key>nattrmon.nInput_ChVals(aMap)</key>
 * Returns a $from operation over all values of the provided channel
 * On aMap expects:\
 * \
 *    - chName (String) The channel name.\
 *    - filter (Map)    The filter map to apply (check ow.obj.filter).\
 *    - full   (Map)    Any data to use with $ch.getAll.\
 * \
 * </odoc>
 */
 var nInput_ChVals = function(aMap) {
    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {}
    }

    _$(this.params.chName, "chName").isString().$_()
    this.params.filter = _$(this.params.filter, "filter").isMap().default({})

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = this.params.chName + "/Values"

    nInput.call(this, this.input)
}
inherit(nInput_ChVals, nInput)

nInput_ChVals.prototype.get = function(extra) {
    extra = _$(extra).isMap().default({})
    // Get metrics based on keyData
    var data = $ch(this.params.chName).getAll(this.params.full)
    var res = nattrmon.filter(data, this.params.filter)

    return merge(res, extra)
}

nInput_ChVals.prototype.input = function(scope, args) {
    var ret = {}

    ret[templify(this.params.attrTemplate, this.params)] = this.get()

    return ret
}
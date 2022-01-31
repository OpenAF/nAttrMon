// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nInput_ESSearch(aMap)</key>
 * Provides an input as the result of an ElasticSearch search
 * On aMap expects:\
 * \
 *    - chKeys  ()\
 *    - url       (String)   The ElasticSearch URL\
 *    - user      (String)   The ElasticSearch user\
 *    - pass      (String)   The ElasticSearch pass\
 *    - index     (String)   The ElasticSearch index\
 *    - funcIndex (Function) An function that should return the index name to use\
 *    - format    (String)   The ElasticSearch index data format to use with index (ow.ch.utils.getElasticIndex)\
 *    - search    (Map)      The ElasticSearch map to use\
 *    - path      (String)   The ElasticSearch path to retrive the attribute value from the ElasticSearch result\
 * \
 * </odoc>
 */
var nInput_ESSearch = function(aMap) {
    if (isUnDef(getOPackPath("ElasticSearch"))) {
        throw "ElasticSearch opack not installed.";
    } 

    loadLib("elasticsearch.js")

    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.params.url  = _$(this.params.url, "url").isString().$_()
    this.params.user = _$(this.params.user, "user").isString().default(__)
    this.params.pass = _$(this.params.pass, "pass").isString().default(__)

    this.params.format = _$(this.params.format, "format").isString().default(__)
    this.params.search = _$(this.params.search, "search").isMap().$_()
    this.params.path   = _$(this.params.path, "path").isString().default(__)

    if (isUnDef(this.params.index) && isUnDef(this.params.funcIndex)) {
		throw "Please define either an index or a funcIndex"
	} else {
		if (isUnDef(this.params.format))
			this.funcIndex = (isDef(this.params.funcIndex)) ? af.eval(this.params.funcIndex) : new Function("return '" + this.params.index + "'")
		else
			this.funcIndex = ow.ch.utils.getElasticIndex(this.params.index, this.params.format)
	} 

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "ElasticSearch/Search metric"

    this.es = new ElasticSearch(this.params.url, this.params.user, this.params.pass)

    nInput.call(this, this.input);
};
inherit(nInput_ESSearch, nInput);

nInput_ESSearch.prototype.get = function(keyData, extra) {
    // Get metrics based on keyData
    var res = {}
    if (isDef(keyData.key)) res = { key: keyData }

    var res = this.es.search(this.funcIndex(), this.params.search)
    if (isDef(this.params.path)) res = $$(res).get(this.params.path)

    return merge(extra, res)
}

nInput_ESSearch.prototype.input = function(scope, args) {
    var ret = {}

	if (isDef(this.params.chKeys)) {
        var arr = []
        $ch(this.params.chKeys).forEach((k, v) => {
            arr.push(this.get(merge(k, v)))
        })
        ret[templify(this.params.attrTemplate, this.params)] = arr
    } else {
        ret[templify(this.params.attrTemplate, this.params)] = this.get(this.params, this.params.extra)
    }

    return ret;
};
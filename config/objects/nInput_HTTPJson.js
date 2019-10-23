// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nInput_HTTPJSon(aMap)</key>
 * Given an URL, corresponding verbs and connection options will retrieve a json content and return it as
 * an attribute. 
 * \
 * On aMap expects an "requests" map is the attribute to which it will be assigned:\
 * \
 *    - url          (String)       The url to where it should connect.\
 *    - method       (String)       The http verb to use (e.g. get, post, put, delete or patch).\
 *    - options      (Map)          Options equivalent to the options provided on the OpenAF $rest function.\
 *    - data         (Map)          Optional options to pass to the $rest command.\
 *    - idx          (Map)          Optional, depending on the method used, index options to pass to the $rest command.\
 *    - path         (String)       Optional, limit the json result to the result of applying ow.obj.getPath.\
 *    - fn           (String)       The contents of an OpenAF function that receives as input (json) the json result and returns the filtered attribute content.\
 * \
 * </odoc>
 */
var nInput_HTTPJson = function(aMap) {
    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.params.requests = _$(this.params.requests, "attributes").isMap().default({});

    for (var attr in this.params.requests) {
        _$(this.params.requests[attr].url).$_("Please provide an url.");
        _$(this.params.requests[attr].data, "data").isMap();
        _$(this.params.requests[attr].idx, "idx").isMap();
        _$(this.params.requests[attr].fn, "fn").isString();
        _$(this.params.requests[attr].path, "path").isString();

        this.params.requests[attr].method = _$(this.params.requests[attr].method).isString().default("get");
        _$(this.params.requests[attr].method.toLowerCase()).oneOf(["get", "put", "post", "delete", "patch"]);

        this.params.requests[attr].options = _$(this.params.requests[attr].options).isMap().default({});
    }

    nInput.call(this, this.input);
};
inherit(nInput_HTTPJson, nInput);

nInput_HTTPJson.prototype.input = function(scope, args) {
    var ret = {};

    for(var attr in this.params.requests) {
        var res = $rest(this.params.requests[attr].options);
        var resJson;

        switch(this.params.requests[attr].method) {
        case "get"   : resJson = res.get(this.params.requests[attr].url, this.params.requests[attr].idx); break;
        case "post"  : resJson = res.post(this.params.requests[attr].url, this.params.requests[attr].data, this.params.requests[attr].idx); break;
        case "put"   : resJson = res.put(this.params.requests[attr].url, this.params.requests[attr].data, this.params.requests[attr].idx); break;
        case "delete": resJson = res.delete(this.params.requests[attr].url, this.params.requests[attr].idx); break;
        case "patch" : resJson = res.patch(this.params.requests[attr].url, this.params.requests[attr].data, this.params.requests[attr].idx); break;
        }

        if (isDef(this.params.requests[attr].path)) {
            resJson = ow.obj.getPath(resJson, this.params.requests[attr].path);
        }

        if (isDef(this.params.requests[attr].fn)) {
            resJson = (new Function('json', this.params.requests[attr].fn))(resJson);
        }

        ret[attr] = resJson;
    }

    return ret;
};
/**
 * <odoc>
 * <key>nattrmon.nInput_AFPing(aMap) : nInput</key>
 * aMap is composed of:\
 *    - keys (a map with key and URL or an array of maps with key and URL for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a template for the name of the attribute))\
 *    - single (boolean when false display the corresponding key)\
 *    - timeout (number of how many ms to try to connect (defaults to 5000ms))
 * </odoc>
 */
var nInput_AFPing = function (anUrl, attributeName) {
  if (isUnDef(getOPackPath("OpenCli"))) {
    throw "OpenCli opack not installed.";
  } 
  
  if (isObject(anUrl)) {
    this.params = anUrl;

    if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Server status/Ping";

    if (!(isArray(this.params.keys))) {
      this.params.keys = [this.params.keys];
      this.params.single = true;
    } else {
      this.params.single = false;
    }

    this.url = this.params.url;
    this.keys = this.params.param;
    this.attrTemplate = this.params.attrTemplate;
  } else {
    this.url = anUrl;
    this.attributeName = (isUnDef(attributeName)) ? "Server status/" + anMonitoredAFObjectKey + " alive" : attributeName;
  }

  if (isUnDef(this.params.timeout)) this.timeout = this.params.timeout; else this.timeout = 5000;

  nInput.call(this, this.input);
};
inherit(nInput_AFPing, nInput);

nInput_AFPing.prototype.ping = function (n, u) {
  var res = false, err = void 0;
  try {
    var a = new AF(u, this.timeout);
    var r = a.exec("Ping", {
      "a": 1
    }, void 0, true);
    if (r.a == 1) res = true;
    a.close();
  } catch (e) {
    res = false;
    err = String(e);
  }

  if (this.single)
    return res;
  else
    return {
      "Name": n,
      "Alive": res,
      "Error": err
    };
}

nInput_AFPing.prototype.input = function (scope, args) {
  var ret = {};
  var arr = [];

  if (isDef(this.params.chKeys)) this.params.keys = $from($ch(this.params.chKeys).getAll()).select({
    "url": "",
    "key": ""
  }).sort(function (a, b) {
    return a.key.toUpperCase() > b.key.toUpperCase() ? 1 : 0
  });

  for (var i in this.params.keys) {
    arr.push(this.ping(this.params.keys[i].key, this.params.keys[i].url));
  }

  if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = this.attributename;
  ret[templify(this.params.attrTemplate)] = arr;

  return ret;
};
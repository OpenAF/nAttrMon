// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_AWSCloudWatch(aMap)</key>
 * Will output attribute metrics to AWS CloudWatch
 * \
 * On aMap expects:\
 * \
 *    - include        (Array)   Array of regex attributes to include on output.\
 *    - exclude        (Array)   Array of regex attributes to exclude from output.\
 *    - considerSetAll (Boolean) Should process attributes in bulk.\
 *    - region         (String)  The AWS region to use (defaults to us-east-1)\
 *    - logGroup       (String)  The AWS CloudWatch log group to use (defaults to nattrmon)\
 *    - accessKey      (String)  The AWS API access key to put metrics in AWS CloudWatch\
 *    - secretKey      (String)  The AWS API secret key to put metrics in AWS CloudWatch\
 *    - sessionToken   (String)  The AWS API session token to put metrics in AWS CloudWatch\
 * \
 * </odoc>
 */
var nOutput_AWSCloudWatch = function(aMap) {
	if (getVersion() < "20220209") throw "nOutput_AWSCloudWatch requires OpenAF version >= 20220209"

    if (!isNull(aMap) && isMap(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }

    this.include = aMap.include;
	this.exclude = aMap.exclude;

    if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";
	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true;

	this.params.region   = _$(this.params.region, "aws region").isString().default("us-east-1")
	this.params.logGroup = _$(this.params.logGroup, "aws cloudwatch logGroup").isString().default("nattrmon")

	this.params.accesskey    = _$(this.params.accessKey, "aws accesskey").isString().default(__)
	this.params.secretkey    = _$(this.params.secretkey, "aws secretkey").isString().default(__)
	this.params.sessiontoken = _$(this.params.sessiontoken, "aws sessiontoken").isString().default(__)

    nOutput.call(this, this.output);
};
inherit(nOutput_AWSCloudWatch, nOutput);

nOutput_AWSCloudWatch.prototype.output = function(scope, args) {
	if (args.op != "setall" && args.op != "set") return;
	if (args.op == "setall" && !this.considerSetAll) return;

	var k, v, ch = args.ch;
	if (args.op == "set") {
		k = [args.k];
		v = [args.v];
	} else {
		k = args.k;
		v = args.v;
	}

	ow.loadMetrics()
	var vals = [], metrics = []
    v.forEach(value => {
		var isok = isDef(this.include) ? false : true;
		var isWarns = (ch == "nattrmon::warnings" || ch == "nattrmon::warnings::buffer");
		var kk = (isWarns) ? value.title : value.name;

        if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0;
        if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0;
        if (isok) {
			var _m = ow.metrics.fromObj2OpenMetrics(value.val, value.name, value.date)
			ow.metrics.fromOpenMetrics2Array(_m).forEach(m => {
				var dims = Object.keys(m.labels).map(k => {
					return { Name: k, Value: m.labels[k] }
				})
				metrics.push({
					MetricName: m.metric,
					Timestamp : (new Date(m.timestamp)).toISOString(),
					Unit      : "None",  // To be enhanced in the future
					Value     : m.value,
					Dimensions: dims
				})
			})
		}
    })
	if (metrics.length > 0) {
		loadLib("aws.js")
		var aws = new AWS(this.params.accesskey, this.params.secretkey, this.params.sessiontoken)
		aws.CLOUDWATCH_PutMetricData(this.params.region, this.params.logGroup, metrics)
	}
};
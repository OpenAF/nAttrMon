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
 *    - includeDim     (Array)   Array of labels to include on output.\
 *    - excludeDim     (Array)   Array of labels to exclude from output.\
 *    - unitByMetric   (Map)     Optional unit to report per metric (the metric is the attribute name replacing " " and "/" by "_")\
 *    - considerSetAll (Boolean) Should process attributes in bulk.\
 *    - region         (String)  The AWS region to use (defaults to us-east-1)\
 *    - logGroup       (String)  The AWS CloudWatch log group to use (defaults to nattrmon)\
 *    - accessKey      (String)  The AWS API access key to put metrics in AWS CloudWatch\
 *    - secretKey      (String)  The AWS API secret key to put metrics in AWS CloudWatch\
 *    - sessionToken   (String)  The AWS API session token to put metrics in AWS CloudWatch\
 *    - debug          (Boolean) Shows additional information logs in case of error\
 * \
 * List of units by metric according with AWS documentation: Seconds | Microseconds | Milliseconds | Bytes | Kilobytes | Megabytes | Gigabytes | Terabytes | Bits | Kilobits | Megabits | Gigabits | Terabits | Percent | Count | Bytes/Second | Kilobytes/Second | Megabytes/Second | Gigabytes/Second | Terabytes/Second | Bits/Second | Kilobits/Second | Megabits/Second | Gigabits/Second | Terabits/Second | Count/Second | None\
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

	this.include = aMap.include
	this.exclude = aMap.exclude
	this.includeDim = _$(aMap.includeDim, "includeDim").isArray().default([])
	this.excludeDim = _$(aMap.excludeDim, "excludeDim").isArray().default([])
	this.unitByMetric = _$(aMap.unitByMetric, "unitByMetric").isMap().default({})

	// Avoid an extra dimension on arrays
	this.excludeDim.unshift("_id")

	if (isDef(this.include) && !isArray(this.include)) throw "Include needs to be an array";
	if (isDef(this.exclude) && !isArray(this.exclude)) throw "Exclude needs to be an array";
	this.considerSetAll = (isDef(aMap.considerSetAll)) ? aMap.considerSetAll : true;

	this.params.region = _$(this.params.region, "aws region").isString().default("us-east-1")
	this.params.logGroup = _$(this.params.logGroup, "aws cloudwatch logGroup").isString().default("nattrmon")

	this.params.accesskey = _$(this.params.accessKey, "aws accesskey").isString().default(__)
	this.params.secretkey = _$(this.params.secretkey, "aws secretkey").isString().default(__)
	this.params.sessiontoken = _$(this.params.sessiontoken, "aws sessiontoken").isString().default(__)

	this.params.debug = _$(this.params.debug, "aws debug").isBoolean().default(false)

	nOutput.call(this, this.output);
};
inherit(nOutput_AWSCloudWatch, nOutput);

// Necessary for older AWS opack versions
nOutput_AWSCloudWatch.prototype.imds = function() {
	var _role, _cred, _token
	ow.loadNet()

	if (ow.net.testPort("169.254.169.254", 80)) {
		// IMDSv1
		var url = "http://169.254.169.254/latest/meta-data"
		var uris = "/iam/security-credentials"
		try {
			var _res = $rest().get(url)
			if (isMap(_res) && isDef(_res.responseCode) && _res.responseCode == 200) {
				var _r = $rest().get(url + uris)
				if (isMap(_r) && isDef(_r.error) && isDef(_r.error.responseCode) && _r.error.responseCode == 404) {
					throw "Problem trying to use IMDSv1: No IAM role was found."
				} else {
					if (isMap(_r)) throw "Problem trying to use IMDSv1: " + af.toSLON(_r)
					_role = _r.trim().split("\n")[0]
					_cred = $rest().get(url + uris + "/" + _role)
					if (_cred.Code != "Success") throw "Problem trying to use IMDSv1: " + af.toSLON(_cred)
				}
			} else {
				if (isMap(_res) && isDef(_res.error) && _res.error.responseCode != 401) {
					throw "error accessing IMDS: " + af.toSLON(_res) + (_res.error.responseCode == 403 ? " (Is the AWS instance metadata service enabled?)" : "")
				}

				// IMDSv2
				_token = $rest({ requestHeaders: { "X-aws-ec2-metadata-token-ttl-seconds": 21600 } }).put("http://169.254.169.254/latest/api/token")
				var rh = { requestHeaders: { "X-aws-ec2-metadata-token": _token } }
				var _r = $rest(rh).get(url + uris)
				if (isMap(_r) && isDef(_r.error) && isDef(_r.error.responseCode) && _r.error.responseCode == 404) {
					throw "Problem trying to use IMDSv2: No IAM role was found."
				} else {
					if (isMap(_r)) throw "Problem trying to use IMDSv2: " + af.toSLON(_r)
					_role = _r.trim().split("\n")[0]
					_cred = $rest(rh).get(url + uris + "/" + _role)
					if (_cred.Code != "Success") throw "Problem trying to use IMDSv2: " + af.toSLON(_cred)
				}
			}
		} catch (e) {
			throw "Problem trying to determine or use AWS IMDS: " + String(e)
		}

		return {
			accessKey: _cred.AccessKeyId,
			secretKey: _cred.SecretAccessKey,
			token: _cred.Token
		}
	} else {
		logWarn("No AWS IMDS found.")
	}
}

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
			var lblFilter = label => {
				if (this.excludeDim.indexOf(label) >= 0) return false
				if (this.includeDim.indexOf(label) >= 0) return true
				return true
			}
			var _m = ow.metrics.fromObj2OpenMetrics(value.val, value.name, value.date)
			ow.metrics.fromOpenMetrics2Array(_m).forEach(m => {
				var dims = Object.keys(m.labels).filter(k => isDef(m.labels[k]) && lblFilter(k) && String(m.labels[k]).length > 0).map(k => {
					return { Name: k, Value: m.labels[k] }
				})
				if (isNumber(m.value)) {
					try {
						var _d = (new Date(m.timestamp)).toISOString()

						if (isDate(new Date(_d))) {
							metrics.push({
								MetricName: m.metric,
								Timestamp: _d,
								Unit: (isDef(this.unitByMetric[m.metric]) ?  this.unitByMetric[m.metric] : "None"),
								Value: m.value,
								Dimensions: dims
							})
						}
					} catch (ee) {
					}
				}
			})
		}
	})
	if (metrics.length > 0) {
		loadLib("aws.js")
		var aws
		if (isUnDef(this.params.accesskey) && isUnDef(this.params.secretkey) && isUnDef(this.params.sessiontoken)) {
			var _c = this.imds()
			aws = new AWS(_c.accessKey, _c.secretKey, _c.token)
		} else {
			aws = new AWS(this.params.accesskey, this.params.secretkey, this.params.sessiontoken)
		}
		var res = aws.CLOUDWATCH_PutMetricData(this.params.region, this.params.logGroup, metrics)
		if (isMap(res) && isDef(res.ErrorResponse)) {
			logWarn(af.toSLON(res) + (this.params.debug ? stringify(metrics, __, "") : ""))
		}
	}
}
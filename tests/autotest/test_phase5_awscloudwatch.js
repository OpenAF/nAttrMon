// Phase 5.2 -- #23: nOutput_AWSCloudWatch.js read params.secretkey/sessiontoken
// (lowercase) while users supply secretKey/sessionToken (camelCase, per the
// odoc) -- explicit credentials were silently dropped, falling through to
// IMDS. Also fixes: a new AWS client (and, for IMDS, a fresh instance-metadata
// fetch) was built on every single flush -- now cached, with IMDS-derived
// credentials refreshed only within 60s of their Expiration.
//
// loadLib("aws.js") is called for real once (cheap: just defines the AWS
// class, no network) so __loadedLibs marks it loaded; every later
// loadLib("aws.js") call from output()/getClient() is then a no-op and won't
// clobber the counting stub installed over global.AWS.

ow.test.test("nOutput_AWSCloudWatch::reads camelCase accessKey/secretKey/sessionToken as documented", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_AWSCloudWatch.js")

	var o = new nOutput_AWSCloudWatch({ accessKey: "AK", secretKey: "SK", sessionToken: "ST" })
	ow.test.assert(o.params.accesskey, "AK", "accessKey should be read into params.accesskey")
	ow.test.assert(o.params.secretkey, "SK", "secretKey (camelCase) should be read into params.secretkey, not dropped")
	ow.test.assert(o.params.sessiontoken, "ST", "sessionToken (camelCase) should be read into params.sessiontoken, not dropped")
})

ow.test.test("nOutput_AWSCloudWatch::getClient() caches the AWS client across calls when using static credentials", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_AWSCloudWatch.js")
	loadLib("aws.js")

	var constructCount = 0
	global.AWS = function(accessKey, secretKey, token) {
		constructCount++
		this.CLOUDWATCH_PutMetricData = function() { return {} }
	}

	var o = new nOutput_AWSCloudWatch({ accessKey: "AK", secretKey: "SK", sessionToken: "ST" })
	var c1 = o.getClient()
	var c2 = o.getClient()

	ow.test.assert(constructCount, 1, "only one AWS client should be constructed across repeated getClient() calls")
	ow.test.assert(c1 === c2, true, "the same cached client instance should be returned")
})

ow.test.test("nOutput_AWSCloudWatch::getClient() caches IMDS credentials and only refreshes near expiration", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_AWSCloudWatch.js")
	loadLib("aws.js")

	var constructCount = 0
	global.AWS = function(accessKey, secretKey, token) {
		constructCount++
		this.CLOUDWATCH_PutMetricData = function() { return {} }
	}

	var o = new nOutput_AWSCloudWatch({})
	var imdsCalls = 0
	o.imds = function() {
		imdsCalls++
		return { accessKey: "IK", secretKey: "IS", token: "IT", expiration: now() + 120000 }
	}

	o.getClient()
	o.getClient()
	ow.test.assert(imdsCalls, 1, "IMDS should only be queried once while the cached credentials are far from expiring")
	ow.test.assert(constructCount, 1, "only one AWS client should be constructed while credentials remain valid")

	// Simulate the cached credentials nearing their expiration
	o.__awsExpiration = now() + 30000
	o.getClient()
	ow.test.assert(imdsCalls, 2, "credentials within 60s of expiration should trigger a refresh")
	ow.test.assert(constructCount, 2, "a refreshed credential set should rebuild the AWS client")
})

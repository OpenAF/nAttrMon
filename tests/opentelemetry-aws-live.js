// Explicit opt-in only. Sends one gauge and one warning; creates no infrastructure.
if (getEnv("NATTRMON_OTEL_AWS_LIVE") != "1") {
	print("Skipped: set NATTRMON_OTEL_AWS_LIVE=1 to send and verify live AWS telemetry")
	exit(0)
}
try {
	load("lib/noutput.js")
	load("config/objects/nOutput_OpenTelemetry.js")
	var region = getEnv("AWS_REGION"), group = getEnv("NATTRMON_OTEL_LOG_GROUP"), stream = getEnv("NATTRMON_OTEL_LOG_STREAM")
	var output = new nOutput_OpenTelemetry({ aws: { region: region, logGroup: group, logStream: stream }, maxRetries: 0 })
	var started = Date.now(), run = String(started), metric = "nattrmon_aws_smoke_" + run, warning = "nattrmon-aws-smoke-" + run
	print("AWS smoke metric: " + metric + "; warning: " + warning)
	var sentMetric = output.output({}, { op: "set", ch: "nattrmon::cvals", v: { name: "aws_smoke_" + run, val: 1, date: new Date(started) } })
	var sentLog = output.output({}, { op: "set", ch: "nattrmon::warnings", v: { title: warning, description: warning, level: "Info", lastupdate: new Date(started) } })
	if (sentMetric.sent != 1 || sentLog.sent != 1) throw new Error("ingestion was not acknowledged")
	// Use the same credential discovery and signed HTTP transport for read verification.
	var read = function(service, path, body, headers) {
		var url = "https://" + service + "." + region + ".amazonaws.com" + path
		var signed = output.awsClient.signRequest({ method: "POST", url: url, region: region, service: service, body: body, headers: headers, timeoutMs: 5000 })
		var h = new ow.obj.http(undefined, undefined, undefined, undefined, undefined, 5000, undefined,
			{ callTimeout: 5000, followRedirects: false, followSslRedirects: false })
		try {
			h.setThrowExceptions(false)
			var result = h.exec(url, "POST", body, signed)
			if (result.responseCode != 200) throw new Error("verification HTTP " + result.responseCode)
			return JSON.parse(result.response)
		} finally { h.close() }
	}
	var metricSeen = false, logSeen = false, deadline = Date.now() + 180000
	while (Date.now() < deadline && (!metricSeen || !logSeen)) {
		if (!metricSeen) {
			var data = read("monitoring", "/api/v1/query", "query=" + encodeURIComponent('{__name__="' + metric + '"}') + "&time=" + (started / 1000), { "Content-Type": "application/x-www-form-urlencoded" })
			metricSeen = data.status == "success" && isMap(data.data) && isArray(data.data.result) && data.data.result.some(r => isArray(r.value) && Number(r.value[1]) == 1)
		}
		if (!logSeen) {
			var data = read("logs", "/", JSON.stringify({ logGroupName: group, logStreamNames: [stream], startTime: started - 1000, filterPattern: '"' + warning + '"' }),
				{ "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "Logs_20140328.FilterLogEvents" })
			logSeen = isArray(data.events) && data.events.some(e => String(e.message).indexOf(warning) >= 0)
		}
		if (!metricSeen || !logSeen) sleep(5000, true)
	}
	if (!metricSeen || !logSeen) throw new Error("arrival unconfirmed: metric=" + metricSeen + ", warning=" + logSeen)
	print("Verified: one gauge and one warning arrived in AWS")
	exit(0)
} catch(e) {
	// Never print provider/remote error text or request headers.
	printErr("AWS smoke failed; inspect destination and IAM permissions using the printed run identifiers")
	exit(1)
}

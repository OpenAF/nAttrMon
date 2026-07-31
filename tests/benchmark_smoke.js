// nAttrMon benchmark smoke profile
// Run: openaf -f tests/benchmark_smoke.js
//
// Captures baseline timing metrics for:
// 1) engine startup time
// 2) no-op plug execution latency
// 3) repeated runtime snapshot collection

var __selfPath = String(__scriptfile).replace(/\\/g, "/")
var NATTRMON_HOME = __selfPath.replace(/\/?tests\/benchmark_smoke\.js$/, "")
if (NATTRMON_HOME == __selfPath) NATTRMON_HOME = "."
if (!io.fileExists(NATTRMON_HOME + "/lib/nmain.js")) NATTRMON_HOME = "."

global.NATTRMON_HOME = NATTRMON_HOME
load(NATTRMON_HOME + "/tests/autotest/harness.js")

var runs = 5
var startupMs = []
var plugExecMs = []
var snapshotMs = []

for (var i = 0; i < runs; i++) {
	var t0 = now()
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: true }, { name: "bench" + i })
	startupMs.push(now() - t0)

	try {
		nm.addInput({ name: "bench.noop", timeInterval: 0, waitForFinish: true }, new nInput(function(scope, args) {
			return { "bench/noop": { val: 1 } }
		}), {})

		var t1 = now()
		nm.execPlugs(nm.PLUGINPUTS)
		plugExecMs.push(now() - t1)

		var t2 = now()
		for (var j = 0; j < 20; j++) nm.getRuntimeMetricsSnapshot()
		snapshotMs.push(now() - t2)
	} finally {
		harness.stopEngine(nm)
	}
}

var avg = arr => (arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : -1)
var min = arr => (arr.length > 0 ? Math.min.apply(__, arr) : -1)
var max = arr => (arr.length > 0 ? Math.max.apply(__, arr) : -1)

var report = {
	ts: (new Date()).toISOString(),
	runs: runs,
	startupMs: { avg: avg(startupMs), min: min(startupMs), max: max(startupMs), samples: startupMs },
	plugExecMs: { avg: avg(plugExecMs), min: min(plugExecMs), max: max(plugExecMs), samples: plugExecMs },
	runtimeSnapshot20xMs: { avg: avg(snapshotMs), min: min(snapshotMs), max: max(snapshotMs), samples: snapshotMs }
}

print(stringify(report, __, "  "))

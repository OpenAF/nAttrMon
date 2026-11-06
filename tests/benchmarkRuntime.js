// Observational benchmarks; correctness is covered by hermetic operation-count tests.
// Run: openaf -f tests/benchmarkRuntime.js
var NATTRMON_HOME = String(__scriptfile).replace(/\/?tests\/benchmarkRuntime\.js$/, "") || "."
load(NATTRMON_HOME + "/tests/autotest/harness.js")
var measure = function(fn) { var t = now(); fn(); return now() - t }
var originalSee = function(key, attr) {
	var timestamp = isDef(attr.date) ? new Date(attr.date).getTime() : __
	var fresh = !isDefined(this.lastSeen[key]), changed = !fresh && this.lastSeen[key] != timestamp
	if (fresh) {
		var keys = Object.keys(this.lastSeen), seen = this.lastSeen
		if (keys.length >= this.MAX_LASTSEEN_ENTRIES) {
			keys.sort((a, b) => (seen[a] || 0) - (seen[b] || 0))
			for (var j = 0; j < Math.ceil(keys.length * 0.25); j++) delete seen[keys[j]]
		}
	}
	this.lastSeen[key] = timestamp
	return changed
}
var oldOutput = new nOutput(() => {}), newOutput = new nOutput(() => {})
var fill = (out, fn) => { for (var i = 0; i < 10000; i++) fn.call(out, "attribute" + i, { date: new Date(i) }) }
var before = measure(() => fill(oldOutput, originalSee)), after = measure(() => fill(newOutput, newOutput.see))
if (!compare(oldOutput.lastSeen, newOutput.lastSeen)) throw "Deduplication results differ"
print("lastSeen: 10000 inserts, cap 8192; before=" + before + "ms after=" + after + "ms; equal=true")
var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "benchmark-runtime" })
try {
	var p = { getName: () => "bench", type: "input", getCron: () => __, aTime: 1000, waitForFinish: true }
	for (var i = 0; i < 1000; i++) nm.threadsSessions["s" + i] = { entry: p, count: now() }
	for (var j = 0; j < 3000; j++) $ch(nm.chPS).set({ id: j }, { id: j, uuid: "s" + (j % 1000) })
	var source = String(nm.getRuntimeMetricsSnapshot).replace('var _running = _runningByUUID[uuid] || 0', 'var _running = $from(_ps).equals("uuid", uuid).count()')
	if (source.indexOf('$from(_ps)') < 0) throw "Cannot construct baseline snapshot reference"
	var legacy = (new Function("return (" + source + ")"))(), a, b
	before = measure(() => { a = legacy.call(nm) })
	after = measure(() => { b = nm.getRuntimeMetricsSnapshot() })
	if (!compare(a.scheduler.threads.map(t => t.running), b.scheduler.threads.map(t => t.running))) throw "Runtime counts differ"
	print("runtime: 1000 sessions / 3000 statuses; before=" + before + "ms after=" + after + "ms; equal=true")
} finally { harness.stopEngine(nm) }
exit(0)

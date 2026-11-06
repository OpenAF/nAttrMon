// Separate-process snapshot writers and deterministic schedulers keep these checks hermetic.
loadLib(NATTRMON_HOME + "/lib/nmetrics.js")
loadLib(NATTRMON_HOME + "/lib/nmetricsview.js")
loadLib(NATTRMON_HOME + "/lib/ndashboards.js")

var __inspectionFixture = function(overrides) {
	harness.resetGlobals()
	harness.resetChannels()
	var dir = harness.tmpDir("inspection")
	io.mkdir(dir + "/snapshots")
	harness.setGlobals(merge({
		__NAM_NEED_CH_PERSISTENCE: true, __NAM_CH_PERSISTENCE_PATH: dir + "/snapshots",
		__NAM_LOGCONSOLE: false, __NAM_LOGAUDIT: true, __NAM_BUFFERCHANNELS: true,
		__NAM_CLOSEDHK_ONSTARTUP: true, __NAM_CLOSEDHK_HOWLONGAGOINMS: 1,
		__NAM_RUNTIME_METRICS: true, __NAM_RUNTIME_METRICS_PERSIST: true, __NAM_RUNTIME_OWMETRICS: true,
		__NAM_NOPLUGFILES: false
	}, overrides || {}))
	return { dir: dir, snapshots: dir + "/snapshots", config: dir + "/config" }
}

var __inspectionWrite = function(f, data, corrupt) {
	var script = f.dir + "/writer.js"
	io.writeFileString(script, "var data = " + stringify(data) + ";\nvar path = " + stringify(f.snapshots) + ";\nObject.keys(data).forEach(k => io.writeFileBytes(path + '/nattrmon.' + k + '.snapshot', compress(data[k])));\n" +
		"var corrupt = " + stringify(corrupt || []) + ";\ncorrupt.forEach(k => io.writeFileString(path + '/nattrmon.' + k + '.snapshot', 'partial'));\nprint('writer-ok');\n")
	var result = $sh(["openaf", "-f", script]).get(0)
	ow.test.assert(result.exitcode, 0, "independent snapshot writer exits successfully: " + result.stderr)
	ow.test.assert(String(result.stdout).indexOf("writer-ok") >= 0, true, "writer executes before the reader refreshes")
}

var __inspectionAttrs = function(names) {
	return names.map(name => ({ name: name, type: nAttribute.TYPE_NUMBER, description: name, category: ["Metric"], tags: [] }))
}

var __inspectionFakeScheduler = function(fn) {
	plugin("Threads")
	var original = Threads, pools = []
	try {
		Threads = function() {
			var pool = this
			pools.push(pool)
			pool.stopped = false
			pool.initScheduledThreadPool = function(n) { pool.workers = n }
			pool.addScheduleThreadWithFixedDelay = function(callback, period) {
				pool.callback = callback; pool.period = period
				callback() // Threads' actual immediate first callback, made deterministic.
			}
			pool.advance = function() { if (!pool.stopped) pool.callback() }
			pool.stop = function() { pool.stopped = true }
		}
		fn(pools)
	} finally { Threads = original }
}

ow.test.test("inspection::construction attaches no writers, housekeeping, collectors or plugs", () => {
	var f = __inspectionFixture()
	var libMarker = f.dir + "/library.js"
	io.writeFileString(libMarker, "global.__inspectionPlugExecuted = true\n")
	io.mkdir(f.config + "/inputs")
	io.writeFileString(f.config + "/inputs/run.js", "global.__inspectionPlugExecuted = true\n")
	__NAM_LIBS = libMarker
	global.__inspectionPlugExecuted = false
	var calls = { persistence: 0, subscribers: 0, collector: 0, writes: 0 }
	var persistence = ow.ch.persistence.create, subscribe = ow.ch.subscribe
	var collector = nAttrMon.prototype.initRuntimeMetricsCollector, writeBytes = io.writeFileBytes
	var nm
	try {
		ow.ch.persistence.create = function() { calls.persistence++ }
		ow.ch.subscribe = function() { calls.subscribers++ }
		nAttrMon.prototype.initRuntimeMetricsCollector = function() { calls.collector++ }
		io.writeFileBytes = function() { calls.writes++ }
		nm = new nAttrMon(f.config, false, { inspection: true })
		global.nattrmon = nm
		nm.publishRuntimeMetrics("periodic")
		ow.test.assert(calls, { persistence: 0, subscribers: 0, collector: 0, writes: 0 }, "viewer must attach no background writers or consumers")
		ow.test.assert(isUnDef(nm.thread) && isUnDef(nm.sch), true, "viewer owns no daemon scheduler")
		ow.test.assert(nm.threads.length, 0, "viewer starts no daemon threads")
		ow.test.assert(global.__inspectionPlugExecuted, false, "configured libraries and plugs remain unexecuted")
		ow.test.assert(io.fileExists(f.config + "/log"), false, "viewer does not create logging state")
		var rejected = false
		try { nm.start() } catch(e) { rejected = String(e).indexOf("inspection mode") >= 0 }
		ow.test.assert(rejected, true, "inspection cannot accidentally start plugs later")
	} finally {
		ow.ch.persistence.create = persistence; ow.ch.subscribe = subscribe
		nAttrMon.prototype.initRuntimeMetricsCollector = collector; io.writeFileBytes = writeBytes
		delete global.__inspectionPlugExecuted
		harness.stopEngine(nm)
	}
})

ow.test.test("inspection::separate writer refreshes configured snapshots and preserves last-good timestamps", () => {
	var f = __inspectionFixture()
	var nm = new nAttrMon(f.config, false, { inspection: true })
	global.nattrmon = nm
	var m = new nMetrics(nm)
	var firstDate = "2026-01-01T00:00:00.000Z", nextDate = "2026-01-01T00:00:01.000Z"
	try {
		ow.test.assert(m.runtimeSnapshot().source, "unavailable", "before a valid snapshot the data is unavailable")
		ow.test.assert(m.snapshot().length, 0, "no attributes are invented before a valid snapshot")
		// A different default directory must never shadow the configured snapshot directory.
		io.writeFileBytes(f.config + "/nattrmon.attrs.snapshot", compress(__inspectionAttrs(["Wrong/Directory"])))
		__inspectionWrite(f, { attrs: __inspectionAttrs(["Metric/A"]), cvals: [{ name: "Metric/A", val: 1, date: firstDate }], runtimehistory: [{ t: 100, plugs: { totalErrors: 1 } }] })
		ow.test.assert(m.match(), ["Metric/A"], "new commands discover the writer's attributes from configured snapshot path")
		ow.test.assert(m.get("Metric/A").value, 1, "reader sees writer's current value")
		ow.test.assert(m.runtimeSnapshot().ts, 100, "reader retains the writer's runtime timestamp")
		var hashes = {}
		;["attrs", "cvals", "runtimehistory"].forEach(k => { hashes[k] = sha1(io.readFileBytes(f.snapshots + "/nattrmon." + k + ".snapshot")) })
		m.snapshot(); m.runtimeSnapshot()
		Object.keys(hashes).forEach(k => ow.test.assert(sha1(io.readFileBytes(f.snapshots + "/nattrmon." + k + ".snapshot")), hashes[k], "inspection never writes the " + k + " snapshot"))
		__inspectionWrite(f, {}, ["attrs", "cvals", "runtimehistory"])
		ow.test.assert(m.get("Metric/A").date, firstDate, "a partial file retains original value timestamp")
		ow.test.assert(m.get("Metric/A").value, 1, "partial files retain the last valid value")
		ow.test.assert(m.runtimeSnapshot().ts, 100, "a partial runtime file never receives a false fresh timestamp")
		__inspectionWrite(f, { attrs: __inspectionAttrs(["Metric/A", "Metric/B"]), cvals: [{ name: "Metric/A", val: 2, date: nextDate }, { name: "Metric/B", val: 3, date: nextDate }], runtimehistory: [{ t: 200, plugs: { totalErrors: 2 } }] })
		ow.test.assert(m.snapshot().map(r => r.value), [2, 3], "reader recovers and discovers new attributes on its next refresh")
		ow.test.assert(m.get("Metric/A").date, nextDate, "recovery accepts the writer's next timestamp")
		ow.test.assert(m.runtimeSnapshot().ts, 200, "runtime history refreshes after writer recovery")
		// A valid compression envelope with the wrong record shape is also incomplete data.
		__inspectionWrite(f, { attrs: [{}], cvals: {}, runtimehistory: [{ t: "invalid" }] })
		ow.test.assert(m.match(), ["Metric/A", "Metric/B"], "invalid attribute records retain the previous complete snapshot")
		ow.test.assert(m.get("Metric/A").value, 2, "invalid value data retains the previous complete snapshot")
		ow.test.assert(m.runtimeSnapshot().ts, 200, "invalid history keys retain the previous snapshot")
	} finally { harness.stopEngine(nm) }
})

ow.test.test("inspection::external current-value channels remain live", () => {
	var f = __inspectionFixture({ __NAM_CHANNEL_CVALS: stringify({ type: "simple", options: {} }) })
	__inspectionWrite(f, { attrs: __inspectionAttrs(["Metric/External"]), cvals: [{ name: "Metric/External", val: -1, date: "2026-01-01" }] })
	var nm = new nAttrMon(f.config, false, { inspection: true })
	global.nattrmon = nm
	try {
		var m = new nMetrics(nm)
		nm.currentValues.set({ name: "Metric/External" }, { name: "Metric/External", val: 17, date: "2026-01-02" })
		ow.test.assert(m.get("Metric/External").value, 17, "configured channel wins over local value snapshot")
		nm.currentValues.set({ name: "Metric/External" }, { name: "Metric/External", val: 18, date: "2026-01-03" })
		ow.test.assert(m.get("Metric/External").value, 18, "each read sees live channel updates")
		ow.test.assert(isUnDef(nm.__inspectionSnapshots.cvals), true, "external channels never restore local value files")
	} finally { harness.stopEngine(nm) }
})

ow.test.test("inspection::one refresh per sample or frame, one initial sample, and stable active selection", () => {
	var f = __inspectionFixture()
	__inspectionWrite(f, { attrs: __inspectionAttrs(["Metric/A", "Metric/B"]), cvals: [{ name: "Metric/A", val: 1 }, { name: "Metric/B", val: 2 }], runtimehistory: [{ t: 10, plugs: { totalErrors: 0 } }] })
	var nm = new nAttrMon(f.config, false, { inspection: true })
	global.nattrmon = nm
	var count = 0, original = nm.refreshInspectionSnapshots
	nm.refreshInspectionSnapshots = function() { count++; return original.call(nm) }
	try {
		var m = new nMetrics(nm)
		count = 0; m.snapshot()
		ow.test.assert(count, 1, "multi-metric snapshot refreshes files once")
		var dash = nDashboards.build("runtime", m, {})
		count = 0
		nMetricsView.renderDashboardFrame(dash.panels, { caps: { width: 80, height: 24, ansi: false } })
		ow.test.assert(count, 1, "all runtime panels share one refresh per rendered frame")
		__inspectionFakeScheduler(pools => {
			var watch = m.watchSession("Metric/*", { samples: 3, periodMs: 5000 })
			try {
				ow.test.assert(pools[0].period, 5000, "configured interval reaches the scheduler unchanged")
				ow.test.assert(watch.buffers["Metric/A"].length, 1, "synchronous prime plus scheduler immediate callback produce exactly one sample")
				ow.test.assert(watch.buffers["Metric/B"].length, 1, "initial sample covers every selected metric once")
				__inspectionWrite(f, { attrs: __inspectionAttrs(["Metric/A", "Metric/B", "Metric/C"]), cvals: [{ name: "Metric/A", val: 10 }, { name: "Metric/B", val: 20 }, { name: "Metric/C", val: 30 }] })
				count = 0; pools[0].advance()
				ow.test.assert(count, 1, "each sampling callback refreshes once across all getters")
				ow.test.assert(watch.buffers["Metric/A"].map(r => r.value), [1, 10], "periodic sample sees the new writer value")
				ow.test.assert(watch.names, ["Metric/A", "Metric/B"], "active watches retain their selected metric set")
				ow.test.assert(m.match("Metric/*"), ["Metric/A", "Metric/B", "Metric/C"], "a new selection discovers newly added attributes")
				count = 0; watch.tick(); watch.tick()
				ow.test.assert(count, 0, "rendering buffers does not resample or refresh")
				watch.stop()
				var before = watch.buffers["Metric/A"].length
				pools[0].advance()
				ow.test.assert(pools[0].stopped, true, "session stop shuts down its own scheduler")
				ow.test.assert(watch.buffers["Metric/A"].length, before, "stopped sessions receive no more samples")
				ow.test.assert(Object.keys(ow.metrics.__m).some(k => k.indexOf("nattrmon::watch::") == 0), false, "sampler getters are deregistered")
			} finally { watch.stop() }
		})
	} finally { harness.stopEngine(nm) }
})

ow.test.test("inspection::availability distinguishes missing snapshots from valid empty selections without extra reads", () => {
	var reads = 0, data = {}, nm = {
		inspection: true, __inspectionExternalValues: false, __inspectionSnapshotPath: "/snapshot-directory",
		refreshInspectionSnapshots: () => { reads++; return data }
	};
	var m = new nMetrics(nm)
	m.match()
	ow.test.assert(m.inspectionStatus().missing, ["attrs", "cvals"], "missing data reports both unavailable local snapshots")
	ow.test.assert(reads, 1, "status does not cause an extra refresh")
	data.attrs = []
	m.match()
	ow.test.assert(m.inspectionStatus().missing, ["cvals"], "a valid empty attribute snapshot is available")
	data.cvals = []
	m.snapshot()
	ow.test.assert(m.inspectionStatus().available, true, "valid empty snapshots differ from unavailable data")
	ow.test.assert(m.snapshot("does-not-match"), [], "existing array output remains unchanged")
	delete data.cvals
	nm.__inspectionExternalValues = true
	m.match()
	ow.test.assert(m.inspectionStatus().available, true, "external values do not require a local cvals file")
	nm.inspection = false
	ow.test.assert(m.inspectionStatus(), { available: true, source: "live", missing: [] }, "in-process consumers retain live availability")
})

ow.test.test("inspection CLI::unavailable notices use stderr and preserve JSON arrays", () => {
	var f = __inspectionFixture()
	var run = operation => $sh(["openaf", "-f", NATTRMON_HOME + "/nattrmon.js", "-e", "metrics=" + operation + ";format=json;select=Metric/*;withDirectory=" + f.config])
		.envs({ NATTRMON_HOME: NATTRMON_HOME, NATTRMON_DIR: f.dir }, true).timeout(20000).get(0)
	;["list", "snapshot"].forEach(operation => {
		var result = run(operation)
		ow.test.assert(result.exitcode, 0, "one-shot inspection still exits successfully")
		ow.test.assert(/\[\s*\]\s*$/.test(String(result.stdout)), true, "unavailable " + operation + " retains its JSON array result")
		ow.test.assert(String(result.stdout).indexOf("Metric data unavailable"), -1, "availability notice does not contaminate structured output")
		ow.test.assert(String(result.stderr).indexOf("Metric data unavailable") >= 0, true, "unavailable " + operation + " is explicit on stderr")
	})
	var watch = run("watch")
	ow.test.assert(watch.exitcode, 1, "watch cannot select names without attribute data")
	ow.test.assert(String(watch.stderr).indexOf("Metric data unavailable") >= 0, true, "watch startup explains unavailable data")
	ow.test.assert(String(watch.stderr).indexOf("No metrics matched"), -1, "unavailable data is not mislabeled as an empty match")
	io.writeFileBytes(f.config + "/nattrmon.attrs.snapshot", compress([]))
	io.writeFileBytes(f.config + "/nattrmon.cvals.snapshot", compress([]))
	var empty = run("watch")
	ow.test.assert(String(empty.stderr).indexOf("Metric data unavailable"), -1, "valid empty snapshots are not reported unavailable")
	ow.test.assert(String(empty.stderr).indexOf("No metrics matched") >= 0, true, "valid data with no matches retains the existing message")
})


ow.test.test("inspection::multi-metric snapshots index each row once instead of rescanning per metric", () => {
	var namesRead = 0, refreshes = 0, attrs = [], cvals = [], size = 200
	for (var i = 0; i < size; i++) {
		let name = "Metric/" + i
		var attr = { type: nAttribute.TYPE_NUMBER }, value = { val: i, date: "2026-01-01" }
		Object.defineProperty(attr, "name", { enumerable: true, get: function() { namesRead++; return name } })
		Object.defineProperty(value, "name", { enumerable: true, get: function() { namesRead++; return name } })
		attrs.push(attr); cvals.push(value)
	}
	var nm = { inspection: true, __inspectionExternalValues: false, refreshInspectionSnapshots: () => { refreshes++; return { attrs: attrs, cvals: cvals } } }
	var m = new nMetrics(nm), result = m.snapshot()
	ow.test.assert(result.length, size, "every attribute retains its resolved value")
	ow.test.assert(result.filter(r => r.name == "Metric/199")[0].value, 199, "index resolves the matching value")
	ow.test.assert(refreshes, 1, "one refresh serves the complete snapshot")
	ow.test.assert(namesRead, size * 3, "attribute indexing, value indexing and selection each visit names once")
	m.inspectionStatus()
	ow.test.assert(namesRead, size * 3, "availability does not rebuild indexes")
})

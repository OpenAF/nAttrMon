// Phase 9.3 -- persisted runtime metrics history (nAttrMon.prototype.publishRuntimeMetrics's
// periodic-only append/prune, lib/nmain.js) and how nMetrics.runtimeSnapshot() (lib/nmetrics.js)
// reports it. This is what lets "nattrmon dashboard runtime" work when run as a *separate*
// process against an already-running daemon (see nMetrics.runtimeSnapshot()'s odoc for why it
// must not call getRuntimeMetricsSnapshot() directly on a constructed-but-never-.start()-ed
// instance).

loadLib(NATTRMON_HOME + "/lib/nmetrics.js")

ow.test.test("publishRuntimeMetrics::only the periodic source appends to history (bounded + ordered)", () => {
	var nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_PERSIST: true,
		__NAM_RUNTIME_METRICS_HISTORY_SIZE: 3,
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "runtime-hist-append" })

	try {
		nm.publishRuntimeMetrics("start")
		nm.publishRuntimeMetrics("watchdog", { eventType: "warning" })
		ow.test.assert(nm.getRuntimeMetricsHistory().length, 0, "non-periodic publishes must not append to history (avoids write amplification during incident bursts)")

		for (var i = 0; i < 5; i++) {
			nm.publishRuntimeMetrics("periodic")
			sleep(5, true) // ensure distinct millisecond timestamps -- history is keyed by t
		}

		var hist = nm.getRuntimeMetricsHistory()
		ow.test.assert(hist.length, 3, "history should be capped to __NAM_RUNTIME_METRICS_HISTORY_SIZE (5 published, cap 3)")
		for (var j = 1; j < hist.length; j++) {
			ow.test.assert(hist[j].t >= hist[j - 1].t, true, "history must stay ordered oldest-first")
		}
		ow.test.assert(isMap(hist[hist.length - 1].plugs) && isNumber(hist[hist.length - 1].plugs.totalErrors), true, "each point should carry the compact plugs summary")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("publishRuntimeMetrics::history append is skipped entirely when persistence is disabled", () => {
	var nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_PERSIST: false,
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "runtime-hist-disabled" })

	try {
		nm.publishRuntimeMetrics("periodic")
		ow.test.assert(nm.getRuntimeMetricsHistory().length, 0, "no history should be recorded when __NAM_RUNTIME_METRICS_PERSIST is false")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("publishRuntimeMetrics::persisted snapshot file round-trips through OpenAF's own compress/uncompress", () => {
	var nm = harness.newEngine({
		__NAM_NEED_CH_PERSISTENCE: true,
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_PERSIST: true,
		__NAM_RUNTIME_METRICS_HISTORY_SIZE: 5,
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "runtime-hist-file" })

	try {
		nm.publishRuntimeMetrics("periodic")
		sleep(300, true) // ow.ch.persistence's subscriber writes asynchronously -- give it time to land
		var snapPath = nm.getSnapshotPath() + "/nattrmon.runtimehistory.snapshot"
		ow.test.assert(io.fileExists(snapPath), true, "the runtime history snapshot file should be written shortly after persistence + a periodic publish happen")

		var onDisk = uncompress(io.readFileBytes(snapPath))
		ow.test.assert(isArray(onDisk) && onDisk.length, 1, "the on-disk snapshot should contain exactly the one periodic point published")
		ow.test.assert(isNumber(onDisk[0].t), true, "each stored record should carry the point's timestamp key")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics.runtimeSnapshot::reports availability/source correctly across daemon states", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "runtime-snap-disabled" })
	try {
		var m = new nMetrics(nm)
		ow.test.assert(m.runtimeSnapshot().available, false, "runtime metrics disabled entirely should report available=false")
	} finally {
		harness.stopEngine(nm)
	}

	nm = harness.newEngine({
		__NAM_RUNTIME_METRICS: true,
		__NAM_RUNTIME_METRICS_PERSIST: true,
		__NAM_RUNTIME_OWMETRICS: false
	}, { name: "runtime-snap-unavailable" })
	try {
		var m2 = new nMetrics(nm)
		var rs = m2.runtimeSnapshot()
		ow.test.assert(rs.available, true, "runtime metrics enabled but nothing published yet should still report available=true")
		ow.test.assert(rs.source, "unavailable", "no persisted history yet should be reported as source=unavailable, not an empty/misleading snapshot")

		nm.publishRuntimeMetrics("periodic")
		var rs2 = m2.runtimeSnapshot()
		ow.test.assert(rs2.source, "restored", "once a periodic point exists, source should be 'restored' -- this instance never called .start()")
		ow.test.assert(isMap(rs2.snapshot) && isNumber(rs2.snapshot.t), true, "restored snapshot should be the newest history point")

		// White-box: simulate this exact instance actually being the live, .start()-ed daemon
		// (the one in-process case where reading this.plugs/this.threadsSessions directly is valid).
		nm.alive = true
		var rs3 = m2.runtimeSnapshot()
		ow.test.assert(rs3.source, "live", "once alive, runtimeSnapshot should read getRuntimeMetricsSnapshot()/getDegradedPlugs() directly")
		ow.test.assert(isMap(rs3.degraded) && isNumber(rs3.degraded.total), true, "live source should expose full degraded-plug detail (not just a count)")
	} finally {
		harness.stopEngine(nm)
	}
})

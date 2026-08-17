// Phase 9.2 -- terminal metrics live sampling (nMetrics.watchSession, lib/nmetrics.js) and its
// rendering (nMetricsView.renderWatchFrame, lib/nmetricsview.js): bounded buffers, ordering,
// min/max/avg, non-numeric fallback, and that stop() actually halts sampling (no leaked thread).

loadLib(NATTRMON_HOME + "/lib/nmetrics.js")
loadLib(NATTRMON_HOME + "/lib/nmetricsview.js")

ow.test.test("nMetricsView.__refreshMsToFps::passes an unrounded, unclamped fps through to ow.format.viz.live", () => {
	// Regression: an earlier implementation computed fps as Math.max(1, Math.round(1000/refreshMs)),
	// which rounds any refreshMs > 666ms down to fps=0 and then clamps it back up to fps=1 (i.e. a
	// fixed 1000ms interval) -- so --refresh=5s would actually redraw every second, 5x too often.
	// ow.format.viz.live itself computes interval = round(1000/fps) and accepts fractional fps fine
	// (0.2 for a 5s interval), so this must stay unrounded/unclamped. Tested directly (not by
	// driving nMetricsView.runLive's actual blocking TTY loop, which registers a real
	// addOnOpenAFShutdown hook -- not something safe to fire early from inside a hermetic test run).
	ow.test.assert(nMetricsView.__refreshMsToFps(5000), 0.2, "a 5s refresh should be fps=0.2 (viz.live's own Math.round(1000/fps) then gives a 5000ms interval)")
	ow.test.assert(nMetricsView.__refreshMsToFps(1000), 1, "a 1s refresh should be fps=1")
	ow.test.assert(nMetricsView.__refreshMsToFps(200), 5, "a 200ms refresh should be fps=5")
})

ow.test.test("nMetrics.watchSession::each session owns its own scheduler -- stopping one must not break a second session on the same nMetrics/nAttrMon instance", () => {
	// Regression: an earlier implementation scheduled sampling on the wrapped nAttrMon
	// instance's own (shared) this.thread pool and stop() called this.thread.stop(true) --
	// which stops that ENTIRE pool. A second watchSession() on the same instance (e.g. a
	// dashboard built from several ad-hoc selectors, or any sequential watch/dashboard reuse
	// of one nMetrics) would then hit java.util.concurrent.RejectedExecutionException the
	// moment it tried to schedule its own sampling.
	var nm = harness.newEngine({}, { name: "sampling-independent-sessions" })
	try {
		nm.setAttribute("Java/Memory/Used", "Heap used", nAttribute.TYPE_NUMBER)
		nm.currentValues.set({ name: "Java/Memory/Used" }, { name: "Java/Memory/Used", val: 1, date: new Date() })

		var m = new nMetrics(nm)
		var s1 = m.watchSession([ "Java/Memory/Used" ], { samples: 5, periodMs: 60000 })
		s1.stop()

		// Must not throw RejectedExecutionException (see comment above)
		var s2 = m.watchSession([ "Java/Memory/Used" ], { samples: 5, periodMs: 60000 })
		ow.test.assert(s2.buffers["Java/Memory/Used"].length, 1, "the second session should still prime its own initial sample")
		s2.stop()
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics.watchSession::buffers stay ordered oldest-first and bounded to `samples`", () => {
	var nm = harness.newEngine({}, { name: "sampling-bounded" })
	try {
		nm.setAttribute("Java/Memory/Used", "Heap used", nAttribute.TYPE_NUMBER)
		nm.currentValues.set({ name: "Java/Memory/Used" }, { name: "Java/Memory/Used", val: 100, date: new Date() })

		var m = new nMetrics(nm)
		var session = m.watchSession([ "Java/Memory/Used" ], { samples: 3, periodMs: 50 })
		try {
			ow.test.assert(session.buffers["Java/Memory/Used"].length, 1, "should prime exactly one sample immediately on start")

			sleep(260, true) // several 50ms ticks should have fired by now
			var buf = session.tick()["Java/Memory/Used"]
			ow.test.assert(buf.length <= 3, true, "buffer must never exceed the configured `samples` cap")
			ow.test.assert(buf.length >= 2, true, "several periodic ticks should have accumulated in 260ms at a 50ms period")

			for (var i = 1; i < buf.length; i++) {
				ow.test.assert(buf[i].t >= buf[i - 1].t, true, "samples must stay ordered oldest-first")
			}
		} finally {
			session.stop()
		}
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics.watchSession::stop() halts further sampling (no leaked scheduled thread)", () => {
	var nm = harness.newEngine({}, { name: "sampling-stop" })
	try {
		nm.setAttribute("Java/Memory/Used", "Heap used", nAttribute.TYPE_NUMBER)
		nm.currentValues.set({ name: "Java/Memory/Used" }, { name: "Java/Memory/Used", val: 1, date: new Date() })

		var m = new nMetrics(nm)
		var session = m.watchSession([ "Java/Memory/Used" ], { samples: 50, periodMs: 40 })

		sleep(160, true)
		var lenAtStop = session.tick()["Java/Memory/Used"].length
		session.stop()

		sleep(200, true) // long enough for several more ticks to have fired, if the scheduler weren't actually stopped
		var lenAfterStop = session.tick()["Java/Memory/Used"].length

		ow.test.assert(lenAfterStop, lenAtStop, "buffer must not grow after stop() -- the scheduled thread should be halted")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetrics.watchSession::non-numeric metric samples don't error and stay in buffers as-is", () => {
	var nm = harness.newEngine({}, { name: "sampling-nonnumeric" })
	try {
		nm.setAttribute("Database/Status", "DB status text", nAttribute.TYPE_STRING)
		nm.currentValues.set({ name: "Database/Status" }, { name: "Database/Status", val: "ok", date: new Date() })

		var m = new nMetrics(nm)
		var session = m.watchSession([ "Database/Status" ], { samples: 5, periodMs: 500 })
		try {
			var buf = session.buffers["Database/Status"]
			ow.test.assert(buf.length, 1, "the initial priming sample should still be collected for a non-numeric metric")
			ow.test.assert(buf[0].value, "ok", "the raw string value should be preserved, not coerced")

			var frame = nMetricsView.renderWatchFrame(session, { caps: { width: 80, height: 24, ansi: false } })
			ow.test.assert(frame.indexOf("Database/Status") >= 0, true, "frame should still mention the metric name")
			ow.test.assert(frame.indexOf("ok") >= 0, true, "frame should fall back to a value table for a non-numeric metric")
		} finally {
			session.stop()
		}
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nMetricsView.renderWatchFrame::computes current/min/max/avg correctly", () => {
	var nm = harness.newEngine({}, { name: "sampling-stats" })
	try {
		nm.setAttribute("Java/Memory/Used", "Heap used", nAttribute.TYPE_NUMBER)
		nm.currentValues.set({ name: "Java/Memory/Used" }, { name: "Java/Memory/Used", val: 10, date: new Date() })

		var m = new nMetrics(nm)
		var session = m.watchSession([ "Java/Memory/Used" ], { samples: 60, periodMs: 60000 })
		try {
			// Inject a deterministic sample series directly, avoiding any timing dependency.
			session.buffers["Java/Memory/Used"] = [
				{ t: 1, value: 10 }, { t: 2, value: 30 }, { t: 3, value: 20 }
			]

			var frame = nMetricsView.renderWatchFrame(session, { caps: { width: 80, height: 24, ansi: false, unicode: true } })
			ow.test.assert(frame.indexOf("Current: 20") >= 0, true, "current should be the last sample")
			ow.test.assert(frame.indexOf("Min: 10") >= 0, true, "min should be computed across all samples")
			ow.test.assert(frame.indexOf("Max: 30") >= 0, true, "max should be computed across all samples")
			ow.test.assert(frame.indexOf("Avg: 20.00") >= 0, true, "avg should be computed across all samples")
		} finally {
			session.stop()
		}
	} finally {
		harness.stopEngine(nm)
	}
})

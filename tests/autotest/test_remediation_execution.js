// Behavioral regressions for execution failures and ordered channel batches.
ow.test.test("execution::wrappers propagate the original exception and never commit failed validation results", () => {
	var commits = 0, error = new Error("original failure")
	harness.stubNattrmon({ setWarnings: () => { commits++ } })
	;[new nInput(() => { throw error }), new nOutput(() => { throw error }), new nValidation(() => { throw error })].forEach(w => {
		var caught
		try { w.exec({}, {}, {}) } catch(e) { caught = e }
		ow.test.assert(caught === error, true, "exception identity and stack survive the wrapper")
		ow.test.assert(w.count, 0, "failure is not counted as success")
	})
	ow.test.assert(commits, 0, "failed validation must not commit")
})

ow.test.test("execution::expanded batches filter records, commit in order, and stop at first error", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "batch-failure" })
	var loggedBefore = __clogErr.get(), calls = []
	try {
		var plug = new nPlug({ name: "batch", type: "input", chHandleSetAll: true, attrPattern: "^yes", onlyOnEvent: true }, {}, new nInput((scope, args) => {
			calls.push([args.k.name, args.k.id, args.op, args.v.val])
			if (args.v.val == 3) throw new Error("middle failure")
			return { result: args.v.val }
		}))
		var rows = [{ name: "no", id: 0, val: 9 }, { name: "yes", id: 1, val: 1 }, { name: "yes", id: 2, val: 2 }, { name: "yes", id: 3, val: 3 }, { name: "yes", id: 4, val: 4 }]
		__nam_execPlug(nm, plug, __nam_buildExecContext("batch", "subscribe", { ch: "source", op: "setall", k: ["name", "id"], v: rows }), 1)
		ow.test.assert(calls, [["yes", 1, "set", 1], ["yes", 2, "set", 2], ["yes", 3, "set", 3]], "source keys and order retained; later records skipped")
		ow.test.assert(nm.currentValues.get({ name: "result" }).val, 2, "earlier commit survives")
		ow.test.assert(nm.lastValues.get({ name: "result" }).val, 1, "repeated names rotate values per record")
		ow.test.assert(plug.numberOfExecs.get(), 2, "successful attempts stay separate")
		ow.test.assert(plug.numberOfExecsInError.get(), 1, "failed attempt recorded")
		ow.test.assert(__clogErr.get() - loggedBefore, 1, "shared boundary logs exactly once")
		ow.test.assert($ch(nm.chPS).size(), 0, "process status always cleaned")
	} finally { harness.stopEngine(nm) }
})

ow.test.test("execution::unexpanded batches execute once with original payload if any record matches", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "batch-original" })
	try {
		var got = [], rows = [{ name: "no" }, { name: "yes" }], keys = ["name"]
		var plug = new nPlug({ name: "original", type: "output", attrPattern: ["^yes$"] }, {}, new nOutput((scope, args) => { got.push(args) }))
		__nam_execPlug(nm, plug, __nam_buildExecContext("original", "subscribe", { ch: "source", op: "setall", k: keys, v: rows }), 1)
		ow.test.assert(got.length, 1, "one invocation")
		ow.test.assert(got[0].v, rows, "complete original bulk payload is retained")
		ow.test.assert(got[0].k, keys, "bulk key fields are retained")
		__nam_execPlug(nm, plug, __nam_buildExecContext("original", "subscribe", { ch: "source", op: "setall", k: keys, v: [{ name: "no" }] }), 1)
		ow.test.assert(got.length, 1, "no match means no execution")
	} finally { harness.stopEngine(nm) }
})

ow.test.test("execution::expanded batches share individual-event postprocessing", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "batch-processing" })
	try {
		var opts = { name: "processed", type: "input", chHandleSetAll: true, onlyOnEvent: true, stamp: { source: "batch" }, toArray: { attrName: "combined", key: "key" }, merge: { combined: { key: "a" } }, sort: { combined: ["id"] } }
		var plug = new nPlug(opts, {}, new nInput((scope, args) => ({ a: { id: args.v.val } })))
		var rows = [{ name: "a", val: 2 }, { name: "a", val: 1 }, { name: "a", val: 1 }]
		__nam_execPlug(nm, plug, __nam_buildExecContext("processed", "subscribe", { ch: "source", op: "setall", k: ["name"], v: rows }), 1)
		ow.test.assert(nm.currentValues.get({ name: "combined" }).val, [{ id: 1, source: "batch", key: "a" }], "stamp, array, merge and sort pass through addValues")
		var bulkCurrent = clone(nm.currentValues.get({ name: "combined" }).val)
		var bulkLast = clone(nm.lastValues.get({ name: "combined" }).val)
		nm.currentValues.unset({ name: "combined" }); nm.lastValues.unset({ name: "combined" })
		rows.forEach(row => __nam_execPlug(nm, plug, __nam_buildExecContext("processed", "subscribe", { ch: "source", op: "set", k: { name: row.name }, v: row }), 1))
		ow.test.assert(nm.currentValues.get({ name: "combined" }).val, bulkCurrent, "batch current equals individual-event processing")
		ow.test.assert(nm.lastValues.get({ name: "combined" }).val, bulkLast, "batch history equals individual-event processing")
	} finally { harness.stopEngine(nm) }
})

ow.test.test("diagnostics::failure-only plugs use total attempts without changing successful latency", () => {
	var nm = harness.newEngine({}, { name: "failure-diagnostics" })
	try {
		var p = new nPlug({ name: "fails", type: "input" }, {}, new nInput(() => { throw "failed" }))
		for (var i = 0; i < 5; i++) { try { p.exec(nm) } catch(e) {} }
		nm.plugs = { inputs: [p] }
		var snapshot = nm.getRuntimeMetricsSnapshot()
		ow.test.assert(snapshot.plugs.rows[0].errorRate, 1, "five failures out of five attempts")
		ow.test.assert(nm.getDegradedPlugs({ minExecs: 5 }, snapshot).total, 1, "minimum attempt threshold counts failures")
		ow.test.assert(snapshot.plugs.totalExecutions, 0, "success counter retains its contract")
		ow.test.assert(snapshot.plugs.totalErrors, 5, "failures counted separately")
		ow.test.assert(snapshot.plugs.avgExecTimeInMs, 0, "failed attempts do not distort success latency")
	} finally { harness.stopEngine(nm) }
})


ow.test.test("execution::timeout wrapper preserves thrown objects and the original shared deadline", () => {
	var error = new Error("inside threadBox"), caught, calls = 0
	var plug = { killAfterMinutes: 1, getName: () => "boxed", getCategory: () => "test", type: "input" }
	try { __nam_execWithKillAfter(plug, new Date(), () => { throw error }) } catch(e) { caught = e }
	ow.test.assert(caught === error, true, "threadBox must not swallow the original error")
	var expired = false
	try { __nam_execWithKillAfter(plug, new Date(now() - 120000), () => { calls++ }) } catch(e) { expired = /timeout/.test(String(e)) }
	ow.test.assert(expired, true, "expired batch deadline stops the next record")
	ow.test.assert(calls, 0, "next record never starts after deadline")
})

ow.test.test("runner::test-file loading failures produce a nonzero exit", () => {
	var dir = harness.tmpDir("runner-load-error")
	io.mkdir(dir + "/lib")
	io.mkdir(dir + "/tests/autotest")
	io.writeFileString(dir + "/lib/nmain.js", "// fixture\n")
	io.writeFileString(dir + "/tests/autoTestAll.js", io.readFileString(NATTRMON_HOME + "/tests/autoTestAll.js"))
	io.writeFileString(dir + "/tests/autotest/harness.js", "var __nam_err = e => String(e)\n")
	io.writeFileString(dir + "/tests/autotest/test_broken.js", "throw new Error('intentional load failure')\n")
	var result = $sh(["openaf", "-f", dir + "/tests/autoTestAll.js"]).get(0)
	ow.test.assert(result.exitcode, 1, "a file that never registers an assertion must still fail the suite")
	ow.test.assert(String(result.stdout).indexOf("Load failures: 1") >= 0, true, "runner reports the loading failure separately")
})

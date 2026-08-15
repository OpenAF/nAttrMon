// Phase 7 -- multi-provider history dispatch: resolveHistoryProvider()/
// addHistoryProvider()/getHistoryValuesByTime()/getHistoryValuesByEvents() now
// support multiple simultaneously-registered history-capable output plugins
// (e.g. H2 + a new PostgreSQL/Prometheus provider), selectable via an optional
// "source" parameter, while legacy single-provider configs (H2/Oracle calling
// only setSessionData("attribute.history", this)) keep resolving exactly as
// before with zero source param needed.

var __fakeHistoryProvider = (label) => ({
	label: label,
	getValuesByTime: function(name, secs) { return [ { val: label, type: "num", date: "t" } ] },
	getValuesByEvents: function(name, count) { return [ { val: label, type: "num", date: "e" } ] }
})

ow.test.test("history dispatch: no providers, no source -> {}", () => {
	var nm = harness.newEngine({}, { name: "hist-none" })
	try {
		ow.test.assert(nm.getHistoryValuesByTime("attr", 60), {}, "no provider registered should return {}")
		ow.test.assert(nm.getHistoryValuesByEvents("attr", 5), {}, "no provider registered should return {}")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: legacy-only (setSessionData) + no source resolves it (today's behavior, unchanged)", () => {
	var nm = harness.newEngine({}, { name: "hist-legacy" })
	try {
		nm.setSessionData("attribute.history", __fakeHistoryProvider("legacy"))
		ow.test.assert(nm.getHistoryValuesByTime("attr", 60)[0].val, "legacy", "should resolve the legacy sessionData provider")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: new-style-only (addHistoryProvider) + no source resolves it directly", () => {
	var nm = harness.newEngine({}, { name: "hist-new" })
	try {
		nm.addHistoryProvider("postgresql", __fakeHistoryProvider("pg"))
		ow.test.assert(nm.getHistoryValuesByTime("attr", 60)[0].val, "pg", "should resolve the sole new-style provider with no source needed")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: legacy + new-style, no source -> legacy wins (adding a new provider must not steal the default)", () => {
	var nm = harness.newEngine({}, { name: "hist-both" })
	try {
		nm.setSessionData("attribute.history", __fakeHistoryProvider("legacy"))
		nm.addHistoryProvider("postgresql", __fakeHistoryProvider("pg"))
		ow.test.assert(nm.getHistoryValuesByTime("attr", 60)[0].val, "legacy", "legacy provider must remain the zero-config default")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: legacy + new-style, explicit source reaches the new-style provider", () => {
	var nm = harness.newEngine({}, { name: "hist-explicit" })
	try {
		nm.setSessionData("attribute.history", __fakeHistoryProvider("legacy"))
		nm.addHistoryProvider("postgresql", __fakeHistoryProvider("pg"))
		ow.test.assert(nm.getHistoryValuesByTime("attr", 60, "postgresql")[0].val, "pg", "explicit source should reach the new-style provider despite the legacy default")
		ow.test.assert(nm.getHistoryValuesByEvents("attr", 5, "postgresql")[0].val, "pg", "explicit source should apply to getHistoryValuesByEvents too")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: two new-style providers, no legacy, no source -> deterministic pick, no throw", () => {
	var nm = harness.newEngine({}, { name: "hist-two-new" })
	try {
		nm.addHistoryProvider("postgresql", __fakeHistoryProvider("pg"))
		nm.addHistoryProvider("prometheus", __fakeHistoryProvider("prom"))
		var r1 = nm.getHistoryValuesByTime("attr", 60)
		var r2 = nm.getHistoryValuesByTime("attr", 60)
		ow.test.assert(r1[0].val, r2[0].val, "resolution with no source should be deterministic across calls")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: unknown explicit source -> {}, no throw", () => {
	var nm = harness.newEngine({}, { name: "hist-unknown" })
	try {
		nm.addHistoryProvider("postgresql", __fakeHistoryProvider("pg"))
		ow.test.assert(nm.getHistoryValuesByTime("attr", 60, "doesnotexist"), {}, "unknown source should return {} without throwing")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("history dispatch: getHistoryProviderNames lists the registered set", () => {
	var nm = harness.newEngine({}, { name: "hist-names" })
	try {
		nm.addHistoryProvider("postgresql", __fakeHistoryProvider("pg"))
		nm.addHistoryProvider("prometheus", __fakeHistoryProvider("prom"))
		ow.test.assert(nm.getHistoryProviderNames().sort(), [ "postgresql", "prometheus" ], "should list every registered provider name")
	} finally {
		harness.stopEngine(nm)
	}
})

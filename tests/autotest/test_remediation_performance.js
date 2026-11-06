// Deterministic work counts supplement output-equivalence checks (no timing assertions).
ow.test.test("performance::lastSeen only enumerates at eviction or map replacement", () => {
	var out = new nOutput(() => {}), keys = Object.keys, enumerations = 0
	out.MAX_LASTSEEN_ENTRIES = 100
	try {
		Object.keys = function(o) { if (o === out.lastSeen) enumerations++; return keys(o) }
		for (var i = 0; i < 100; i++) out.see("k" + i, { date: new Date(i) })
		ow.test.assert(enumerations, 0, "new keys below cap do constant bookkeeping")
		out.see("k0", { date: new Date(1000) })
		ow.test.assert(enumerations, 0, "existing keys do not enumerate")
		out.see("k100", { date: new Date(100) })
		ow.test.assert(enumerations, 1, "one enumeration for quarter eviction")
		ow.test.assert(out.__lastSeenSize, 76, "occupancy tracks eviction")
		out.lastSeen = { replacement: 1 }
		out.see("next", { date: new Date(2) })
		ow.test.assert(enumerations, 2, "replacement map recounted once")
		ow.test.assert(out.__lastSeenSize, 2, "replacement occupancy correct")
		for (var j = 0; j < 5; j++) out.see("__proto__", { date: new Date(j) })
		ow.test.assert(out.__lastSeenSize, keys(out.lastSeen).length, "inherited setters do not create phantom occupancy")
	} finally { Object.keys = keys }
})

ow.test.test("performance::lastSeen preserves timestamps and eviction semantics", () => {
	var out = new nOutput(() => {}), reference = {}, cap = 16
	out.MAX_LASTSEEN_ENTRIES = cap
	var oldSee = function(k, value) {
		var t = isDef(value.date) ? new Date(value.date).getTime() : __
		var fresh = !isDefined(reference[k]), changed = !fresh && reference[k] != t
		if (fresh) {
			var keys = Object.keys(reference)
			if (keys.length >= cap) {
				keys.sort((a, b) => (reference[a] || 0) - (reference[b] || 0))
				for (var j = 0; j < Math.ceil(keys.length * 0.25); j++) delete reference[keys[j]]
			}
		}
		reference[k] = t
		return changed
	}
	for (var i = 0; i < 400; i++) {
		var k = "key" + (i % 29), v = i % 7 == 0 ? {} : { date: new Date(i % 23) }
		ow.test.assert(out.see(k, v), oldSee(k, v), "same change signal")
		ow.test.assert(Object.keys(out.lastSeen), Object.keys(reference), "same cache keys and eviction order")
		Object.keys(reference).forEach(key => ow.test.assert(out.lastSeen[key] === reference[key], true, "same timestamp for " + key))
		ow.test.assert(out.__lastSeenSize, Object.keys(out.lastSeen).length, "undefined timestamps still occupy one entry")
	}
})

ow.test.test("performance::runtime snapshot indexes process UUIDs once", () => {
	var nm = harness.newEngine({ __NAM_RUNTIME_METRICS: false }, { name: "snapshot-index" })
	var reads = 0, records = [], originalGetAll = ow.ch.__types.simple.getAll
	try {
		var entry = { getName: () => "test", type: "input", getCron: () => __, aTime: 1000, waitForFinish: true }
		for (var i = 0; i < 100; i++) nm.threadsSessions["session" + i] = { entry: entry, count: now() }
		for (var j = 0; j < 300; j++) {
			(function(uuid) {
				var record = {}
				Object.defineProperty(record, "uuid", { get: function() { reads++; return uuid } })
				records.push(record)
			})("session" + (j % 100))
		}
		ow.ch.__types.simple.getAll = function(name) { return name == nm.chPS ? records : originalGetAll.apply(this, arguments) }
		var snap = nm.getRuntimeMetricsSnapshot()
		ow.test.assert(snap.scheduler.threads.length, 100, "all sessions retained")
		ow.test.assert(snap.scheduler.threads.every(t => t.running == 3), true, "running counts match original query semantics")
		ow.test.assert(reads <= 600, true, "linear UUID reads instead of 30000 repeated comparisons")
	} finally { ow.ch.__types.simple.getAll = originalGetAll; harness.stopEngine(nm) }
})

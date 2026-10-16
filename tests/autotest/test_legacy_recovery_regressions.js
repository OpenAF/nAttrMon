ow.test.test("nmonitoredobject::initial factory failure is retried by a monitor pass", () => {
	var attempts = 0, pings = 0
	var mo = new nMonitoredObject("startup", function() {
		if (++attempts == 1) throw "temporarily offline"
		var obj = new AF()
		obj.exec = function() { pings++; return { a: 1 } }
		return obj
	})
	nAttrMon.prototype.monitoredObjectsTest.call({ monitoredObjects: { startup: mo } })
	ow.test.assert(attempts, 2, "initial failure remains eligible for recovery")
	ow.test.assert(mo.type, "AF", "recovery detects the newly created type")
	mo.setDirty()
	mo.test()
	ow.test.assert(pings, 1, "recovered AF objects use the AF health check")
	ow.test.assert(attempts, 2, "a healthy recovered connection is retained")
})

ow.test.test("nmonitoredobject::missing factory results are retried without calling custom testers", () => {
	var attempts = 0, tested = 0
	var tester = function() { tested++ }
	var mo = new nMonitoredObject("missing", function() {
		attempts++
		if (attempts < 3) return undefined
		return new AF()
	}, tester)
	mo.test()
	ow.test.assert(mo.dirty, true, "a missing replacement must not be marked recovered")
	ow.test.assert(tested, 0, "a tester cannot mark a missing object healthy")
	mo.test()
	ow.test.assert(attempts, 3, "the factory is retried until it returns an object")
	ow.test.assert(mo.testFunction === tester, true, "recovery preserves custom testers")
	mo.setDirty()
	mo.test()
	ow.test.assert(tested, 1, "custom tester runs for the recovered object")
})

ow.test.test("nmonitoredobject::failed replacement never exposes a closed connection", () => {
	var attempts = 0, closed = 0
	var mo = new nMonitoredObject("closed", function() {
		if (++attempts == 2) throw "replacement failed"
		var obj = new AF()
		obj.close = function() { closed++ }
		return obj
	}, function(obj) { throw "unhealthy" })
	mo.setDirty()
	mo.test()
	ow.test.assert(closed, 1, "the failed connection was closed")
	ow.test.assert(isUnDef(mo.getObject()), true, "callers cannot obtain the closed connection")
	mo.test()
	ow.test.assert(closed, 1, "retry must not close the same object again")
	ow.test.assert(attempts, 3, "retry creates another connection")
	ow.test.assert(mo.dirty, false, "successful retry clears dirty state")
})

ow.test.test("nmain::shutdown continues after pool and connection cleanup failures", () => {
	var nm = harness.newEngine({}, { name: "cleanup-errors" })
	var pools = 0, connections = 0, plugs = 0
	try {
		nm.objPools = {
			broken: { stop: function() { throw "pool close failed" } },
			healthy: { stop: function() { pools++ } }
		}
		var broken = new nMonitoredObject("broken", function() { return new AF() })
		broken.getObject().close = function() { throw "connection close failed" }
		var healthy = new nMonitoredObject("healthy", function() { return new AF() })
		healthy.getObject().close = function() { connections++ }
		nm.monitoredObjects = { broken: broken, healthy: healthy }
		nm.plugs = { inputs: [{ close: function() { plugs++ } }] }
		nm.stop()
		ow.test.assert(pools, 1, "remaining pools are stopped")
		ow.test.assert(connections, 1, "remaining connections are closed")
		ow.test.assert(plugs, 1, "plug cleanup still runs")
		ow.test.assert($ch().list().indexOf(nm.chCurrentValues), -1, "shutdown reaches channel cleanup")
		ow.test.assert(Object.keys(nm.objPools).length, 0, "pool registry is cleared")
		ow.test.assert(Object.keys(nm.monitoredObjects).length, 0, "connection registry is cleared")
	} finally {
		nm.objPools = {}
		nm.monitoredObjects = {}
		harness.stopEngine(nm)
		harness.resetGlobals()
	}
})

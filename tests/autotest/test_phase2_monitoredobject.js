// Phase 2 -- #1: nMonitoredObject.determineType() must inspect the wrapped
// object (this.obj), not the never-set this.anObject, so typed health tests
// and tryToClose() actually run.

ow.test.test("nmonitoredobject::determineType detects the wrapped object's type", () => {
	var mo = new nMonitoredObject("k1", function() { return new AF() })
	ow.test.assert(mo.type, "AF", "determineType should detect AF instances via this.obj")
})

ow.test.test("nmonitoredobject::tryToClose dispatches to the type-specific close call", () => {
	var mo = new nMonitoredObject("k2", function() { return new AF() })
	var spyObj = { closed: false, close: function() { this.closed = true } }
	mo.type = "AF"
	mo.tryToClose(spyObj)
	ow.test.assert(spyObj.closed, true, "tryToClose should call obj.close() for an AF-typed object")
})

ow.test.test("nmonitoredobject::dirty typed object is recreated with type-specific close on tester failure", () => {
	var createCount = 0
	var closedFirst = false
	var factory = function() {
		createCount++
		var obj = new AF()
		if (createCount == 1) obj.close = function() { closedFirst = true }
		return obj
	}
	var alwaysFail = function(obj) { throw "forced failure" }
	var mo = new nMonitoredObject("k3", factory, alwaysFail)

	ow.test.assert(mo.type, "AF", "type should be detected as AF at construction")

	mo.setDirty()
	mo.test()

	ow.test.assert(closedFirst, true, "the original object should have been closed via tryToClose before recreation")
	ow.test.assert(createCount, 2, "the factory should have been called again to recreate the object")
})

ow.test.test("nmonitoredobject::a healthy dirty object is not recreated", () => {
	var createCount = 0
	var mo = new nMonitoredObject("k4", function() { createCount++; return new AF() }, function(obj) { /* healthy: no throw */ })

	mo.setDirty()
	mo.test()

	ow.test.assert(createCount, 1, "no recreation should happen when the tester does not throw")
	ow.test.assert(mo.dirty, false, "dirty flag should clear after a successful test")
})

ow.test.test("nwarnings::plain warning maps can update an existing warning", () => {
	harness.resetGlobals()
	harness.resetChannels()
	harness.setGlobals({ __NAM_CLOSEDHK_HOWLONGAGOINMS: -1 })
	try {
		var warnings = new nWarnings()
		warnings.setWarning({ level: "High", title: "Service", description: "unavailable" })
		warnings.setWarning({ level: "Closed", title: "Service", description: "recovered" })
		var saved = warnings.getWarningByName("Service")
		ow.test.assert(saved.getLevel(), "Closed", "plain map updates must close existing alarms")
		ow.test.assert(saved.getDescription(), "recovered", "updated description is stored")
	} finally {
		harness.resetChannels()
		harness.resetGlobals()
	}
})

ow.test.test("nmain::stopObjects closes wrapped connections and remaining resources", () => {
	var closed = 0, plugClosed = false
	var mo = new nMonitoredObject("connection", function() { return new AF() })
	mo.getObject().close = function() { closed++ }
	var engine = { objPools: {}, monitoredObjects: { connection: mo }, plugs: {
		inputs: [{ close: function() { plugClosed = true } }]
	} }
	nAttrMon.prototype.stopObjects.call(engine)
	ow.test.assert(closed, 1, "close receives the connection instance")
	ow.test.assert(plugClosed, true, "shutdown reaches plug cleanup")
	ow.test.assert(Object.keys(engine.monitoredObjects).length, 0, "connection registry is cleared")
})

ow.test.test("nmonitoredobject::successful recreation clears dirty state", () => {
	var created = 0
	var mo = new nMonitoredObject("recreate", function() { created++; return {} })
	mo.setDirty()
	mo.test()
	mo.test()
	ow.test.assert(created, 2, "a repaired connection is not recreated on every monitor pass")
	ow.test.assert(mo.dirty, false, "successful recreation clears dirty state")
})

ow.test.test("nmonitoredobject::failed recreation stays eligible for retry", () => {
	var created = 0
	var mo = new nMonitoredObject("retry", function() {
		created++
		if (created == 2) throw "temporary failure"
		return {}
	})
	mo.setDirty()
	mo.test()
	ow.test.assert(mo.dirty, true, "failed recreation remains dirty")
	mo.test()
	ow.test.assert(created, 3, "the next pass retries the failed factory")
	ow.test.assert(mo.dirty, false, "successful retry clears dirty state")
})

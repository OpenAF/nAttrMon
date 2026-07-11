// Phase 2 -- #2: nPlug.getStamp()/getDescription() must read the fields the
// constructor actually populates (this.aStamp/this.aDescription), not the
// never-set this.stamp/this.description. This is what makes the "stamp:"
// plug option live (execPlugs passes aStamp: etry.getStamp()).

ow.test.test("nplug::getStamp returns the configured stamp map", () => {
	harness.stubNattrmon()
	var p = new nPlug({ name: "p1", stamp: { source: "test" } }, {}, { exec: function() {} })
	ow.test.assert(p.getStamp(), { source: "test" }, "getStamp should return the stamp configured at construction")
	$ch(p.chPlugs).destroy()
})

ow.test.test("nplug::getDescription returns the configured description", () => {
	harness.stubNattrmon()
	var p = new nPlug({ name: "p2", description: "a real description" }, {}, { exec: function() {} })
	ow.test.assert(p.getDescription(), "a real description", "getDescription should return the description configured at construction")
	$ch(p.chPlugs).destroy()
})

ow.test.test("nplug::close ignores plugs without an optional close method", () => {
	harness.stubNattrmon()
	var p = new nPlug({ name: "p3" }, {}, { exec: function() {} })
	ow.test.assert(p.close(), __, "close should be a no-op when the wrapped plug has no close method")
	$ch(p.chPlugs).destroy()
})

ow.test.test("nplug::close calls the wrapped optional close method", () => {
	harness.stubNattrmon()
	var closed = false
	var p = new nPlug({ name: "p4" }, {}, {
		exec: function() {},
		close: function() { closed = true }
	})
	p.close()
	ow.test.assert(closed, true, "close should call the wrapped plug close method")
	$ch(p.chPlugs).destroy()
})

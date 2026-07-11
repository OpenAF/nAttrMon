// Harness smoke test: confirms lib/*.js load standalone and ow.test wiring works
ow.test.test("harness::libs load standalone", () => {
	ow.test.assert(typeof nAttribute, "function", "nAttribute should be defined")
	ow.test.assert(typeof nAttributeValue, "function", "nAttributeValue should be defined")
	ow.test.assert(typeof nAttributes, "function", "nAttributes should be defined")
	ow.test.assert(typeof nMonitoredObject, "function", "nMonitoredObject should be defined")
	ow.test.assert(typeof nPlug, "function", "nPlug should be defined")
	ow.test.assert(typeof nInput, "function", "nInput should be defined")
	ow.test.assert(typeof nOutput, "function", "nOutput should be defined")
	ow.test.assert(typeof nWarning, "function", "nWarning should be defined")
	ow.test.assert(typeof nWarnings, "function", "nWarnings should be defined")
	ow.test.assert(typeof nValidation, "function", "nValidation should be defined")
	ow.test.assert(typeof nAttrMon, "function", "nAttrMon should be defined")
})

ow.test.test("harness::stubNattrmon supports nPlug help attributes", () => {
	var stub = harness.stubNattrmon()
	var p = new nPlug({ name: "t1", help: { "some/attr": "a description" } }, {}, { exec: function() {} })
	ow.test.assert(stub.attributes["some/attr"].description, "a description", "setAttribute should have been called via help")
	$ch(p.chPlugs).destroy()
})

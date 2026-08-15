// Object metadata is declarative and can be loaded without evaluating plug code.

ow.test.test("nmain::object metadata loads, validates, filters and protects its registry", () => {
	var nm = harness.newEngine({}, { name: "objects-meta" })
	var metaDir = nm.getConfigPath() + "/objects.meta"
	io.mkdir(metaDir)

	io.writeFileString(metaDir + "/input.yaml", af.toYAML({
		kind: "input",
		constructor: "nInput_TestMeta",
		title: "Test metadata input",
		description: "Used to validate the metadata registry.",
		examples: [ "config/inputs.disabled/yaml/test.yaml" ],
		arguments: [ {
			name: "endpoint",
			type: "string",
			required: true,
			description: "Endpoint to test.",
			example: "https://example.test"
		} ]
	}))
	io.writeFileString(metaDir + "/invalid.yaml", af.toYAML({
		kind: "unknown",
		constructor: "nInput_InvalidMeta",
		title: "Invalid metadata",
		description: "This must be rejected.",
		arguments: []
	}))

	try {
		var all = nm.loadObjectsMeta()
		ow.test.assert(all.filter(m => m.constructor == "nInput_TestMeta").length, 1, "valid metadata should be loaded")
		ow.test.assert(nm.getObjectsMeta("input", "nInput_TestMeta")[0].arguments[0].name, "endpoint", "kind and constructor filters should select the entry")
		ow.test.assert(nm.getObjectsMetaIssues().length > 0, true, "invalid metadata should be reported")

		var copy = nm.getObjectsMeta("input", "nInput_TestMeta")
		copy[0].title = "mutated copy"
		ow.test.assert(nm.getObjectsMeta("input", "nInput_TestMeta")[0].title, "Test metadata input", "callers must not mutate the registry")
	} finally {
		harness.stopEngine(nm)
	}
})

ow.test.test("nmain::object metadata rejects arguments without documented examples", () => {
	var nm = harness.newEngine({}, { name: "objects-meta-schema" })
	try {
		var issues = nm.validateObjectMeta({
			kind: "output",
			constructor: "nOutput_TestMeta",
			title: "Test metadata output",
			description: "Used to validate required argument fields.",
			arguments: [ { name: "target", type: "string", description: "Target address." } ]
		})
		ow.test.assert(issues.length > 0, true, "arguments without examples should be rejected")

		nm.configPath = NATTRMON_HOME + "/config"
		var seeded = nm.loadObjectsMeta()
		ow.test.assert(seeded.filter(m => m.constructor == "nInput_Filesystem").length, 1, "the packaged input metadata should parse")
		ow.test.assert(seeded.filter(m => m.constructor == "nOutput_EmailWarnings")[0].arguments.filter(a => a.name == "credentials")[0].secret, true, "credential metadata should be marked secret")
		ow.test.assert(nm.getObjectsMetaIssues().length, 0, "seed metadata should pass the schema")
	} finally {
		harness.stopEngine(nm)
	}
})

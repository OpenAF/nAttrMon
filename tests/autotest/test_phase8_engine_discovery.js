// Phase 8 -- component discovery
// Discovery must never load or evaluate plug code, and components without metadata must stay
// discoverable so custom objects remain first-class.

loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

// An engine over the repository itself
var __d_engine = function() {
	return new nConfigEngine({ home: NATTRMON_HOME, configPath: NATTRMON_HOME + "/config" })
}

ow.test.test("nConfigEngine::discovers the packaged components", () => {
	var e = __d_engine()
	var all = e.listComponents()

	ow.test.assert(all.length > 50, true, "the packaged components should be discovered")
	ow.test.assert(e.listComponents("input").length > 0, true, "inputs are discoverable")
	ow.test.assert(e.listComponents("output").length > 0, true, "outputs are discoverable")
	ow.test.assert(e.listComponents("validation").length > 0, true, "validations are discoverable")
	ow.test.assert(all.length, e.listComponents("input").length + e.listComponents("output").length + e.listComponents("validation").length, "every component has a kind")
})

ow.test.test("nConfigEngine::normalizes metadata into a machine-readable shape", () => {
	var c = __d_engine().getComponent("input", "nInput_Filesystem")

	ow.test.assert(isDef(c), true, "a hand-written component is found")
	ow.test.assert(c.type, "input", "the kind is normalized")
	ow.test.assert(c.metadata.present, true, "metadata presence is reported")
	ow.test.assert(c.metadata.coverage, "full", "hand-written metadata is reported as full coverage")

	var _vn = c.parameters.filter(p => p.name == "volumeNames")[0]
	ow.test.assert(isDef(_vn), true, "parameters are exposed")
	ow.test.assert(_vn.required, true, "required is preserved")
	ow.test.assert(_vn.type.raw, "array<string>", "the raw type string is preserved")
	ow.test.assert(_vn.type.base, "array", "generic types are decomposed")
	ow.test.assert(_vn.type.of, "string", "including their element type")

	var _to = c.parameters.filter(p => p.name == "execTimeout")[0]
	ow.test.assert(_to.default, 120000, "documented defaults are preserved")
	ow.test.assert(_to.unit, "milliseconds", "units are preserved")
})

ow.test.test("nConfigEngine::reports how much usable metadata a component has", () => {
	var e = __d_engine()
	// Most packaged metadata is generated boilerplate: 'type: any' with a stock description.
	ow.test.assert(e.getComponent("input", "nInput_DB").metadata.coverage, "generated", "generated metadata is flagged as such")
	ow.test.assert(e.getComponent("input", "nInput_Filesystem").metadata.coverage, "full", "hand-written metadata is flagged as full")
})

ow.test.test("nConfigEngine::components without metadata stay discoverable", () => {
	var d = harness.tmpDir("nce-nometa")
	io.mkdir(d + "/config/objects")
	io.writeFileString(d + "/config/objects/nInput_NoMeta.js", "// deliberately not loaded\nvar nInput_NoMeta = function(aMap) {}\n")

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	var c = e.getComponent("input", "nInput_NoMeta")

	ow.test.assert(isDef(c), true, "a component with no metadata is still discovered")
	ow.test.assert(c.type, "input", "its kind is inferred from the constructor prefix")
	ow.test.assert(c.metadata.present, false, "and it is reported as having no metadata")
	ow.test.assert(c.metadata.coverage, "none", "with no coverage")
	ow.test.assert(c.parameters.length, 0, "and no parameters")
})

ow.test.test("nConfigEngine::local metadata overrides packaged metadata", () => {
	var d = harness.tmpDir("nce-override")
	io.mkdir(d + "/config/objects.meta")
	io.writeFileString(d + "/config/objects.meta/x.yaml", af.toYAML({
		kind: "input", constructor: "nInput_Filesystem",
		title: "Locally documented", description: "Local override.",
		arguments: [ { name: "volumeNames", type: "string", description: "Overridden.", example: "/x" } ]
	}))

	var e = new nConfigEngine({ home: NATTRMON_HOME, configPath: d + "/config" })
	ow.test.assert(e.getComponent("input", "nInput_Filesystem").title, "Locally documented", "the local entry wins")
})

ow.test.test("nConfigEngine::unknown components return undefined rather than throwing", () => {
	var e = __d_engine()
	ow.test.assert(isUnDef(e.getComponent("input", "nInput_DoesNotExist")), true, "an unknown component is undefined")
	ow.test.assert(isUnDef(e.getComponent("output", "nInput_Filesystem")), true, "a known component under the wrong kind is undefined")
	ow.test.assert(e.listComponents("nope").length, 0, "an unknown kind yields no components")
})

ow.test.test("nConfigEngine::searches components by name, description and parameter", () => {
	var e = __d_engine()
	ow.test.assert(e.searchComponents("kube").length > 0, true, "search finds components by name")
	ow.test.assert(e.searchComponents("filesystem", "input").length > 0, true, "search can be filtered by kind")
	ow.test.assert(e.searchComponents("volumeNames").filter(c => c.name == "nInput_Filesystem").length, 1, "search matches parameter names")
	ow.test.assert(e.searchComponents("zzz-no-such-thing").length, 0, "search returns nothing when there is no match")
})

ow.test.test("nConfigEngine::malformed metadata is reported, not silently dropped", () => {
	var d = harness.tmpDir("nce-badmeta")
	io.mkdir(d + "/config/objects.meta")
	io.writeFileString(d + "/config/objects.meta/bad.yaml", af.toYAML({
		kind: "unknown", constructor: "nInput_Bad", title: "Bad", description: "Invalid kind.", arguments: []
	}))

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	ow.test.assert(e.getMetadataIssues().length > 0, true, "invalid metadata is reported as an issue")
	ow.test.assert(isUnDef(e.getComponent("input", "nInput_Bad")), true, "and the entry isn't registered")
})

ow.test.test("nConfigEngine::the packaged metadata still passes its own schema", () => {
	// Guards the query: declarations added to config/objects.meta/*.yaml
	ow.test.assert(__d_engine().getMetadataIssues().length, 0, "every packaged metadata file should validate")
})

ow.test.test("nConfigEngine::exposes the declared query dialects", () => {
	var e = __d_engine()

	var _jmx = e.getComponent("input", "nInput_JMX").parameters.filter(p => p.name == "objects")[0]
	ow.test.assert(_jmx.query["[].selector"], "nlinq", "JMX selectors are nLinq")
	ow.test.assert(_jmx.query["[].path"], "jmespath", "JMX paths are JMESPath")

	// The same execArgs name means a different language in a different plug
	var _http = e.getComponent("input", "nInput_HTTPJson").parameters.filter(p => p.name == "requests")[0]
	ow.test.assert(_http.query["{}.path"], "dotpath", "HTTPJson paths are simple dot-paths")

	var _chv = e.getComponent("input", "nInput_ChVals").parameters.filter(p => p.name == "filter")[0]
	ow.test.assert(_chv.query["."], "nlinq", "ChVals filters are nLinq query maps")
})

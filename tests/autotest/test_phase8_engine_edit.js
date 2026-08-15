// Phase 8 -- creation, modification and serialization
//
// The engine must not behave like a lossy parser: a load/edit/save round trip may never quietly
// drop configuration it doesn't model, and files the caller never touched must come back
// byte-identical.

loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

// An installation with a two-output file that uses YAML anchors plus an unmodelled top-level
// key, mirroring config/outputs/00.httpAll.yaml
var __e_anchored = [
	"common: &COMMON",
	"  authType: basic",
	"",
	"# a comment that plain re-serialization cannot keep",
	"output:",
	"  - name    : Output One",
	"    execFrom: nOutput_Fixture",
	"    execArgs : *COMMON",
	"  - name    : Output Two",
	"    execFrom: nOutput_Fixture",
	"    execArgs :",
	"      <<   : *COMMON",
	"      title: Some title",
	""
].join("\n")

// Builds a throwaway installation with a synthetic component and a few configuration files
// ----------------------------------------
// Returns { dir, engine }
// ----------------------------------------
var __e_fixture = function() {
	var d = harness.tmpDir("nce-edit")
	io.mkdir(d + "/config/objects")
	io.mkdir(d + "/config/objects.meta")
	io.mkdir(d + "/config/inputs")
	io.mkdir(d + "/config/outputs")

	;[ "nInput_Fixture", "nOutput_Fixture" ].forEach(n => {
		io.writeFileString(d + "/config/objects/" + n + ".js", "// never loaded by the engine\n")
		io.writeFileString(d + "/config/objects.meta/" + n + ".yaml", af.toYAML({
			kind: (n.indexOf("nInput_") == 0 ? "input" : "output"), constructor: n,
			title: n, description: "Synthetic component.",
			arguments: [ { name: "key", type: "string", description: "A key.", example: "k" } ]
		}))
	})

	io.writeFileString(d + "/config/inputs/00.plain.yaml", af.toYAML({
		input: { name: "Plain", execFrom: "nInput_Fixture", execArgs: { key: "original" } }
	}))
	io.writeFileString(d + "/config/outputs/00.anchored.yaml", __e_anchored)

	return { dir: d, engine: new nConfigEngine({ home: d, configPath: d + "/config" }) }
}

ow.test.test("nConfigEngine.load::represents inputs, outputs and validations", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	ow.test.assert(cfg.files.length, 2, "both configuration files are loaded")
	ow.test.assert(cfg.entries.length, 3, "every descriptor is collected")
	ow.test.assert(cfg.inputs.length, 1, "inputs are grouped")
	ow.test.assert(cfg.outputs.length, 2, "outputs are grouped, including list entries")
	ow.test.assert(cfg.validations.length, 0, "an absent kind yields an empty list")
	ow.test.assert(cfg.inputs[0].id, "input:Plain", "entries get stable, human-meaningful ids")
})

ow.test.test("nConfigEngine.createSkeleton::never invents values", () => {
	var d = harness.tmpDir("nce-skel")
	io.mkdir(d + "/config/objects.meta")
	io.writeFileString(d + "/config/objects.meta/x.yaml", af.toYAML({
		kind: "input", constructor: "nInput_Skel", title: "Skel", description: "Skeleton fixture.",
		arguments: [
			{ name: "key",     type: "string",  required: true, description: "Required.", example: "k" },
			{ name: "retries", type: "integer", required: true, default: 3, description: "Has a default.", example: 3 },
			{ name: "opt",     type: "string",  description: "Optional.", example: "o" }
		]
	}))

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	var s = e.createSkeleton("input", "nInput_Skel")

	ow.test.assert(s.descriptor.execFrom, "nInput_Skel", "the skeleton targets the component")
	ow.test.assert(s.descriptor.execArgs.key, null, "a required parameter with no default is left null")
	ow.test.assert(s.descriptor.execArgs.retries, 3, "a documented default is used -- it isn't invented")
	ow.test.assert(isUnDef(s.descriptor.execArgs.opt), true, "optional parameters are not emitted")
	ow.test.assert(stringify(s.missingRequired, __, ""), stringify([ "key" ], __, ""), "the caller is told what still needs a value")
})

ow.test.test("nConfigEngine.create::merges caller values over the skeleton", () => {
	var f = __e_fixture()
	var d = f.engine.create("input", "nInput_Fixture", { name: "Made", execArgs: { key: "v" } })

	ow.test.assert(d.name, "Made", "caller fields win")
	ow.test.assert(d.execFrom, "nInput_Fixture", "the component is kept")
	ow.test.assert(d.execArgs.key, "v", "execArgs are merged")
})

ow.test.test("nConfigEngine::set and patch modify only the targeted entry", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	f.engine.set(cfg, "input:Plain", "execArgs.key", "changed")
	ow.test.assert(f.engine.get(cfg, "input:Plain").descriptor.execArgs.key, "changed", "set writes into the descriptor")

	f.engine.patch(cfg, "input:Plain", { cron: "*/5 * * * *", execArgs: { extra: 1 } })
	var _d = f.engine.get(cfg, "input:Plain").descriptor
	ow.test.assert(_d.cron, "*/5 * * * *", "patch adds descriptor fields")
	ow.test.assert(_d.execArgs.key, "changed", "patch merges execArgs rather than replacing them")
	ow.test.assert(_d.execArgs.extra, 1, "and adds the new ones")

	ow.test.assert(cfg.files.filter(x => x.relPath == "inputs/00.plain.yaml")[0].dirty, true, "the edited file is marked dirty")
	ow.test.assert(cfg.files.filter(x => x.relPath == "outputs/00.anchored.yaml")[0].dirty, false, "and the untouched one isn't")
})

ow.test.test("nConfigEngine::renaming an entry keeps its id consistent with a fresh load", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	var _e = f.engine.patch(cfg, "input:Plain", { name: "Renamed" })
	ow.test.assert(_e.id, "input:Renamed", "the id follows the new name")
	ow.test.assert(isUnDef(f.engine.get(cfg, "input:Plain")), true, "the old id no longer resolves")
	ow.test.assert(isDef(f.engine.get(cfg, "input:Renamed")), true, "and the new one does")

	f.engine.save(cfg, f.dir + "/config", { allowFormattingLoss: true })
	ow.test.assert(isDef(f.engine.get(f.engine.load(f.dir + "/config"), "input:Renamed")), true, "an id means the same thing before and after a save")
})

ow.test.test("nConfigEngine::entries with duplicate names get distinct ids", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	f.engine.add(cfg, "output", { name: "Output One", execFrom: "nOutput_Fixture" }, { file: "outputs/00.anchored.yaml" })
	ow.test.assert(isDef(f.engine.get(cfg, "output:Output One")), true, "the first keeps the plain id")
	ow.test.assert(isDef(f.engine.get(cfg, "output:Output One#2")), true, "the duplicate is disambiguated")
})

ow.test.test("nConfigEngine.add::appends to an existing file and to a new one", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	var _e = f.engine.add(cfg, "output", { name: "Output Three", execFrom: "nOutput_Fixture" }, { file: "outputs/00.anchored.yaml" })
	ow.test.assert(_e.id, "output:Output Three", "the new entry gets an id")
	ow.test.assert(cfg.outputs.length, 3, "and joins the model")
	ow.test.assert(cfg.files.filter(x => x.relPath == "outputs/00.anchored.yaml")[0].parsed.output.length, 3, "appended to the existing list")

	f.engine.add(cfg, "input", { name: "Brand New", execFrom: "nInput_Fixture" })
	ow.test.assert(cfg.inputs.length, 2, "a descriptor can be added to a brand-new file")
	ow.test.assert(cfg.files.filter(x => x.relPath == "inputs/Brand_New.yaml").length, 1, "which is created in the model")
})

ow.test.test("nConfigEngine.add::converts a single descriptor into a list", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	f.engine.add(cfg, "input", { name: "Second", execFrom: "nInput_Fixture" }, { file: "inputs/00.plain.yaml" })
	var _p = cfg.files.filter(x => x.relPath == "inputs/00.plain.yaml")[0].parsed

	ow.test.assert(isArray(_p.input), true, "a single input becomes a list when a second is added")
	ow.test.assert(_p.input.length, 2, "holding both descriptors")
	ow.test.assert(f.engine.get(cfg, "input:Plain").listIndex, 0, "the pre-existing entry is re-indexed")
})

ow.test.test("nConfigEngine.remove::removes an entry and re-indexes its siblings", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	f.engine.remove(cfg, "output:Output One")
	ow.test.assert(cfg.outputs.length, 1, "the entry is gone from the model")
	ow.test.assert(isUnDef(f.engine.get(cfg, "output:Output One")), true, "and can no longer be looked up")
	ow.test.assert(f.engine.get(cfg, "output:Output Two").listIndex, 0, "the remaining sibling is re-indexed")

	f.engine.remove(cfg, "input:Plain")
	ow.test.assert(isUnDef(cfg.files.filter(x => x.relPath == "inputs/00.plain.yaml")[0].parsed.input), true, "removing a single descriptor drops the key")
})

ow.test.test("nConfigEngine.toYAML::returns untouched files byte for byte", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	var _ser = f.engine.toYAML(cfg)
	_ser.files.forEach(sf => {
		var _orig = cfg.files.filter(x => x.relPath == sf.path)[0]
		ow.test.assert(sf.content, _orig.raw, sf.path + " should be re-emitted unchanged")
	})
	ow.test.assert(_ser.warnings.length, 0, "and nothing is warned about")
})

ow.test.test("nConfigEngine.toYAML::warns before losing anchors and comments", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	f.engine.patch(cfg, "output:Output One", { description: "edited" })
	var _ser = f.engine.toYAML(cfg)

	var _loss = _ser.warnings.filter(w => w.code == "FORMATTING_LOSS")
	ow.test.assert(_loss.length, 1, "rewriting an anchored file warns about formatting loss")
	ow.test.assert(_loss[0].path, "outputs/00.anchored.yaml", "naming the file")

	var _clean = _ser.files.filter(x => x.path == "inputs/00.plain.yaml")[0]
	ow.test.assert(_clean.content, cfg.files.filter(x => x.relPath == "inputs/00.plain.yaml")[0].raw, "the untouched file is still byte-identical")
})

ow.test.test("nConfigEngine.save::refuses formatting loss unless it is asked for", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")
	f.engine.patch(cfg, "output:Output One", { description: "edited" })

	var _r = f.engine.save(cfg, f.dir + "/config")
	ow.test.assert(stringify(_r.skipped, __, ""), stringify([ "outputs/00.anchored.yaml" ], __, ""), "the anchored file is skipped by default")
	ow.test.assert(_r.written.length, 0, "and nothing is written")
	ow.test.assert(io.readFileString(f.dir + "/config/outputs/00.anchored.yaml").indexOf("&COMMON") > 0, true, "so the file on disk is untouched")

	var _r2 = f.engine.save(cfg, f.dir + "/config", { allowFormattingLoss: true })
	ow.test.assert(stringify(_r2.written, __, ""), stringify([ "outputs/00.anchored.yaml" ], __, ""), "an explicit opt-in writes it")
	ow.test.assert(io.readFileString(f.dir + "/config/outputs/00.anchored.yaml").indexOf("edited") > 0, true, "with the edit applied")
})

ow.test.test("nConfigEngine::a load/edit/save round trip loses nothing it doesn't model", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")

	f.engine.set(cfg, "output:Output Two", "execArgs.title", "New title")
	f.engine.save(cfg, f.dir + "/config", { allowFormattingLoss: true })

	var _re = f.engine.load(f.dir + "/config")
	ow.test.assert(_re.entries.length, 3, "every descriptor survives the round trip")
	ow.test.assert(f.engine.get(_re, "output:Output Two").descriptor.execArgs.title, "New title", "the edit is persisted")

	// The anchor is expanded, but the values it carried are still there...
	ow.test.assert(f.engine.get(_re, "output:Output One").descriptor.execArgs.authType, "basic", "merged anchor values survive as values")
	// ...and the top-level key the engine doesn't model is untouched
	var _f = _re.files.filter(x => x.relPath == "outputs/00.anchored.yaml")[0]
	ow.test.assert(isDef(_f.parsed.common), true, "unmodelled top-level keys survive the round trip")
	ow.test.assert(_f.parsed.common.authType, "basic", "with their contents intact")
})

ow.test.test("nConfigEngine::JavaScript plug files survive untouched", () => {
	var f = __e_fixture()
	io.writeFileString(f.dir + "/config/inputs/99.code.js", "// a JS plug\nnattrmon.addInput(1)\n")

	var cfg = f.engine.load(f.dir + "/config")
	var _js = cfg.files.filter(x => x.format == "js")[0]

	ow.test.assert(isDef(_js), true, "JavaScript plug files are tracked")
	ow.test.assert(isUnDef(_js.parsed), true, "but never parsed as data")
	ow.test.assert(cfg.entries.filter(e => e.file == "inputs/99.code.js").length, 0, "and contribute no editable descriptors")
	ow.test.assert(f.engine.toYAML(cfg).files.filter(x => x.path == "inputs/99.code.js")[0].content, _js.raw, "and are re-emitted verbatim")
})

ow.test.test("nConfigEngine.explainComponent::combines configuration with metadata", () => {
	var f = __e_fixture()
	var cfg = f.engine.load(f.dir + "/config")
	var x = f.engine.explainComponent(cfg, "input:Plain")

	ow.test.assert(x.name, "Plain", "the configured name is reported")
	ow.test.assert(x.type, "input", "with its kind")
	ow.test.assert(x.object, "nInput_Fixture", "and the component it uses")
	ow.test.assert(x.parameters.key.value, "original", "each parameter carries its configured value")
	ow.test.assert(x.parameters.key.type, "string", "and its documented type")
	ow.test.assert(x.parameters.key.description, "A key.", "and its documented description")
})

ow.test.test("nConfigEngine.explainComponent::states nothing it cannot derive", () => {
	var d = harness.tmpDir("nce-explain")
	io.mkdir(d + "/config/inputs")
	io.writeFileString(d + "/config/inputs/00.inline.yaml", af.toYAML({
		input: { name: "Inline", cron: "*/10 * * * * *", exec: "return {}" }
	}))

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	var x = e.explainComponent(e.load(d + "/config"), "input:Inline")

	ow.test.assert(x.inline, true, "an inline descriptor is reported as inline")
	ow.test.assert(isUnDef(x.object), true, "with no component invented for it")
	ow.test.assert(x.trigger.cron, "*/10 * * * * *", "the trigger is reported from the configuration")
	ow.test.assert(isUnDef(x.produces), true, "and nothing is claimed about what it produces")
})

ow.test.test("nConfigEngine.explainComponent::never reveals secret values", () => {
	var d = harness.tmpDir("nce-secret")
	io.mkdir(d + "/config/objects.meta")
	io.mkdir(d + "/config/inputs")
	io.writeFileString(d + "/config/objects.meta/s.yaml", af.toYAML({
		kind: "input", constructor: "nInput_Sec", title: "Sec", description: "Has a secret.",
		arguments: [ { name: "pass", type: "string", secret: true, description: "A password.", example: "$PASS" } ]
	}))
	io.writeFileString(d + "/config/inputs/00.s.yaml", af.toYAML({
		input: { name: "S", execFrom: "nInput_Sec", execArgs: { pass: "hunter2" } }
	}))

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	var x = e.explainComponent(e.load(d + "/config"), "input:S")
	ow.test.assert(x.parameters.pass.value, "(secret)", "a value declared secret is redacted")
})

ow.test.test("nConfigEngine.explain::describes a whole configuration", () => {
	var f = __e_fixture()
	var x = f.engine.explain(f.engine.load(f.dir + "/config"))

	ow.test.assert(x.components.length, 3, "every entry is explained")
	ow.test.assert(x.files.length, 2, "and every file is listed")
	ow.test.assert(x.files.filter(y => y.path == "outputs/00.anchored.yaml")[0].entries, 2, "with its entry count")
})

ow.test.test("nConfigEngine::validate and explain accept a directory path directly", () => {
	var f = __e_fixture()
	ow.test.assert(f.engine.validate(f.dir + "/config").stats.entries, 3, "validate() loads a path itself")
	ow.test.assert(f.engine.explain(f.dir + "/config").components.length, 3, "explain() loads a path itself")
})

ow.test.test("nConfigEngine::a '#' inside a value isn't mistaken for a comment", () => {
	var d = harness.tmpDir("nce-hash")
	io.mkdir(d + "/config/inputs")
	io.writeFileString(d + "/config/inputs/00.url.yaml", af.toYAML({
		input: { name: "Frag", execFrom: "nInput_Fixture", execArgs: { url: "http://example.test/page#section" } }
	}))

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	var cfg = e.load(d + "/config")
	e.patch(cfg, "input:Frag", { description: "edited" })

	var _ser = e.toYAML(cfg)
	ow.test.assert(_ser.warnings.length, 0, "a '#' inside a URL fragment raises no formatting-loss warning")
	ow.test.assert(e.save(cfg, d + "/config").written.length, 1, "so the file saves without an opt-in")
})

ow.test.test("nConfigEngine.toJSON::serializes the model as JSON", () => {
	var f = __e_fixture()
	var j = f.engine.toJSON(f.engine.load(f.dir + "/config"))

	ow.test.assert(j.files.length, 2, "every data file is serialized")
	var _one = j.files.filter(x => x.path == "inputs/00.plain.json")[0]
	ow.test.assert(isDef(_one), true, "with a .json path")
	ow.test.assert(jsonParse(_one.content).input.name, "Plain", "and parseable contents")
})

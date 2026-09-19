loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

var __editFixture = function() {
	var d = harness.tmpDir("edit-regression")
	io.mkdir(d + "/config/inputs")
	io.writeFileString(d + "/config/inputs/10.original.yaml", af.toYAML({
		input: { name: "Same", exec: "return {}", execArgs: { marker: "original" } }
	}))
	var engine = new nConfigEngine({ home: d, configPath: d + "/config" })
	return { dir: d, engine: engine, cfg: engine.load() }
}

ow.test.test("nConfigEngine::literal suffix names never collide with generated ids", () => {
	var f = __editFixture()
	f.engine.add(f.cfg, "input", { name: "Same", exec: "return {}" }, { file: "inputs/10.original.yaml" })
	f.engine.add(f.cfg, "input", { name: "Same#2", exec: "return {}" }, { file: "inputs/10.original.yaml" })
	var ids = f.cfg.entries.map(e => e.id)
	ow.test.assert(ids.filter((id, i) => ids.indexOf(id) == i).length, 3, "every entry must have a distinct editable id")
	f.cfg.entries.forEach(e => ow.test.assert(f.engine.get(f.cfg, e.id) === e, true, "an id resolves to its own entry"))
	ow.test.assert(f.engine.get(f.cfg, "input:Same#2").name, "Same#2", "literal names keep their own base id")
	f.engine.save(f.cfg)
	var reloaded = f.engine.load()
	ow.test.assert(stringify(reloaded.entries.map(e => e.id)), stringify(ids), "suffix disambiguation survives reload")
})

ow.test.test("nConfigEngine::exporting to another directory leaves source edits pending", () => {
	var f = __editFixture()
	f.engine.patch(f.cfg, "input:Same", { description: "pending edit" })
	var target = harness.tmpDir("edit-export") + "/config"
	ow.test.assert(f.engine.save(f.cfg, target).written.length, 1, "export writes the edited file")
	ow.test.assert(f.cfg.files[0].dirty, true, "export does not mark the source saved")
	ow.test.assert(f.engine.save(f.cfg).written.length, 1, "the source still receives its edit")
})

ow.test.test("nConfigEngine::skipped and failed writes keep edits pending", () => {
	var f = __editFixture()
	var path = f.dir + "/config/inputs/10.original.yaml"
	io.writeFileString(path, "# retain me\n" + io.readFileString(path))
	f.cfg = f.engine.load()
	f.engine.patch(f.cfg, "input:Same", { description: "pending edit" })
	ow.test.assert(f.engine.save(f.cfg).skipped.length, 1, "formatting loss skips the write")
	ow.test.assert(f.cfg.files[0].dirty, true, "skipped edits remain pending")
	var originalWrite = io.writeFileString, threw = false
	try {
		io.writeFileString = function() { throw "simulated disk failure" }
		try { f.engine.save(f.cfg, __, { allowFormattingLoss: true }) } catch(e) { threw = true }
	} finally { io.writeFileString = originalWrite }
	ow.test.assert(threw, true, "write failures reach the caller")
	ow.test.assert(f.cfg.files[0].dirty, true, "failed edits remain pending")
	ow.test.assert(f.engine.save(f.cfg, f.cfg.configPath + "/.", { allowFormattingLoss: true }).written.length, 1, "retry succeeds through an equivalent source path")
	ow.test.assert(f.cfg.files[0].dirty, false, "successful retry clears the edit")
	ow.test.assert(f.cfg.files[0].raw, io.readFileString(path), "the saved text replaces the old baseline")
	ow.test.assert(f.engine.toYAML(f.cfg).warnings.length, 0, "the saved baseline no longer reports stale formatting loss")
})

ow.test.test("nConfigEngine::duplicate ids retain their targets across save and reload", () => {
	var f = __editFixture()
	f.engine.add(f.cfg, "input", { name: "Same", exec: "return {}", execArgs: { marker: "earlier" } }, { file: "inputs/00.earlier.yaml" })
	var before = f.cfg.entries.map(e => ({ id: e.id, marker: e.descriptor.execArgs.marker }))
	f.engine.save(f.cfg)
	var reloaded = f.engine.load()
	before.forEach(e => ow.test.assert(f.engine.get(reloaded, e.id).descriptor.execArgs.marker, e.marker, "reload must not redirect an id to another plug"))
})

ow.test.test("nConfigEngine::successful saves stop rewriting previously edited files", () => {
	var f = __editFixture()
	f.engine.patch(f.cfg, "input:Same", { description: "saved edit" })
	ow.test.assert(f.engine.save(f.cfg).written.length, 1, "the first edit is saved")
	var path = f.dir + "/config/inputs/10.original.yaml"
	var saved = io.readFileString(path)
	ow.test.assert(f.engine.toYAML(f.cfg).files[0].content, saved, "serialization uses the saved baseline")
	io.writeFileString(path, saved + "\n# subsequent external edit\n")
	f.engine.add(f.cfg, "input", { name: "Other", exec: "return {}" })
	var result = f.engine.save(f.cfg)
	ow.test.assert(result.written.length, 1, "only the newly edited file is written")
	ow.test.assert(io.readFileString(path), saved + "\n# subsequent external edit\n", "a later save preserves changes to clean files")
	f.engine.patch(f.cfg, "input:Other", { description: "second edit" })
	ow.test.assert(f.engine.save(f.cfg).written.length, 1, "a subsequent edit becomes dirty again")
})

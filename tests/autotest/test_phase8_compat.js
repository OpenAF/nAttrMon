// Phase 8 -- backwards compatibility
//
// Existing configurations and custom objects are first-class: the engine must load every
// configuration this repository ships, round-trip it without touching a byte, and never require
// anything to be migrated to a new format.

loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

// Stages a copy of the shipped sample configurations under the active kind directories, so the
// whole corpus goes through the same code path a real configuration would
// ----------------------------------------
// Returns { dir, engine, staged }
// ----------------------------------------
var __c_stage = function() {
	var d = harness.tmpDir("nce-compat")
	var _staged = 0

	;[ "input", "output", "validation" ].forEach(kind => {
		io.mkdir(d + "/config/" + kind + "s")
		;[ kind + "s", kind + "s.disabled" ].forEach(src => {
			var _from = NATTRMON_HOME + "/config/" + src
			if (!io.fileExists(_from)) return
			$from(listFilesRecursive(_from))
			.equals("isFile", true)
			.match("filename", ".*\\.(ya?ml|json)$")
			.sort("filepath")
			.select(f => {
				if (f.filename.indexOf(".") == 0) return
				if (f.filename.match(/\.sample$/)) return
				// Keep the source folder in the name so same-named samples don't collide
				io.writeFileBytes(d + "/config/" + kind + "s/" + src.replace(/\./g, "_") + "__" + f.filename, io.readFileBytes(f.filepath))
				_staged++
			})
		})
	})

	return { dir: d, engine: new nConfigEngine({ home: NATTRMON_HOME, configPath: d + "/config" }), staged: _staged }
}

ow.test.test("nConfigEngine::loads every configuration this repository ships", () => {
	var s = __c_stage()
	ow.test.assert(s.staged > 40, true, "the sample corpus should be substantial (staged " + s.staged + ")")

	var cfg = s.engine.load(s.dir + "/config")
	ow.test.assert(cfg.files.length, s.staged, "every staged file is loaded")

	var _broken = cfg.files.filter(f => isDef(f.parseError))
	ow.test.assert(_broken.length, 0, "none of them fails to parse: " + stringify(_broken.map(f => f.relPath + ": " + f.parseError), __, ""))
	ow.test.assert(cfg.entries.length > 40, true, "and plug descriptors are found across them")
})

ow.test.test("nConfigEngine::an unmodified configuration round-trips byte for byte", () => {
	// This is the property that makes the engine safe to point at a real installation: loading
	// and serializing without editing must not rewrite anything.
	var s = __c_stage()
	var cfg = s.engine.load(s.dir + "/config")

	var _ser = s.engine.toYAML(cfg)
	var _changed = _ser.files.filter(f => f.content != cfg.files.filter(o => o.relPath == f.path)[0].raw)

	ow.test.assert(_changed.length, 0, "no file changes when nothing was edited: " + stringify(_changed.map(f => f.path), __, ""))
	ow.test.assert(_ser.warnings.length, 0, "and no formatting-loss warnings are raised")
})

ow.test.test("nConfigEngine::saving an untouched configuration writes nothing", () => {
	var s = __c_stage()
	var cfg = s.engine.load(s.dir + "/config")
	var r = s.engine.save(cfg, s.dir + "/config")

	ow.test.assert(r.written.length, 0, "nothing is written")
	ow.test.assert(r.skipped.length, 0, "and nothing is skipped either")
})

ow.test.test("nConfigEngine::every shipped descriptor form is understood", () => {
	var s = __c_stage()
	var cfg = s.engine.load(s.dir + "/config")

	// The corpus exercises single-descriptor documents, list documents, inline exec, execFrom,
	// and files carrying more than one kind at once.
	ow.test.assert(cfg.entries.filter(e => isUnDef(e.listIndex)).length > 0, true, "single-descriptor documents are represented")
	ow.test.assert(cfg.entries.filter(e => isDef(e.listIndex)).length > 0, true, "list documents are represented")
	ow.test.assert(cfg.entries.filter(e => isDef(e.descriptor.exec)).length > 0, true, "inline exec descriptors are represented")
	ow.test.assert(cfg.entries.filter(e => isDef(e.descriptor.execFrom)).length > 0, true, "execFrom descriptors are represented")

	var _unnamed = cfg.entries.filter(e => e.name == "unnamed")
	ow.test.assert(_unnamed.length, 0, "every shipped descriptor has a usable name: " + stringify(_unnamed.map(e => e.file), __, ""))
})

ow.test.test("nConfigEngine::the shipped samples reference no unavailable component", () => {
	var s = __c_stage()
	var v = s.engine.validate(s.engine.load(s.dir + "/config"))

	var _unknown = v.errors.concat(v.warnings).filter(d => d.code == "UNKNOWN_COMPONENT")
	ow.test.assert(_unknown.length, 0, "every execFrom resolves to an available component: " + stringify(_unknown.map(d => d.path), __, ""))
})

ow.test.test("nConfigEngine::validating never loads or evaluates plug code", () => {
	// nAttrMon.prototype.loadObject resolves execFrom and runs the constructor; the engine must
	// not, or merely validating a file would have side effects.
	var _before = af.fromJavaArray(af.getScopeIds()).filter(k => k.indexOf("nInput_") == 0 || k.indexOf("nOutput_") == 0 || k.indexOf("nValidation_") == 0).length

	var s = __c_stage()
	s.engine.validate(s.engine.load(s.dir + "/config"))

	var _after = af.fromJavaArray(af.getScopeIds()).filter(k => k.indexOf("nInput_") == 0 || k.indexOf("nOutput_") == 0 || k.indexOf("nValidation_") == 0).length
	ow.test.assert(_after, _before, "no plug constructor is defined as a side effect of validation")
})

ow.test.test("nConfigEngine::the repository's own active configuration validates", () => {
	var e = new nConfigEngine({ home: NATTRMON_HOME, configPath: NATTRMON_HOME + "/config" })
	var v = e.validate(e.load(NATTRMON_HOME + "/config"))

	ow.test.assert(v.valid, true, "config/ validates as shipped: " + stringify(v.errors, __, ""))
	ow.test.assert(v.stats.entries > 0, true, "and does contain entries")
})

ow.test.test("nConfigEngine::the packaged object metadata is complete and valid", () => {
	var e = new nConfigEngine({ home: NATTRMON_HOME, configPath: NATTRMON_HOME + "/config" })

	ow.test.assert(e.getMetadataIssues().length, 0, "every packaged metadata file passes the schema")

	// Every constructor under config/objects/ should still be discoverable
	var _files = $from(listFilesRecursive(NATTRMON_HOME + "/config/objects")).equals("isFile", true).match("filename", ".*\\.js$").select()
	var _known = {}
	e.listComponents().forEach(c => { _known[c.name] = true })

	var _missing = _files.map(f => f.filename.replace(/\.js$/, "")).filter(n => isUnDef(_known[n]))
	ow.test.assert(_missing.length, 0, "every packaged object is discoverable: " + stringify(_missing, __, ""))
})

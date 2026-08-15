// Phase 8 -- configuration validation
//
// Required/type/enum checks are exercised against synthetic metadata fixtures because the
// packaged corpus is almost entirely generated boilerplate (68 of 73 files are 'type: any',
// 70 declare no 'required', none declare an 'enum'). One smoke test covers the real thing.

loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

// Builds a throwaway installation with one synthetic component and one configuration file
// ----------------------------------------
// aMeta = metadata entry for the synthetic component
// aCfg  = configuration document to write under inputs/
// Returns { engine, config }
// ----------------------------------------
var __v_fixture = function(aMeta, aCfg) {
	var d = harness.tmpDir("nce-validate")
	io.mkdir(d + "/config/objects")
	io.mkdir(d + "/config/objects.meta")
	io.mkdir(d + "/config/inputs")

	io.writeFileString(d + "/config/objects/" + aMeta.constructor + ".js", "// never loaded by the engine\n")
	io.writeFileString(d + "/config/objects.meta/" + aMeta.constructor + ".yaml", af.toYAML(aMeta))
	io.writeFileString(d + "/config/inputs/00.test.yaml", af.toYAML(aCfg))

	var e = new nConfigEngine({ home: d, configPath: d + "/config" })
	return { engine: e, config: e.load(d + "/config") }
}

var __v_meta = {
	kind: "input", constructor: "nInput_Fixture",
	title: "Fixture", description: "Synthetic component used to exercise validation.",
	arguments: [
		{ name: "key",     type: "string",  required: true, description: "Required key.",  example: "myKey" },
		{ name: "timeout", type: "integer", description: "Timeout in ms.", example: 1000 },
		{ name: "level",   type: "string",  description: "Severity.", example: "high", enum: [ "high", "low" ] }
	]
}

// Returns the diagnostics carrying a given code
var __v_codes = function(aDiag, aCode) {
	return aDiag.errors.concat(aDiag.warnings).concat(aDiag.info).filter(d => d.code == aCode)
}

ow.test.test("nConfigEngine.validate::accepts a valid configuration", () => {
	var f = __v_fixture(__v_meta, { input: { name: "ok", execFrom: "nInput_Fixture", execArgs: { key: "k", timeout: 10, level: "high" } } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, true, "a valid configuration passes: " + stringify(v.errors, __, ""))
	ow.test.assert(v.stats.entries, 1, "the entry is counted")
	ow.test.assert(v.stats.withMetadata, 1, "and is reported as metadata-checked")
})

ow.test.test("nConfigEngine.validate::detects a missing required parameter", () => {
	var f = __v_fixture(__v_meta, { input: { name: "missing", execFrom: "nInput_Fixture", execArgs: { timeout: 10 } } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, false, "a missing required parameter fails validation")
	var _r = __v_codes(v, "REQUIRED_PARAMETER")
	ow.test.assert(_r.length, 1, "exactly one REQUIRED_PARAMETER is reported")
	ow.test.assert(_r[0].path, "input:missing.execArgs.key", "and it points at the parameter")
})

ow.test.test("nConfigEngine.validate::detects a wrong parameter type", () => {
	var f = __v_fixture(__v_meta, { input: { name: "wrongtype", execFrom: "nInput_Fixture", execArgs: { key: "k", timeout: "soon" } } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, false, "a wrongly typed parameter fails validation")
	ow.test.assert(__v_codes(v, "PARAMETER_TYPE").length, 1, "a PARAMETER_TYPE error is reported")
})

ow.test.test("nConfigEngine.validate::detects a value outside a declared enum", () => {
	var f = __v_fixture(__v_meta, { input: { name: "badenum", execFrom: "nInput_Fixture", execArgs: { key: "k", level: "medium" } } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, false, "a value outside the enum fails validation")
	ow.test.assert(__v_codes(v, "PARAMETER_ENUM").length, 1, "a PARAMETER_ENUM error is reported")
})

ow.test.test("nConfigEngine.validate::'type: any' never fails a check", () => {
	var _anyMeta = merge(clone(__v_meta), {})
	_anyMeta.arguments = [ { name: "anything", type: "any", description: "Untyped.", example: {} } ]

	var f = __v_fixture(_anyMeta, { input: { name: "any", execFrom: "nInput_Fixture", execArgs: { anything: 12345 } } })
	ow.test.assert(f.engine.validate(f.config).valid, true, "an 'any' parameter accepts any value")
})

ow.test.test("nConfigEngine.validate::flags undeclared parameters only when metadata is complete", () => {
	// Metadata that documents every argument is a closed set: an undeclared key is worth a warning
	var f = __v_fixture(__v_meta, { input: { name: "extra", execFrom: "nInput_Fixture", execArgs: { key: "k", nosuch: 1 } } })
	var v = f.engine.validate(f.config)
	ow.test.assert(__v_codes(v, "UNKNOWN_PARAMETER").length, 1, "an undeclared parameter is warned about")
	ow.test.assert(v.valid, true, "but it is a warning, not an error")

	// Generated boilerplate doesn't necessarily list every argument, so warning there is noise
	var _genMeta = clone(__v_meta)
	_genMeta.description = "Configuration metadata for nInput_Fixture."
	_genMeta.arguments = [ { name: "key", type: "any", description: "Configuration option read by nInput_Fixture.", example: {} } ]

	var g = __v_fixture(_genMeta, { input: { name: "extra", execFrom: "nInput_Fixture", execArgs: { key: "k", nosuch: 1 } } })
	ow.test.assert(__v_codes(g.engine.validate(g.config), "UNKNOWN_PARAMETER").length, 0, "generated metadata doesn't produce undeclared-parameter noise")
})

ow.test.test("nConfigEngine.validate::detects malformed descriptors through the shared schema", () => {
	// Reuses nAttrMon.prototype.validateDescriptorSchema, so there is one definition of validity
	var f = __v_fixture(__v_meta, { input: { name: "bad", execFrom: "nInput_Fixture", execArgs: { key: "k" }, waitForFinish: "yes" } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, false, "a malformed descriptor fails validation")
	ow.test.assert(__v_codes(v, "MALFORMED_DESCRIPTOR").length > 0, true, "a MALFORMED_DESCRIPTOR error is reported")
})

ow.test.test("nConfigEngine.validate::requires exactly one of exec or execFrom", () => {
	var _none = __v_fixture(__v_meta, { input: { name: "neither" } })
	ow.test.assert(__v_codes(_none.engine.validate(_none.config), "MALFORMED_DESCRIPTOR").length > 0, true, "neither exec nor execFrom is rejected")

	var _both = __v_fixture(__v_meta, { input: { name: "both", exec: "return {}", execFrom: "nInput_Fixture" } })
	ow.test.assert(__v_codes(_both.engine.validate(_both.config), "MALFORMED_DESCRIPTOR").length > 0, true, "both exec and execFrom is ambiguous")
})

ow.test.test("nConfigEngine.validate::an inline exec descriptor is valid and has no component", () => {
	// config/inputs/01.test.yaml is exactly this shape -- it must never be an unknown component
	var f = __v_fixture(__v_meta, { input: { name: "inline", cron: "*/10 * * * * *", exec: "var r = {}; return r" } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, true, "an inline exec descriptor is valid: " + stringify(v.errors, __, ""))
	ow.test.assert(__v_codes(v, "UNKNOWN_COMPONENT").length, 0, "and is never reported as an unknown component")
	ow.test.assert(v.stats.withoutMetadata, 1, "it is counted as having no metadata")
})

ow.test.test("nConfigEngine.validate::detects unknown components", () => {
	var f = __v_fixture(__v_meta, { input: { name: "ghost", execFrom: "nInput_NotInstalled" } })
	var v = f.engine.validate(f.config)

	ow.test.assert(v.valid, false, "an unavailable component fails validation")
	ow.test.assert(__v_codes(v, "UNKNOWN_COMPONENT").length, 1, "an UNKNOWN_COMPONENT error is reported")
})

ow.test.test("nConfigEngine.validate::normalizes legacy descriptor keys without logging", () => {
	var f = __v_fixture(__v_meta, { input: { name: "legacy", execfrom: "nInput_Fixture", execargs: { key: "k" }, waitforfinish: true } })
	var v = f.engine.validate(f.config)

	ow.test.assert(__v_codes(v, "LEGACY_KEY").length > 0, true, "legacy keys are reported as diagnostics")
	ow.test.assert(__v_codes(v, "MALFORMED_DESCRIPTOR").length, 0, "and the normalized descriptor still validates")
})

ow.test.test("nConfigEngine.validate::strict mode promotes warnings to errors", () => {
	var f = __v_fixture(__v_meta, { input: { name: "extra", execFrom: "nInput_Fixture", execArgs: { key: "k", nosuch: 1 } } })

	ow.test.assert(f.engine.validate(f.config, { mode: "warn" }).valid, true, "warn mode passes with warnings")
	var _strict = f.engine.validate(f.config, { mode: "strict" })
	ow.test.assert(_strict.valid, false, "strict mode fails on the same configuration")
	ow.test.assert(_strict.warnings.length, 0, "strict mode leaves no warnings behind")
	ow.test.assert(_strict.errors.length > 0, true, "having moved them into errors")
})

ow.test.test("nConfigEngine.validate::validates the queries declared in metadata", () => {
	var _qMeta = {
		kind: "input", constructor: "nInput_QFixture",
		title: "Query fixture", description: "Synthetic component with query surfaces.",
		arguments: [
			{ name: "filter",  type: "object", description: "nLinq query.", example: {}, query: { ".": "nlinq" } },
			{ name: "objects", type: "array<object>", description: "Entries.", example: [], query: { "[].path": "jmespath" } },
			{ name: "reqs",    type: "object", description: "Requests.", example: {}, query: { "{}.path": "dotpath" } }
		]
	}

	var f = __v_fixture(_qMeta, { input: [
		{ name: "goodq", execFrom: "nInput_QFixture", execArgs: {
			filter : { where: [ { cond: "equals", args: [ "a", 1 ] } ] },
			objects: [ { path: "a.b[*].c" } ],
			reqs   : { one: { path: "a.b" } }
		} },
		{ name: "badq", execFrom: "nInput_QFixture", execArgs: {
			filter : { where: [ { cond: "nope", args: [ "a", 1 ] } ] },
			objects: [ { path: "a[?b ==" } ],
			reqs   : { one: { path: "a[?b]" } }
		} }
	] })

	var v = f.engine.validate(f.config)
	ow.test.assert(v.stats.queriesChecked, 6, "every declared query surface is checked")
	ow.test.assert(v.valid, false, "the malformed queries fail validation")

	var _iq = __v_codes(v, "INVALID_QUERY")
	ow.test.assert(_iq.filter(d => d.path.indexOf("input:badq.execArgs.filter") == 0).length > 0, true, "the bad nLinq query is caught")
	ow.test.assert(_iq.filter(d => d.path.indexOf("input:badq.execArgs.objects") == 0).length > 0, true, "the bad JMESPath is caught")
	ow.test.assert(_iq.filter(d => d.path.indexOf("input:badq.execArgs.reqs") == 0).length > 0, true, "the JMESPath written where a dot-path is expected is caught")
	ow.test.assert(_iq.filter(d => d.path.indexOf("input:goodq") == 0).length, 0, "and the valid entry produces no query errors")
})

ow.test.test("nConfigEngine.validate::the repository's own configuration is valid", () => {
	var e = new nConfigEngine({ home: NATTRMON_HOME, configPath: NATTRMON_HOME + "/config" })
	var v = e.validate(e.load(NATTRMON_HOME + "/config"))
	ow.test.assert(v.valid, true, "the shipped configuration validates: " + stringify(v.errors, __, ""))
})

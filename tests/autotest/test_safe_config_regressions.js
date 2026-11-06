// Configuration inspection must be safe even when runtime YAML permits evaluation.
loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

var __safeConfigFixture = function(text) {
	var dir = harness.tmpDir("safe-config")
	io.mkdir(dir + "/config/inputs")
	io.mkdir(dir + "/config/objects")
	io.mkdir(dir + "/config/objects.meta")
	io.writeFileString(dir + "/config/inputs/fixture.yaml", text)
	io.writeFileString(dir + "/config/objects/nInput_SafeFixture.js", "throw 'must not load'\n")
	io.writeFileString(dir + "/config/objects.meta/nInput_SafeFixture.yaml", af.toYAML({
		kind: "input", constructor: "nInput_SafeFixture", title: "Fixture", description: "Inspection fixture.", examples: [],
		arguments: [
			{ name: "number", type: "number", required: true, description: "Number.", example: 1 },
			{ name: "text", type: "string", description: "Text.", example: "x" },
			{ name: "query", type: "string", description: "Query.", example: "a", query: { ".": "jmespath" } }
		]
	}))
	var engine = new nConfigEngine({ home: dir, configPath: dir + "/config" })
	return { dir: dir, engine: engine, cfg: engine.load() }
}

ow.test.test("nConfigEngine::inert executable tags survive editing and leave global YAML settings unchanged", () => {
	var yamlFlags = stringify(__flags.YAML)
	global.__nceExecuted = false
	var text = "# retained exactly until edited\ninput:\n  name: tagged\n  execFrom: nInput_SafeFixture\n  timeInterval: !!js/eval 'global.__nceExecuted = true; 1000'\n  execArgs:\n    number: !!js/eval 'global.__nceExecuted = true; 7'\n    query: !!js/eval '\"a\"'\n    text: literal !!js/eval text\n"
	var f = __safeConfigFixture(text)
	try {
		ow.test.assert(global.__nceExecuted, false, "loading must not execute tags")
		ow.test.assert(f.engine.toYAML(f.cfg).files[0].content, text, "untouched files remain byte-for-byte")
		var v = f.engine.validate(f.cfg)
		ow.test.assert(v.valid, true, "unresolved values do not cause invented type errors")
		ow.test.assert(v.warnings.filter(d => d.code == "UNRESOLVED_EXPRESSION").length, 3, "every expression is diagnosed")
		ow.test.assert(v.stats.queriesChecked, 0, "unresolved query value cannot be checked")
		ow.test.assert(f.engine.validate(f.cfg, { mode: "strict" }).valid, false, "strict mode rejects unresolved expressions")
		f.engine.patch(f.cfg, "input:tagged", { description: "edited" })
		f.engine.save(f.cfg, __, { allowFormattingLoss: true })
		var again = f.engine.load()
		ow.test.assert(nConfigSchema.unresolved(again.files[0].parsed).length, 3, "tags remain executable-tagged YAML after editing")
		ow.test.assert(again.entries[0].descriptor.execArgs.number.value, "global.__nceExecuted = true; 7", "expression source survives")
		ow.test.assert(again.entries[0].descriptor.execArgs.text, "literal !!js/eval text", "ordinary strings are not mistaken for tags")
		var error = ""
		try { f.engine.toJSON(again) } catch(e) { error = String(e) }
		ow.test.assert(error.indexOf("unresolved YAML expressions") >= 0, true, "JSON conversion refuses to change expression semantics")
		ow.test.assert(global.__nceExecuted, false, "validation, save and conversion remain inert")
		ow.test.assert(stringify(__flags.YAML), yamlFlags, "global YAML options are unchanged")
	} finally { delete global.__nceExecuted }
})

ow.test.test("nConfigEngine::unresolved fields skip only dependent checks", () => {
	var f = __safeConfigFixture("input:\n  name: mixed\n  execFrom: nInput_SafeFixture\n  waitForFinish: invalid\n  execArgs:\n    number: !!js/eval '42'\n    text: 17\n    query: 'a[?'\n")
	var v = f.engine.validate(f.cfg)
	ow.test.assert(v.errors.filter(d => d.code == "MALFORMED_DESCRIPTOR").length, 1, "independent descriptor mistakes are still checked")
	ow.test.assert(v.errors.filter(d => d.code == "PARAMETER_TYPE").length, 1, "independent parameter types are still checked")
	ow.test.assert(v.errors.some(d => d.code == "INVALID_QUERY"), true, "independent queries are still checked")
	ow.test.assert(v.errors.some(d => d.code == "REQUIRED_PARAMETER"), false, "a required unresolved field is present")
	var all = __safeConfigFixture("input: !!js/eval '({ name: \"runtime\" })'\n")
	ow.test.assert(all.engine.validate(all.cfg).warnings[0].code, "UNRESOLVED_EXPRESSION", "a wholly dynamic descriptor is reported without false shape errors")
})

ow.test.test("nConfigEngine::metadata executable tags are rejected by engine and daemon", () => {
	var f = __safeConfigFixture("input:\n  name: x\n  exec: return {}\n")
	var meta = f.dir + "/config/objects.meta/bad.yaml"
	io.writeFileString(meta, "kind: input\nconstructor: nInput_Bad\ntitle: !!js/eval 'throw \"executed\"'\ndescription: Bad\narguments: []\n")
	ow.test.assert(f.engine.getMetadataIssues().some(i => i.indexOf("Executable YAML tags are not allowed") >= 0), true, "engine rejects executable metadata")
	var stub = { configPath: f.dir + "/config", validateObjectMeta: nAttrMon.prototype.validateObjectMeta, getObjectsMeta: nAttrMon.prototype.getObjectsMeta }
	nAttrMon.prototype.loadObjectsMeta.call(stub)
	ow.test.assert(stub.objectsMetaIssues.some(i => i.indexOf("Executable YAML tags are not allowed") >= 0), true, "daemon metadata follows the same inert parser")
})

ow.test.test("nConfigEngine::standalone load never reads daemon bootstrap configuration", () => {
	var f = __safeConfigFixture("input:\n  name: child\n  exec: return {}\n")
	var marker = f.dir + "/evaluated"
	io.writeFileString(f.dir + "/nattrmon.yaml", "LIBS: !!js/eval 'io.writeFileString(" + stringify(marker) + ", \"unsafe\")'\n")
	var script = f.dir + "/inspect.js"
	io.writeFileString(script, "var NATTRMON_HOME = " + stringify(NATTRMON_HOME) + ";\nvar NATTRMON_SUBHOME = " + stringify(f.dir) + ";\nloadLib(NATTRMON_HOME + '/lib/nconfigengine.js');\nvar e = new nConfigEngine({ home: " + stringify(f.dir) + " });\nif (isDef(global.nAttrMon) || !e.validate(e.load()).valid) exit(3);\nprint('inspection-ok');\n")
	var result = $sh(["openaf", "-f", script]).get(0)
	ow.test.assert(result.exitcode, 0, "standalone child succeeds: " + result.stderr)
	ow.test.assert(String(result.stdout).indexOf("inspection-ok") >= 0, true, "the child actually executed its assertions")
	ow.test.assert(io.fileExists(marker), false, "daemon bootstrap YAML was never evaluated")
})

ow.test.test("nInput_Channel::every HTTP route gets isolated authentication", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_Channel.js")
	var originalExpose = ow.ch.server.expose, originalNM = global.nattrmon
	var captured = [], channels = [], http = { session: true }
	try {
		ow.ch.server.expose = function(name, server, path, auth) { captured.push({ server: server, path: path, auth: auth }) }
		global.nattrmon = {
			getPrecompiledAuthFn: nAttrMon.prototype.getPrecompiledAuthFn,
			hasSessionData: function() { return true }, getSessionData: function() { return http }, ensureHttpSession: function() { return http }
		}
		var make = function(options) {
			var name = "safe-input-" + genUUID(); channels.push(name)
			return new nInput_Channel(merge({ ch: name, path: "/channel" }, options))
		}
		make({ local: { user: { p: "secret", m: "rw" } } })
		make({})
		make({ port: 8081, local: { other: { p: "second", m: "r" } } })
		make({ port: 8082, httpSession: "shared", custom: "return u == 'custom' && p == 'ok'" })
		ow.test.assert(captured.every(c => isFunction(c.auth)), true, "reused and new HTTP sessions always receive auth")
		var request = {}
		ow.test.assert(captured[0].auth("user", "secret", __, request), true, "reused session honors configured credentials")
		ow.test.assert(request.channelPermission, "rw", "configured permission survives")
		ow.test.assert(captured[1].auth("user", "secret", __, {}), false, "unconfigured instance cannot inherit another instance's permissions")
		ow.test.assert(captured[2].auth("user", "secret", __, {}), false, "a different configured instance cannot inherit credentials")
		ow.test.assert(captured[2].auth("other", "second", __, {}), true, "direct port uses its own permissions")
		ow.test.assert(captured[3].auth("custom", "ok", __, {}), true, "custom authentication survives explicit session reuse")
	} finally {
		ow.ch.server.expose = originalExpose
		global.nattrmon = originalNM
		channels.forEach(c => $ch(c).destroy())
	}
})


ow.test.test("nConfigEngine::explaining dynamic execArgs preserves the explanation contract", () => {
	var f = __safeConfigFixture("input:\n  name: dynamic\n  execFrom: nInput_SafeFixture\n  timeInterval: 1000\n  execArgs: !!js/eval '({ number: 1 })'\n")
	var result = f.engine.explainComponent(f.cfg, "input:dynamic")
	ow.test.assert(result.id, "input:dynamic", "dynamic arguments preserve the entry identity")
	ow.test.assert(result.type, "input", "explanations preserve their component kind")
	ow.test.assert(result.title, "Fixture", "available metadata remains part of the explanation")
	ow.test.assert(result.trigger.timeInterval, 1000, "known triggers remain explained")
	ow.test.assert(result.parameters, {}, "unknown parameter values are not invented")
	ow.test.assert(result.unresolved[0].path, "execArgs", "explanation identifies the unresolved argument map")
	ow.test.assert(isUnDef(result.hasMetadata) && isUnDef(result.queries), true, "internal validation fields never replace the public explanation")
})

ow.test.test("nConfigEngine::nested tagged query values preserve concrete sibling checks", () => {
	var f = __safeConfigFixture("input:\n  name: nested\n  execFrom: nInput_SafeFixture\n  execArgs:\n    objects:\n    - path: !!js/eval '\"a\"'\n    - path: 'a[?'\n    - path: a.b\n    - !!js/eval '({ path: \"a.b\" })'\n")
	io.writeFileString(f.dir + "/config/objects.meta/nInput_SafeFixture.yaml", af.toYAML({
		kind: "input", constructor: "nInput_SafeFixture", title: "Fixture", description: "Nested query fixture.", examples: [],
		arguments: [{ name: "objects", type: "array<object>", description: "Query rows.", example: [], query: { "[].path": "jmespath" } }]
	}))
	var result = f.engine.validate(f.cfg)
	ow.test.assert(result.stats.queriesChecked, 2, "only two concrete sibling paths are validated")
	ow.test.assert(result.errors.filter(d => d.code == "PARAMETER_TYPE").length, 0, "inert elements preserve the surrounding array shape")
	ow.test.assert(result.errors.some(d => d.code == "INVALID_QUERY" && d.path.indexOf("objects[1]") >= 0), true, "the concrete malformed sibling remains an error")
	ow.test.assert(result.warnings.filter(d => d.code == "UNRESOLVED_EXPRESSION").length, 2, "nested field and whole-row expressions are both diagnosed")
})

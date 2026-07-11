// Phase 5.7 -- #30: nInput_Shell.js's `res = res[0].result` threw a TypeError
// when every configured key's execution failed (caught and logged, leaving
// res empty) -- guarded to fall back to undefined instead. Also collapses
// the byte-identical parseJson/parseYaml if/else branches in the kube and
// ssh cases (dead branching -- both arms did exactly the same thing).

ow.test.test("nInput_Shell::input() does not throw when every key's connection fails", () => {
	harness.stubNattrmon({
		useObject: function(aKey, aFn) { throw "connection refused" }
	})
	load(NATTRMON_HOME + "/config/objects/nInput_Shell.js")

	$ch("test_shell_keys1").create(1, "simple")
	$ch("test_shell_keys1").set({ key: "host1" }, { key: "host1", type: "ssh" })

	var i = new nInput_Shell({ cmd: "uptime", chKeys: "test_shell_keys1" })
	var res
	try {
		res = i.input({}, {})
	} catch (e) {
		res = "THREW: " + e
	}

	ow.test.assert(isString(res), false, "input() must not throw when the only configured key fails")
	ow.test.assert(isUnDef(res["Shell/uptime"]), true, "the attribute should fall back to undefined, not a result from a nonexistent res[0]")

	$ch("test_shell_keys1").destroy()
})

ow.test.test("nInput_Shell::input() with a single successful key still returns its result", () => {
	harness.stubNattrmon({
		useObject: function(aKey, aFn) { aFn({ exec: function (c) { return "output-for-" + c } }) }
	})
	load(NATTRMON_HOME + "/config/objects/nInput_Shell.js")

	$ch("test_shell_keys2").create(1, "simple")
	$ch("test_shell_keys2").set({ key: "host1" }, { key: "host1", type: "ssh" })

	var i = new nInput_Shell({ cmd: "uptime", chKeys: "test_shell_keys2" })
	var res = i.input({}, {})

	ow.test.assert(res["Shell/uptime"], "output-for-uptime", "a single successful key should still surface its exec result")

	$ch("test_shell_keys2").destroy()
})

ow.test.test("nInput_Shell::no duplicate parseJson/parseYaml if/else branches remain", () => {
	var src = io.readFileString(NATTRMON_HOME + "/config/objects/nInput_Shell.js")
	ow.test.assert(/if \(parent\.parseJson \|\| parent\.parseYaml\)/.test(src), false, "the dead if/else in the kube case should be collapsed")
	ow.test.assert(/if \(this\.parseJson \|\| this\.parseYaml\)/.test(src), false, "the dead if/else in the ssh case should be collapsed")
})

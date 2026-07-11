// Phase 2 -- #4: core-objects loading must actually load each configured
// directory. Non-lazy branch used `split(",", callback)` (limit arg, callback
// never runs); lazy branch passed the whole comma-joined string to
// listFilesRecursive instead of each trimmed entry.

var __makeObjectDir = function(prefix, fileBody) {
	var d = harness.tmpDir(prefix)
	io.writeFileString(d + "/marker.js", fileBody)
	return d
}

ow.test.test("nmain::non-lazy core-objects loading loads every configured directory", () => {
	var dirA = __makeObjectDir("coA", "global.__coreObjLoadedA = true;\n")
	var dirB = __makeObjectDir("coB", "global.__coreObjLoadedB = true;\n")
	global.__coreObjLoadedA = false
	global.__coreObjLoadedB = false

	var nm = harness.newEngine({
		__NAM_COREOBJECTS: dirA + "," + dirB,
		__NAM_COREOBJECTS_LAZYLOADING: false
	}, { name: "coreobjnonlazy" })

	nm.loadPlugs()

	ow.test.assert(global.__coreObjLoadedA, true, "the first configured core-objects directory should have been loaded")
	ow.test.assert(global.__coreObjLoadedB, true, "the second configured core-objects directory should have been loaded")

	harness.stopEngine(nm)
})

ow.test.test("nmain::lazy core-objects loading indexes every configured directory", () => {
	var dirA = harness.tmpDir("coC")
	var dirB = harness.tmpDir("coD")
	io.writeFileString(dirA + "/pluginA.js", "// plug A\n")
	io.writeFileString(dirB + "/pluginB.js", "// plug B\n")

	var nm = harness.newEngine({
		__NAM_COREOBJECTS: dirA + "," + dirB,
		__NAM_COREOBJECTS_LAZYLOADING: true
	}, { name: "coreobjlazy" })

	nm.loadPlugs()

	ow.test.assert(isDef(nm.objectsPath["pluginA.js"]), true, "the first directory's file should be indexed for lazy loading")
	ow.test.assert(isDef(nm.objectsPath["pluginB.js"]), true, "the second directory's file should be indexed for lazy loading")

	harness.stopEngine(nm)
})

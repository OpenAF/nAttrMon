// nAttrMon hermetic test suite runner
// Copyright 2023 Nuno Aguiar
//
// Run: openaf tests/autoTestAll.js
// Exits 0 when every test passes, 1 otherwise. Requires no network access and
// no live nAttrMon server -- all state lives under tests/.tmp for the duration
// of the run and is removed afterwards.

var __selfPath = String(__scriptfile).replace(/\\/g, "/")
var NATTRMON_HOME = __selfPath.replace(/\/?tests\/autoTestAll\.js$/, "")
if (NATTRMON_HOME == __selfPath) NATTRMON_HOME = "."
if (!io.fileExists(NATTRMON_HOME + "/lib/nmain.js")) NATTRMON_HOME = "."

ow.loadTest()
ow.test.setShowStackTrace(true)

load(NATTRMON_HOME + "/tests/autotest/harness.js")

var testDir = NATTRMON_HOME + "/tests/autotest"
var testFiles = $from(listFilesRecursive(testDir))
	.equals("isFile", true)
	.match("filename", "^test_.*\\.js$")
	.sort("filepath")
	.select()

print("Running " + testFiles.length + " hermetic test file(s) from " + testDir + "...")

testFiles.forEach(f => {
	print("--- " + f.filename + " ---")
	try {
		load(f.filepath)
	} catch(e) {
		logErr("Error loading test file " + f.filename + ": " + __nam_err(e, false, true))
	}
})

print("")
print("Tests: " + ow.test.getCountTest() + " | Pass: " + ow.test.getCountPass() + " | Fail: " + ow.test.getCountFail())

try { io.rm(NATTRMON_HOME + "/tests/.tmp", true) } catch(e) {}

exit(ow.test.getCountFail() > 0 ? 1 : 0)

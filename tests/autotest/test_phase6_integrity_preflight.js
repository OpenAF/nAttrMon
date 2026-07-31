// Phase 6 -- integrity + preflight hardening:
// - integrity hashes can be configured for plug/object files
// - strict/warn switches affect load decisions
// - startup preflight mode wiring is present in nattrmon.js

ow.test.test("nattrmon startup script includes preflight mode wiring", () => {
	var src = io.readFileString(NATTRMON_HOME + "/nattrmon.js")
	ow.test.assert(src.indexOf("params.preflight") >= 0, true, "startup preflight parameter should be wired")
	ow.test.assert(src.indexOf("nattrmon.preflight()") >= 0, true, "startup should invoke nattrmon.preflight() when requested")
})

ow.test.test("nmain::checkPlugFileIntegrity obeys warn/strict semantics", () => {
	var nm = harness.newEngine({}, { name: "integrity-check" })

	var _oldIntegrity = clone(__NAM_INTEGRITY)
	var _oldWarn = __NAM_INTEGRITY_WARN
	var _oldStrict = __NAM_INTEGRITY_STRICT

	try {
		var dir = nm.__testDir + "/config/objects"
		io.mkdir(dir)
		var fp = dir + "/integrity_test.js"
		io.writeFileString(fp, "var integrity_test_value = 1;\n")
		var cp = io.fileInfo(fp).canonicalPath

		var _s = io.readFileStream(cp)
		var h = sha256(_s)
		_s.close()

		__NAM_INTEGRITY = {}
		__NAM_INTEGRITY[cp] = "sha256-" + h
		__NAM_INTEGRITY_WARN = true
		__NAM_INTEGRITY_STRICT = false
		ow.test.assert(nm.checkPlugFileIntegrity(cp), true, "matching hash should pass integrity check")

		__NAM_INTEGRITY[cp] = "sha256-deadbeef"
		ow.test.assert(nm.checkPlugFileIntegrity(cp), true, "warn mode should allow mismatch to continue")

		__NAM_INTEGRITY_WARN = false
		ow.test.assert(nm.checkPlugFileIntegrity(cp), false, "warn=false should fail on mismatch")

		__NAM_INTEGRITY = {}
		__NAM_INTEGRITY_STRICT = true
		ow.test.assert(nm.checkPlugFileIntegrity(cp), false, "strict mode should fail when integrity hash is missing")
	} finally {
		__NAM_INTEGRITY = _oldIntegrity
		__NAM_INTEGRITY_WARN = _oldWarn
		__NAM_INTEGRITY_STRICT = _oldStrict
		harness.stopEngine(nm)
	}
})

ow.test.test("nmain::preflight reports unresolved execFrom constructors", () => {
	var nm = harness.newEngine({ __NAM_NOPLUGFILES: false }, { name: "preflight-execfrom" })

	var idir = nm.__testDir + "/config/inputs"
	io.mkdir(idir)
	io.writeFileString(idir + "/preflight_bad.yaml", [
		"input:",
		"  name: preflight-bad",
		"  timeInterval: 0",
		"  execFrom: nInput_DoesNotExist"
	].join("\n"))

	var pf = nm.preflight()
	ow.test.assert(pf.ok, false, "preflight should fail when execFrom cannot be resolved")
	ow.test.assert(pf.totalIssues > 0, true, "preflight should report at least one issue")
	ow.test.assert($from(pf.issues).contains("constructor").any(), true, "issue list should mention constructor resolution")

	harness.stopEngine(nm)
})

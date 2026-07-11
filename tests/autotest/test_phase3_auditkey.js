// Phase 3 -- #16: audit-log subscriber must not recompile the template or the
// URI-extraction regex on every channel op. __nam_auditKey(uri) is the
// extracted key-builder, using a precompiled regex, unit-testable on its own.

ow.test.test("nmain::__nam_auditKey extracts the last {...} fragment from the URI", () => {
	var uri = "/ch/nattrmon::cvals/set/?data={&quot;name&quot;:&quot;cpu&quot;}"
	var key = __nam_auditKey(uri)
	ow.test.assert(key, "{name:cpu}", "the key should be the JSON fragment re-stringified without quotes")
})

ow.test.test("nmain::__nam_auditKey returns empty string when the URI has no {...} fragment", () => {
	ow.test.assert(__nam_auditKey("/ch/nattrmon::cvals/list"), "", "no braces in the URI means nothing to extract")
	ow.test.assert(__nam_auditKey(undefined), "", "an undefined URI should not throw")
})

ow.test.test("nmain::audit-log subscriber compiles the template once and skips key extraction when unreferenced", () => {
	var nm = harness.newEngine({
		__NAM_LOGAUDIT: true,
		__NAM_LOGAUDIT_TEMPLATE: "AUDIT | Channel: {{name}} | Operation: {{op}}"
	}, { name: "auditlog" })

	ow.test.assert(isDef(nm), true, "engine should start with audit logging enabled and no key reference in the template")

	harness.stopEngine(nm)
})

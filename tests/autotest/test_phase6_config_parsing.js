// Phase 6.2 -- normalize duplicated __NAM_* config parsing (lib/nmain.js:99-197,
// ~40 near-identical `if (isDef(pms.X)) __NAM_Y = <coercion>(pms.X)` lines) into a
// small set of typed parser helpers, without changing behavior. Each helper mirrors
// exactly one of the guard/coercion patterns that were duplicated inline; these tests
// pin that parity so the refactor can't silently change what a given pms shape resolves to.

ow.test.test("__nam_cfgBool mirrors 'isDef(pms.X) -> toBoolean(pms.X)' including its map-argument quirk", () => {
	ow.test.assert(__nam_cfgBool({ X: "true" }, "X", false), true)
	ow.test.assert(__nam_cfgBool({ X: "false" }, "X", true), false)
	ow.test.assert(__nam_cfgBool({ X: true }, "X", false), true)
	ow.test.assert(__nam_cfgBool({}, "X", "cur"), "cur", "undefined key must fall back to the current value, untouched")
	// Same latent quirk as the original inline code: a defined non-boolean-ish map is passed through toBoolean() as-is
	ow.test.assert(__nam_cfgBool({ X: { period: 10000 } }, "X", false), toBoolean({ period: 10000 }), "parity with toBoolean() on a map argument, not a behavior fix")
})

ow.test.test("__nam_cfgNum mirrors 'isDef(pms.X) -> Number(pms.X)' (coercing, incl. numeric strings)", () => {
	ow.test.assert(__nam_cfgNum({ X: "123" }, "X", 0), 123)
	ow.test.assert(__nam_cfgNum({ X: 456 }, "X", 0), 456)
	ow.test.assert(__nam_cfgNum({}, "X", 99), 99)
	ow.test.assert(isNaN(__nam_cfgNum({ X: "notanumber" }, "X", 0)), true, "parity with Number('notanumber') => NaN, same as the original inline coercion")
})

ow.test.test("__nam_cfgNumStrict mirrors 'isDef(pms.X) && isNumber(pms.X)' (OpenAF's isNumber also accepts numeric-looking strings, unlike a typeof check)", () => {
	ow.test.assert(__nam_cfgNumStrict({ X: 123 }, "X", 0), 123)
	ow.test.assert(__nam_cfgNumStrict({ X: "123" }, "X", 0), 123, "isNumber('123') is true in OpenAF, same as LOGHK_HOWLONGAGOINMINUTES today")
	ow.test.assert(__nam_cfgNumStrict({ X: "notanumber" }, "X", 42), 42, "a non-numeric string must still be rejected")
	ow.test.assert(__nam_cfgNumStrict({}, "X", 7), 7)
})

ow.test.test("__nam_cfgStr mirrors 'isString(pms.X)' guard with no coercion (e.g. CHANNEL_* / LIBS)", () => {
	ow.test.assert(__nam_cfgStr({ X: "abc" }, "X", "cur"), "abc")
	ow.test.assert(__nam_cfgStr({ X: 123 }, "X", "cur"), "cur", "a non-string value must be ignored, not coerced")
	ow.test.assert(__nam_cfgStr({}, "X", "cur"), "cur")
})

ow.test.test("__nam_cfgStrCoerce mirrors 'isDef(pms.X) -> String(pms.X)' (e.g. SEC_* / RUNTIME_*_CH)", () => {
	ow.test.assert(__nam_cfgStrCoerce({ X: 123 }, "X", "cur"), "123")
	ow.test.assert(__nam_cfgStrCoerce({ X: "abc" }, "X", "cur"), "abc")
	ow.test.assert(__nam_cfgStrCoerce({}, "X", "cur"), "cur")
})

ow.test.test("__nam_cfgArr mirrors 'isDef(pms.X) && isArray(pms.X)' (JAVA_ARGS)", () => {
	ow.test.assert(__nam_cfgArr({ X: ["-Xmx1g"] }, "X", []), ["-Xmx1g"])
	ow.test.assert(__nam_cfgArr({ X: "not-an-array" }, "X", ["cur"]), ["cur"], "a non-array value must be ignored")
	ow.test.assert(__nam_cfgArr({}, "X", ["cur"]), ["cur"])
})

ow.test.test("__nam_cfgAny mirrors bare 'isDef(pms.X)' passthrough (COREOBJECTS / CH_PERSISTENCE_PATH)", () => {
	ow.test.assert(__nam_cfgAny({ X: "some/path" }, "X", __), "some/path")
	ow.test.assert(__nam_cfgAny({ X: { a: 1 } }, "X", __).a, 1, "any defined value, including a map, passes through untouched")
	ow.test.assert(__nam_cfgAny({}, "X", "cur"), "cur")
})

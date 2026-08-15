// Phase 8 -- query parsing, round trips and validation diagnostics
//
// Parsing reuses OpenAF's own nLinq grammar (af.fromNLinq) rather than a hand-written parser.
// The text DSL is narrower than the AST, so the two round trips are asserted separately: the
// coverage gap is deliberate and visible, not accidental.

loadLib(NATTRMON_HOME + "/lib/nquery.js")

var __rt_data = [
	{ n: "b", t: "db",  v: 15 },
	{ n: "a", t: "db",  v: 5  },
	{ n: "c", t: "web", v: 20 }
]

ow.test.test("nQuery.parse::text -> model -> compile preserves semantics", () => {
	var _src = "equals('t','db').andGreater('v',10).sort('-v')"
	var q = nQuery.parse(_src)

	ow.test.assert(isDef(q.toAST), true, "a supported expression parses into a builder")
	ow.test.assert(q.compile().text, _src, "and recompiles to the same text")

	var _direct = $from(__rt_data).equals("t", "db").andGreater("v", 10).sort("-v").select()
	ow.test.assert(stringify(q.test(__rt_data).result, __, ""), stringify(_direct, __, ""), "semantics are preserved through the round trip")
})

ow.test.test("nQuery.parse::builder -> AST -> builder round-trips the full operator set", () => {
	var _built = nQuery.from()
		.equals("t", "db")
		.andBegin().greater("v", 10).orEquals("n", "a").end()
		.sort("-v").limit(5)
		.select([ "n", "v" ])

	var _reparsed = nQuery.parse(_built.toAST())
	ow.test.assert(isDef(_reparsed.toAST), true, "an AST map parses back into a builder")
	ow.test.assert(stringify(_reparsed.toAST(), __, ""), stringify(_built.toAST(), __, ""), "the AST survives unchanged")
	ow.test.assert(stringify(_reparsed.test(__rt_data).result, __, ""), stringify(_built.test(__rt_data).result, __, ""), "and so do the results")
})

ow.test.test("nQuery.compile::reports when the text DSL can't express a query", () => {
	// The nLinq text grammar has no syntax for array arguments, so select(['n','v']) has no
	// text form even though the AST represents it exactly.
	var q = nQuery.from().equals("t", "db").select([ "n", "v" ])
	var c = q.compile()

	ow.test.assert(isUnDef(c.text), true, "no text is emitted for an inexpressible query")
	ow.test.assert(c.textUnavailable, "UNSUPPORTED_IN_TEXT_DSL", "and the reason is reported")
	ow.test.assert(isDef(c.ast.select), true, "while the AST -- the lossless form -- still carries it")

	var _plain = nQuery.from().equals("t", "db").sort("v").compile()
	ow.test.assert(_plain.text, "equals('t','db').sort('v')", "expressible queries still get text")
})

ow.test.test("nQuery.parse::never destroys an expression it can't model", () => {
	var _js = "$from(d).where(r => r.v > f(r))"
	var r = nQuery.parse(_js)
	ow.test.assert(r.mode, "raw", "JavaScript query source falls back to raw")
	ow.test.assert(r.editable, false, "and is marked as not structurally editable")
	ow.test.assert(r.reason, "UNSUPPORTED_QUERY_EXPRESSION", "with a reason code")
	ow.test.assert(r.expression, _js, "and the original expression is preserved verbatim")

	ow.test.assert(nQuery.parse("equals('t'").mode, "raw", "a syntactically broken expression also falls back")
	ow.test.assert(nQuery.parse("r => r.x").mode, "raw", "a bare arrow function falls back")
})

ow.test.test("nQuery.parse::accepts both the parser's and the builder's zero-argument form", () => {
	// af.fromNLinq emits args:[""] for zero-argument operators; the builder emits [].
	var _parsed = nQuery.parse("equals('t','db').andBegin().greater('v',10).end()")
	ow.test.assert(isDef(_parsed.toAST), true, "the parsed grouping is accepted")
	ow.test.assert(_parsed.validate().valid, true, "args:[''] validates the same as args:[]")

	ow.test.assert(nQuery.validateAST({ where: [ { cond: "begin", args: [ "" ] }, { cond: "equals", args: [ "t", "db" ] }, { cond: "end", args: [ "" ] } ] }).valid, true, "both forms validate")
})

ow.test.test("nQuery.validateAST::detects unsupported and malformed operators", () => {
	var _unknown = nQuery.validateAST({ where: [ { cond: "nope", args: [ "a" ] } ] })
	ow.test.assert(_unknown.valid, false, "an unknown operator is rejected")
	ow.test.assert(_unknown.errors[0].code, "INVALID_QUERY", "with an INVALID_QUERY code")

	var _fn = nQuery.validateAST({ where: [ { cond: "where", args: [ "r => true" ] } ] })
	ow.test.assert(_fn.valid, false, "function-taking operators are rejected")

	ow.test.assert(nQuery.validateAST({ where: "nope" }).valid, false, "a non-array where is rejected")
	ow.test.assert(nQuery.validateAST({ where: [ { args: [] } ] }).valid, false, "a condition without cond is rejected")
	ow.test.assert(nQuery.validateAST("nope").valid, false, "a non-map AST is rejected")
})

ow.test.test("nQuery.validateAST::detects invalid nesting and sort definitions", () => {
	var _open = nQuery.validateAST({ where: [ { cond: "begin", args: [] }, { cond: "equals", args: [ "a", 1 ] } ] })
	ow.test.assert(_open.valid, false, "an unclosed group is rejected")
	ow.test.assert(_open.errors[0].message.indexOf("never closed") > 0, true, "and says the group was never closed")

	var _close = nQuery.validateAST({ where: [ { cond: "equals", args: [ "a", 1 ] }, { cond: "end", args: [] } ] })
	ow.test.assert(_close.valid, false, "closing a group that was never opened is rejected")

	ow.test.assert(nQuery.validateAST({ transform: [ { func: "sort", args: [ 1 ] } ] }).valid, false, "a non-string sort field is rejected")
	ow.test.assert(nQuery.validateAST({ transform: [ { func: "limit", args: [ "two" ] } ] }).valid, false, "a non-numeric limit is rejected")
	ow.test.assert(nQuery.validateAST({ selector: { func: "nope" } }).valid, false, "an unknown selector is rejected")
})

ow.test.test("nQuery.exec::never evaluates caller code unless explicitly allowed", () => {
	var _refused = nQuery.exec(__rt_data, { select: "return elem.n" })
	ow.test.assert(_refused.success, false, "a JavaScript select is refused by default")
	ow.test.assert(_refused.error.code, "FUNCTION_SELECT_NOT_ALLOWED", "with an explicit code")

	var _allowed = nQuery.exec(__rt_data, { select: "return elem.n" }, { allowFunctions: true })
	ow.test.assert(_allowed.success, true, "and evaluated only on request")
	ow.test.assert(stringify(_allowed.result, __, ""), stringify([ "b", "a", "c" ], __, ""), "producing the expected result")
})

ow.test.test("nQuery.exec::reports execution problems as structured errors", () => {
	var _invalid = nQuery.exec(__rt_data, { where: [ { cond: "nope", args: [] } ] })
	ow.test.assert(_invalid.success, false, "an invalid query isn't executed")
	ow.test.assert(_invalid.error.code, "INVALID_QUERY", "and reports why")

	var _badData = nQuery.exec("not data", {})
	ow.test.assert(_badData.success, false, "unusable sample data fails cleanly")
	ow.test.assert(_badData.error.code, "QUERY_EXECUTION_ERROR", "with an execution error code")
})

ow.test.test("nQuery.exec::accepts a map of sample data", () => {
	var r = nQuery.exec({ one: { v: 1 }, two: { v: 2 } }, { where: [ { cond: "greater", args: [ "v", 1 ] } ] })
	ow.test.assert(r.success, true, "a map is converted to an array")
	ow.test.assert(r.result.length, 1, "and queried normally")
	ow.test.assert(r.result[0]._key, "two", "keeping the map key as _key")
})

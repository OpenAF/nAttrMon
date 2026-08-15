// Phase 8 -- nLinq ($from) query builder
// The builder's structured representation is OpenAF's own nLinq AST, so every assertion here is
// checked against what the equivalent fluent $from() chain actually returns.

loadLib(NATTRMON_HOME + "/lib/nquery.js")

var __q_data = [
	{ n: "b", t: "db",  v: 15 },
	{ n: "a", t: "db",  v: 5  },
	{ n: "c", t: "web", v: 20 },
	{ n: "d", t: "web", v: 1  }
]

ow.test.test("nQuery::builds the nLinq AST shape consumers already execute", () => {
	var q = nQuery.from().equals("t", "db").sort("-v")

	ow.test.assert(q.toAST().where[0].cond, "equals", "conditions land in where[]")
	ow.test.assert(q.toAST().where[0].args[0], "t", "condition arguments are preserved")
	ow.test.assert(q.toAST().transform[0].func, "sort", "sort lands in transform[]")
	ow.test.assert(q.compile().dialect, "nlinq", "compile reports the nlinq dialect")
})

ow.test.test("nQuery::operators are derived from the running OpenAF", () => {
	var ops = nQuery.operators()
	ow.test.assert(ops.names.length > 50, true, "the registry should be populated from $from()")
	ow.test.assert(ops.slots.equals, "where", "predicates belong to where")
	ow.test.assert(ops.slots.sort, "transform", "sort belongs to transform")
	ow.test.assert(ops.slots.count, "selector", "terminals belong to selector")
	ow.test.assert(ops.slots.select, "select", "select has its own slot")
	ow.test.assert(isUnDef(ops.slots.where), true, "function-taking operators are not exposed")
})

ow.test.test("nQuery::each comparison operator matches the equivalent $from() chain", () => {
	var cases = [
		[ "equals",        [ "t", "db" ],   $from(__q_data).equals("t", "db").select() ],
		[ "notEquals",     [ "t", "db" ],   $from(__q_data).notEquals("t", "db").select() ],
		[ "greater",       [ "v", 10 ],     $from(__q_data).greater("v", 10).select() ],
		[ "greaterEquals", [ "v", 15 ],     $from(__q_data).greaterEquals("v", 15).select() ],
		[ "less",          [ "v", 10 ],     $from(__q_data).less("v", 10).select() ],
		[ "lessEquals",    [ "v", 5 ],      $from(__q_data).lessEquals("v", 5).select() ],
		[ "contains",      [ "n", "a" ],    $from(__q_data).contains("n", "a").select() ],
		[ "starts",        [ "t", "d" ],    $from(__q_data).starts("t", "d").select() ],
		[ "ends",          [ "t", "b" ],    $from(__q_data).ends("t", "b").select() ],
		[ "match",         [ "n", "^[ab]$" ], $from(__q_data).match("n", "^[ab]$").select() ],
		[ "between",       [ "v", 2, 16 ],  $from(__q_data).between("v", 2, 16).select() ],
		[ "notEmpty",      [ "n" ],         $from(__q_data).notEmpty("n").select() ]
	]

	cases.forEach(c => {
		var q = nQuery.from()
		q[c[0]].apply(q, c[1])
		var r = q.test(__q_data)
		ow.test.assert(r.success, true, c[0] + " should execute")
		ow.test.assert(stringify(r.result, __, ""), stringify(c[2], __, ""), c[0] + " should match the fluent $from() result")
	})
})

ow.test.test("nQuery::AND and OR combine the same way $from() does", () => {
	var _and = nQuery.from().equals("t", "db").andGreater("v", 10).test(__q_data)
	ow.test.assert(stringify(_and.result, __, ""), stringify($from(__q_data).equals("t", "db").andGreater("v", 10).select(), __, ""), "AND should match")

	var _or = nQuery.from().equals("t", "web").orEquals("n", "a").test(__q_data)
	ow.test.assert(stringify(_or.result, __, ""), stringify($from(__q_data).equals("t", "web").orEquals("n", "a").select(), __, ""), "OR should match")
})

ow.test.test("nQuery::nested boolean groups survive into the AST and execute correctly", () => {
	// nLinq applies where[] through a flat dispatch loop, but begin/end are ordinary chain
	// methods -- so nesting is expressible in the AST, not only in the fluent form.
	var q = nQuery.from().equals("t", "db").andBegin().greater("v", 10).orEquals("n", "a").end()

	ow.test.assert(q.toAST().where.length, 5, "grouping operators are ordinary where[] entries")
	ow.test.assert(q.toAST().where[1].cond, "andBegin", "the group opener is kept")
	ow.test.assert(q.toAST().where[4].cond, "end", "the group closer is kept")

	var _expected = $from(__q_data).equals("t", "db").andBegin().greater("v", 10).orEquals("n", "a").end().select()
	ow.test.assert(stringify(q.test(__q_data).result, __, ""), stringify(_expected, __, ""), "the grouped query should match the fluent result")

	// ...and the same AST rebuilt by hand behaves identically
	var _manual = nQuery.exec(__q_data, {
		where: [
			{ cond: "equals",   args: [ "t", "db" ] },
			{ cond: "andBegin", args: [] },
			{ cond: "greater",  args: [ "v", 10 ] },
			{ cond: "orEquals", args: [ "n", "a" ] },
			{ cond: "end",      args: [] }
		]
	})
	ow.test.assert(stringify(_manual.result, __, ""), stringify(_expected, __, ""), "a hand-built AST should behave identically")
})

ow.test.test("nQuery::sort ascending, descending and multi-field", () => {
	ow.test.assert(stringify(nQuery.from().sort("v").test(__q_data).result.map(r => r.n), __, ""), stringify([ "d", "a", "b", "c" ], __, ""), "ascending sort")
	ow.test.assert(stringify(nQuery.from().sort("-v").test(__q_data).result.map(r => r.n), __, ""), stringify([ "c", "b", "a", "d" ], __, ""), "'-field' sorts descending")
	ow.test.assert(stringify(nQuery.from().sort("t", "-v").test(__q_data).result.map(r => r.n), __, ""), stringify($from(__q_data).sort("t", "-v").select().map(r => r.n), __, ""), "multi-field sort")
})

ow.test.test("nQuery::limit and skip", () => {
	ow.test.assert(nQuery.from().sort("v").limit(2).test(__q_data).result.length, 2, "limit bounds the result")
	ow.test.assert(nQuery.from().sort("v").skip(2).test(__q_data).result.length, 2, "skip drops leading rows")
	ow.test.assert(nQuery.from().sort("v").skip(1).limit(2).test(__q_data).result[0].n, "a", "skip and limit compose")
})

ow.test.test("nQuery::select in each of its forms", () => {
	ow.test.assert(stringify(nQuery.from().equals("t", "db").select().test(__q_data).result, __, ""), stringify($from(__q_data).equals("t", "db").select(), __, ""), "select() returns whole rows")

	var _arr = nQuery.from().sort("n").select([ "n", "v" ]).test(__q_data)
	ow.test.assert(Object.keys(_arr.result[0]).sort().join(","), "n,v", "array select projects the named fields")

	var _map = nQuery.from().sort("n").select({ n: "n/a", missing: "fallback" }).test(__q_data)
	ow.test.assert(_map.result[0].missing, "fallback", "map select supplies defaults for absent fields")
})

ow.test.test("nQuery::terminal operators", () => {
	ow.test.assert(nQuery.from().equals("t", "db").count().test(__q_data).result.count, 2, "count")
	ow.test.assert(stringify(nQuery.from().distinct("t").test(__q_data).result.distinct, __, ""), stringify($from(__q_data).distinct("t"), __, ""), "distinct")
	ow.test.assert(nQuery.from().sum("v").test(__q_data).result.sum, 41, "sum")
	ow.test.assert(nQuery.from().max("v").test(__q_data).result.max.n, "c", "max")
	ow.test.assert(nQuery.from().min("v").test(__q_data).result.min.n, "d", "min")
	ow.test.assert(Object.keys(nQuery.from().groupBy("t").test(__q_data).result.groupBy).sort().join(","), "db,web", "groupBy")
})

ow.test.test("nQuery::test() reproduces the date columns nattrmon.filter adds", () => {
	var _dated = [ { n: "x", lastdate: new Date(now() - 60000).toISOString() } ]

	var _plain = nQuery.from().test(_dated, { via: "ow.obj.filter" })
	ow.test.assert(isUnDef(_plain.result[0].lastdate_ms), true, "ow.obj.filter doesn't attach age columns")

	var _nam = nQuery.from().test(_dated, { via: "nattrmon.filter" })
	ow.test.assert(isNumber(_nam.result[0].lastdate_ms), true, "nattrmon.filter attaches <key>_ms age columns")
})

ow.test.test("nQuery::builders are independent of each other", () => {
	var a = nQuery.from().equals("t", "db")
	var b = a.clone().andGreater("v", 10)
	ow.test.assert(a.toAST().where.length, 1, "the original builder is unchanged by the clone")
	ow.test.assert(b.toAST().where.length, 2, "the clone carries its own conditions")
})

// Phase 8 -- $path (JMESPath) and dot-path builders
// nAttrMon plugs use both, and a 'path' execArg means different things in different plugs, so
// the two dialects are kept separate.

loadLib(NATTRMON_HOME + "/lib/nquery.js")

var __p_data = {
	services: [
		{ name: "a", status: "up",   port: 80  },
		{ name: "b", status: "down", port: 443 },
		{ name: "c", status: "up",   port: 8080 }
	],
	hits: { hits: [ { _source: { value: 42 } } ] }
}

ow.test.test("nQuery.path::builds field, index and wildcard expressions", () => {
	ow.test.assert(nQuery.path().field("services").compile(), "services", "single field")
	ow.test.assert(nQuery.path().field("services").index(0).field("name").compile(), "services[0].name", "index then field")
	ow.test.assert(nQuery.path().field("services").all().field("name").compile(), "services[*].name", "wildcard projection")
	ow.test.assert(nQuery.path().field("services").flatten().compile(), "services[]", "flatten projection")
})

ow.test.test("nQuery.path::builds filter projections", () => {
	var p = nQuery.path().field("services").filter("status == 'up'").field("name")
	ow.test.assert(p.compile(), "services[?status == 'up'].name", "filter projection")

	var r = p.test(__p_data)
	ow.test.assert(r.success, true, "the filter should execute")
	ow.test.assert(stringify(r.result, __, ""), stringify([ "a", "c" ], __, ""), "only matching services are returned")
	ow.test.assert(stringify(r.result, __, ""), stringify($path(__p_data, p.compile()), __, ""), "and it should match $path directly")
})

ow.test.test("nQuery.path::builds multi-select hashes and slices", () => {
	var p = nQuery.path().field("services").all().select({ n: "name", s: "status" })
	ow.test.assert(p.compile(), "services[*].{n: name, s: status}", "multi-select hash")
	ow.test.assert(p.test(__p_data).result[0].n, "a", "the hash renames fields")

	ow.test.assert(nQuery.path().field("services").slice(0, 2).compile(), "services[0:2]", "slice")
	ow.test.assert(nQuery.path().field("services").slice(0, 2).test(__p_data).result.length, 2, "the slice bounds the result")
})

ow.test.test("nQuery.path::wraps expressions in JMESPath functions", () => {
	var p = nQuery.path().field("services").fn("length")
	ow.test.assert(p.compile(), "length(services)", "function wrapping")
	ow.test.assert(p.test(__p_data).result, 3, "length() counts the services")
})

ow.test.test("nQuery.path::validates without executing", () => {
	ow.test.assert(nQuery.path("services[*].name").validate().valid, true, "a valid expression passes")

	var bad = nQuery.validatePath("services[?status ==", "jmespath")
	ow.test.assert(bad.valid, false, "a malformed expression fails")
	ow.test.assert(bad.errors[0].code, "INVALID_QUERY", "and is reported as INVALID_QUERY")

	ow.test.assert(nQuery.validatePath("", "jmespath").valid, false, "an empty expression fails")
})

ow.test.test("nQuery.path::parses the safely rebuildable subset and preserves the rest", () => {
	var _simple = nQuery.parsePath("services[*].name", "jmespath")
	ow.test.assert(_simple.editable, true, "a simple projection is structurally editable")
	ow.test.assert(stringify(_simple.parts.map(p => p.op), __, ""), stringify([ "field", "all", "field" ], __, ""), "and is decomposed into parts")

	var _complex = nQuery.parsePath("sort_by(services, &port)[0].name", "jmespath")
	ow.test.assert(_complex.editable, false, "a complex expression isn't structurally editable")
	ow.test.assert(_complex.reason, "UNSUPPORTED_QUERY_EXPRESSION", "and says why")
	ow.test.assert(_complex.parts[0].value, "sort_by(services, &port)[0].name", "but the expression itself is never lost")
})

ow.test.test("nQuery.dotPath::is not JMESPath", () => {
	// nInput_HTTPJson and nInput_ESSearch resolve 'path' with ow.obj.getPath/$$().get, which
	// support only field access and numeric indexes.
	ow.test.assert(nQuery.dotPath().field("hits").field("hits").index(0).field("_source").compile(), "hits.hits[0]._source", "dot-path compiles")

	var r = nQuery.dotPath("hits.hits[0]._source.value").test(__p_data)
	ow.test.assert(r.success, true, "the dot-path should execute")
	ow.test.assert(r.result, 42, "and resolve the value")

	ow.test.assert(nQuery.validatePath("services[?status == 'up']", "dotpath").valid, false, "JMESPath syntax is rejected as a dot-path")
	ow.test.assert(nQuery.validatePath("a.b[0].c", "dotpath").valid, true, "field access and indexes are accepted")
})

ow.test.test("nQuery.dotPath::round-trips through parsePath", () => {
	var _p = nQuery.parsePath("a.b[0].c", "dotpath")
	ow.test.assert(_p.editable, true, "a dot-path is structurally editable")

	var _rebuilt = nQuery.dotPath("a.b[0].c")
	ow.test.assert(_rebuilt.compile(), "a.b[0].c", "parse then compile preserves the expression")
})

ow.test.test("nQuery.execPath::reports errors instead of throwing", () => {
	var r = nQuery.execPath(__p_data, "services[?status ==", "jmespath")
	ow.test.assert(r.success, false, "a malformed expression fails cleanly")
	ow.test.assert(r.error.code, "INVALID_QUERY", "with a structured error code")
})

// Phase 5.8 -- #31: nInput_ESSearch.js's per-key tagging was dead code: `var
// res = { key: keyData }` was immediately shadowed by `var res =
// this.es.search(...)` (the second `var res` reassigns the same variable),
// so chKeys users never got the documented "key" field in their results.
// Restored: the key is merged in AFTER the search (and after any `path`
// extraction), using keyData.key (not the whole keyData map).

var __hasElasticSearchOpack = isDef(getOPackPath("ElasticSearch"))

var __requireElasticSearchOpack = function() {
	if (__hasElasticSearchOpack) return true
	ow.test.assert(true, true, "Skipping: ElasticSearch opack not installed")
	return false
}

ow.test.test("nInput_ESSearch::get() tags the result with the key when chKeys provides one", () => {
	if (!__requireElasticSearchOpack()) return
	load(NATTRMON_HOME + "/config/objects/nInput_ESSearch.js")

	var i = new nInput_ESSearch({ url: "http://localhost:1/fake", index: "test-index", search: { query: { match_all: {} } } })
	i.es.search = function (index, search) { return { hits: { total: 1, hits: [ { a: 1 } ] } } }

	var r = i.get({ key: "k1" }, {})
	ow.test.assert(r.key, "k1", "the result should be tagged with the key from keyData")
	ow.test.assert(isDef(r.hits), true, "the search result itself should still be present")
})

ow.test.test("nInput_ESSearch::get() does not add a key field when keyData has none", () => {
	if (!__requireElasticSearchOpack()) return
	load(NATTRMON_HOME + "/config/objects/nInput_ESSearch.js")

	var i = new nInput_ESSearch({ url: "http://localhost:1/fake", index: "test-index", search: { query: { match_all: {} } } })
	i.es.search = function (index, search) { return { hits: { total: 1, hits: [] } } }

	var r = i.get({}, {})
	ow.test.assert(isDef(r.key), false, "no key field should be added without a keyData.key")
})

ow.test.test("nInput_ESSearch::get() applies path extraction and still tags the key", () => {
	if (!__requireElasticSearchOpack()) return
	load(NATTRMON_HOME + "/config/objects/nInput_ESSearch.js")

	var i = new nInput_ESSearch({ url: "http://localhost:1/fake", index: "test-index", search: { query: { match_all: {} } }, path: "hits.total" })
	i.es.search = function (index, search) { return { hits: { total: 42, hits: [] } } }

	var r = i.get({ key: "k2" }, {})
	ow.test.assert(r.key, "k2", "the key should still be tagged after path extraction")
})

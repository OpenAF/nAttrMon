# Query builder

`lib/nquery.js` builds the query expressions nAttrMon and OpenAF already use, from a structured model rather than by concatenating strings. It is deterministic, works offline, and has no dependency on the configuration engine or on a running nAttrMon — load it on its own:

```javascript
loadLib(NATTRMON_HOME + "/lib/nquery.js")
```

It deliberately invents no query language. Three dialects are supported, and they are the three that nAttrMon plugs actually execute.

| Dialect | Language | Executed by |
|---|---|---|
| `nlinq` | nLinq query map (AST) | `ow.obj.filter`, `nattrmon.filter`, `$from().query()` |
| `nlinqText` | nLinq text DSL string | `af.fromNLinq` then `ow.obj.filter` |
| `jmespath` | JMESPath string | `$path` |
| `dotpath` | simple dot-path string | `ow.obj.getPath`, `$$().get` |

## The nLinq model

The structured representation is OpenAF's own nLinq AST — the same shape `af.fromNLinq()` produces, that `$from().query()` and `ow.obj.filter()` execute, and that nAttrMon configurations already store under keys like `filter:` and `selector:` (see `config/inputs.disabled/yaml/20.chvals.yaml`):

```javascript
{
  where    : [ { cond: "equals", args: [ "type", "database" ] } ],
  transform: [ { func: "sort",   args: [ "-value" ] } ],
  select   : ...,               // map, array, or JavaScript source string
  selector : { func: "count", args: [] }
}
```

Because it is a model and not a string, a Configurator UI or an LLM can manipulate it directly.

## Building a `$from` query

```javascript
var q = nQuery.from()
    .equals("type", "database")
    .andBegin()
        .greater("value", 10)
        .orEquals("name", "primary")
    .end()
    .sort("-value")
    .limit(10)
    .select([ "name", "value" ])

q.toAST()     // the lossless structured form
q.compile()   // { dialect: "nlinq", ast: {...}, text: "..." }
q.validate()  // { valid, errors, warnings, info }
q.test(data)  // { success: true, result: [...] }
```

Every operator the installed OpenAF exposes on `$from()` is available — the registry is read from `$from([])` at load time rather than hard-coded, so it tracks the running OpenAF. `nQuery.operators()` returns it.

Operators fall into four slots, matching what the nLinq grammar produces:

- **`where`** — `equals`, `notEquals`, `greater`, `greaterEquals`, `less`, `lessEquals`, `contains`, `notContains`, `starts`, `ends`, `match`, `between`, `betweenEquals`, `empty`, `notEmpty`, `is`, `type`, each with `and…`, `or…` and `…Not…` variants, plus the grouping operators `begin`, `end`, `andBegin`, `orBegin`, `and`, `or`, `not`.
- **`transform`** — `sort`, `limit`, `skip`, `take`, `skipTake`, `head`, `tail`, `ignoreCase`, `toDate`, `detach`, `attachBy`, `join`, `union`, `intersect`, `except`, `cartesian`.
- **`selector`** — `count`, `distinct`, `first`, `last`, `at`, `min`, `max`, `sum`, `average`, `group`, `groupBy`, `countBy`, `any`, `all`, `none`, `reverse`.
- **`select`** — `select`, `mselect`.

Two conventions worth knowing: `sort("-field")` sorts descending, and string comparisons are case-insensitive unless you add `.ignoreCase(false)`.

### Nested boolean groups

`begin`/`end` are ordinary chain operators, so nesting is expressible in the model, not only in a fluent chain:

```javascript
nQuery.from().equals("t", "db").andBegin().greater("v", 10).orEquals("n", "a").end()
// where: [ {cond:"equals",…}, {cond:"andBegin",args:[]}, {cond:"greater",…},
//          {cond:"orEquals",…}, {cond:"end",args:[]} ]
```

### Operators that are deliberately absent

Operators taking a function or arbitrary source — `where(fn)`, `filter`, `each`, `attach`, `define`, `removed`, `takeWhile`, `stream`, and the `…By` aggregations — are not exposed and are rejected by `validate()`. They cannot be represented in a serializable model, and executing them would mean running caller-supplied code.

Relatedly, `test()` refuses a JavaScript-source `select` unless you opt in:

```javascript
nQuery.exec(data, { select: "return elem.n" })
// { success: false, error: { code: "FUNCTION_SELECT_NOT_ALLOWED", … } }
nQuery.exec(data, { select: "return elem.n" }, { allowFunctions: true })
// { success: true, result: [...] }
```

## Parsing existing queries

`nQuery.parse()` accepts an AST map or nLinq text, using OpenAF's own grammar (`af.fromNLinq`) rather than a hand-written parser:

```javascript
nQuery.parse("equals('t','db').andGreater('v',10).sort('-v')")   // -> builder
nQuery.parse({ where: [ { cond: "equals", args: [ "t", "db" ] } ] })   // -> builder
```

Anything outside that subset — JavaScript source, a lambda, a syntax error — is **preserved, never discarded**:

```javascript
nQuery.parse("$from(d).where(r => r.v > f(r))")
// { mode: "raw", editable: false,
//   reason: "UNSUPPORTED_QUERY_EXPRESSION",
//   expression: "$from(d).where(r => r.v > f(r))" }
```

Queries embedded inside a configuration's `exec:` JavaScript block are out of scope by design: the builder never parses JavaScript source. `exec:` is carried through as an opaque string.

### `compile().text` is best-effort

`toAST()` is the lossless output. The text DSL is narrower than the model — it has no syntax for array or map arguments — so `compile()` reports when it cannot produce text instead of emitting something that would not parse back:

```javascript
nQuery.from().equals("t", "db").select([ "n", "v" ]).compile()
// { dialect: "nlinq", ast: {...}, textUnavailable: "UNSUPPORTED_IN_TEXT_DSL" }
```

## Testing against sample data

`test()` never needs production data:

```javascript
var q = nQuery.from().equals("t", "db").sort("-v")
q.test([ { n: "a", t: "db", v: 5 }, { n: "b", t: "db", v: 15 } ])
// { success: true, result: [ { n: "b", … }, { n: "a", … } ] }
```

Pass `via:` so a preview matches the plug that will run it. `nattrmon.filter` (used for `filter:` execArgs) attaches `<key>_ms` age columns for date-like keys; `ow.obj.filter` (used for `selector:`) does not:

```javascript
q.test(sample, { via: "nattrmon.filter" })   // adds lastdate_ms
q.test(sample, { via: "ow.obj.filter" })     // default, no age columns
```

Failures come back as data rather than exceptions:

```javascript
// { success: false, error: { code: "QUERY_EXECUTION_ERROR", message: "..." } }
```

## `$path` and dot-path

`$path()` is full JMESPath. `ow.obj.getPath()`/`$$().get()` support only field access and numeric indexes. They are different languages, so they get different builders — and a `path:` execArg means one or the other depending on the plug (see `docs/OBJECTS-METADATA.md`).

```javascript
nQuery.path().field("services").filter("status == 'up'").field("name").compile()
// "services[?status == 'up'].name"

nQuery.path().field("services").all().select({ n: "name", s: "status" }).compile()
// "services[*].{n: name, s: status}"

nQuery.path().field("services").index(0).compile()      // "services[0]"
nQuery.path().field("services").slice(0, 2).compile()   // "services[0:2]"
nQuery.path().field("services").flatten().compile()     // "services[]"
nQuery.path().field("services").fn("length").compile()  // "length(services)"

nQuery.dotPath().field("hits").index(0).field("_source").compile()
// "hits[0]._source"
```

`validate()` compiles the expression with the JMESPath parser without evaluating it:

```javascript
nQuery.validatePath("services[?status ==", "jmespath")
// { valid: false, errors: [ { code: "INVALID_QUERY", … } ] }
```

`parsePath()` decomposes the safely rebuildable subset — dotted chains, indexes, `[*]`, `[]` — and preserves everything else verbatim:

```javascript
nQuery.parsePath("services[*].name", "jmespath")
// { dialect: "jmespath", parts: [ {op:"field",…}, {op:"all"}, {op:"field",…} ], editable: true }

nQuery.parsePath("sort_by(services, &port)[0].name", "jmespath")
// { dialect: "jmespath", parts: [ { op: "raw", value: "sort_by(services, &port)[0].name" } ],
//   editable: false, reason: "UNSUPPORTED_QUERY_EXPRESSION" }
```

## Diagnostics

`validate()` returns structured diagnostics, never a bare boolean:

```javascript
{ valid: false,
  errors:   [ { path: "where[0].cond", code: "INVALID_QUERY",
                message: "Query: unsupported operator 'nope'.", severity: "error" } ],
  warnings: [],
  info:     [] }
```

Codes: `INVALID_QUERY`, `STRUCTURAL_ERROR`, `UNSUPPORTED_QUERY_EXPRESSION`, `QUERY_EXECUTION_ERROR`, `FUNCTION_SELECT_NOT_ALLOWED`, `UNSUPPORTED_IN_TEXT_DSL`.

Detected without executing anything: unknown or non-declarative operators, unbalanced `begin`/`end`, non-string sort fields, non-numeric `limit`/`skip`, unknown selectors, malformed structure, and invalid JMESPath or dot-path syntax.

## From the shell

```
ojob util/config.yaml op=query expr="equals('t','db').sort('-v')" sample=data.json
ojob util/config.yaml op=path  expr="services[?status == 'up'].name" sample=data.json
```

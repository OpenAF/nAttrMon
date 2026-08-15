# Configuration engine

`lib/nconfigengine.js` is a programmatic API to discover nAttrMon components and to load, validate, create, modify, explain and serialize nAttrMon configurations. It is deterministic and works offline — there is no GenAI dependency, and no terminal or browser concepts leak into it. It is the model a Configurator CLI/UI, MCP server, gallery or generator builds on.

```javascript
loadLib(NATTRMON_HOME + "/lib/nmain.js")            // required: the engine reuses its helpers
loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")    // pulls in lib/nquery.js

var engine = new nConfigEngine({
    home      : NATTRMON_HOME,        // installation path
    configPath: "./config",           // active configuration directory
    mode      : "warn"                // "warn" (default) or "strict"
})
```

`lib/nmain.js` reads `NATTRMON_SUBHOME` when it loads, so set that (or `NATTRMON_HOME`) before loading it, exactly as `tests/autotest/harness.js` does.

Two properties are load-bearing:

- **It never evaluates plug code.** Unlike `nAttrMon.prototype.loadObject`, it does not resolve `execFrom`, `af.load()` an object file or run a constructor. Validating a configuration has no side effects.
- **It is not a lossy parser.** Every loaded file keeps its original text; files you never modify are re-emitted byte for byte.

## Discovering components

```javascript
engine.listComponents()                              // every component
engine.listComponents("input")                       // by kind
engine.getComponent("input", "nInput_Shell")         // one component
engine.searchComponents("kube")                      // by name, description or parameter
engine.getMetadataIssues()                           // metadata files that failed to load
```

Components are discovered from `config/objects.meta/` and, for anything without metadata, by indexing `config/objects/*.js` **by filename only**. Custom objects therefore stay first-class: a component with no metadata is still discoverable, just with no parameter information.

A normalized component:

```javascript
{ type       : "input",
  name       : "nInput_Filesystem",
  title      : "Filesystem volumes",
  description: "Collects disk space and inode usage from local, SSH, or Kubernetes targets.",
  examples   : [ "config/inputs.disabled/yaml/10.filesystem.yaml" ],
  source     : "…/config/objects.meta/nInput_Filesystem.yaml",
  file       : "…/config/objects/nInput_Filesystem.js",
  metadata   : { present: true, coverage: "full" },
  parameters : [ {
      name       : "volumeNames",
      type       : { raw: "array<string>", base: "array", of: "string", union: [] },
      description: "Device names or mount points to collect.",
      required   : true,
      example    : [ "/some/path/1" ],
      default    : …, enum: …, secret: …, unit: …, deprecated: …, visibleWhen: …, query: …
  } ] }
```

Unrecognized metadata fields are carried through untouched, so metadata can grow without breaking consumers.

### Metadata coverage — read this before relying on validation

`metadata.coverage` tells you how much validation could actually run:

| Value | Meaning |
|---|---|
| `none` | no metadata; parameter checks skipped entirely |
| `generated` | mostly generated boilerplate (`type: any` with a stock description) |
| `partial` | some arguments documented by hand |
| `full` | every argument documented by hand |

This matters because **the packaged corpus is mostly boilerplate today**: of the 73 files in `config/objects.meta/`, 68 are `type: any` throughout, 70 declare no `required`, and none declare an `enum`. Consequently, on today's components:

- `REQUIRED_PARAMETER` rarely fires,
- `createSkeleton` usually produces an empty `execArgs`,
- `UNKNOWN_PARAMETER` is **suppressed** unless coverage is `full`, because generated metadata does not necessarily list every argument a constructor reads.

None of that is a limitation of the engine; improving `config/objects.meta/` improves validation automatically.

## Loading a configuration

```javascript
var cfg = engine.load("./config")

cfg.inputs        // entries of each kind
cfg.outputs
cfg.validations
cfg.entries       // all of them
cfg.files         // the source tier
```

An entry:

```javascript
{ id: "input:Directory Name", kind: "input", name: "Directory Name",
  file: "inputs/01.test.yaml", docIndex: undefined, listIndex: undefined,
  descriptor: { … } }        // a live reference into the parsed file
```

A file:

```javascript
{ path: "…/config/inputs/01.test.yaml", relPath: "inputs/01.test.yaml",
  format: "yaml", raw: "<original text>", parsed: { … },
  dirty: false, docShape: "map" }
```

`id` is derived from the descriptor name and disambiguated with `#2`, `#3`… when names collide. Ids are recomputed after every change, so an id always means what a fresh `load()` of the same configuration would mean.

Every shipped descriptor form is handled: a document that is a map or an array; `input`/`output`/`validation` as a single map or a list; several kinds in one file; inline `exec`; and `execFrom`. `.js` plug files are tracked and re-emitted verbatim but contribute no editable descriptors.

## Creating

```javascript
engine.createSkeleton("input", "nInput_Filesystem")
// { kind: "input",
//   descriptor: { name: "Filesystem", execFrom: "nInput_Filesystem",
//                 execArgs: { volumeNames: null } },
//   missingRequired: [ "volumeNames" ],
//   metadata: { present: true, coverage: "full" } }
```

The engine never invents values. A required parameter with no documented default is emitted as `null` and listed in `missingRequired`; a documented `default` is used because that is a fact from metadata.

```javascript
engine.create("input", "nInput_Filesystem", { name: "Disks", execArgs: { volumeNames: [ "/" ] } })
```

## Modifying

```javascript
engine.add(cfg, "input", descriptor, { file: "inputs/50.jmx.yaml" })
engine.set(cfg, "input:Disks", "execArgs.volumeNames", [ "/", "/var" ])
engine.patch(cfg, "input:Disks", { cron: "*/5 * * * *", execArgs: { execTimeout: 5000 } })
engine.remove(cfg, "input:Disks")
```

`patch` merges `execArgs` rather than replacing them. `add` appends to a list, converts a single descriptor into a list when a second is added, and creates the target file in the model when it does not exist. Nothing touches disk until `save()`, and only the files you changed are marked dirty.

## Validating

```javascript
var v = engine.validate(cfg)                      // or engine.validate("./config")
var v = engine.validate(cfg, { mode: "strict" })  // warnings become errors
```

```javascript
{ valid: false,
  errors:   [ { path: "input:DB.execArgs.key", code: "REQUIRED_PARAMETER",
                message: "Parameter 'key' is required.", severity: "error" } ],
  warnings: [ { path: "input:DB.execArgs.timeout", code: "UNKNOWN_PARAMETER",
                message: "Parameter 'timeout' isn't declared in metadata.", severity: "warning" } ],
  info:     [],
  stats:    { files: 2, entries: 6, withMetadata: 5, withoutMetadata: 1, queriesChecked: 3 } }
```

Codes: `REQUIRED_PARAMETER`, `PARAMETER_TYPE`, `PARAMETER_ENUM`, `UNKNOWN_PARAMETER`, `UNKNOWN_COMPONENT`, `MALFORMED_DESCRIPTOR`, `LEGACY_KEY`, `INVALID_QUERY`, `UNSUPPORTED_QUERY_EXPRESSION`, `STRUCTURAL_ERROR`, `METADATA_ISSUE`, `LOW_METADATA_COVERAGE`, `FORMATTING_LOSS`.

Descriptor shape is checked by the same helpers nAttrMon itself uses (`normalizeDescriptorLegacyKeys`, `validateDescriptorSchema` in `lib/nmain.js`), called on a lightweight shim so there is one definition of a valid descriptor and no engine instance is needed. Legacy keys are reported as `LEGACY_KEY` diagnostics rather than written to the daemon log.

Two behaviours worth stating explicitly:

- A descriptor with an inline `exec` (or an oJob `execJob`) has no component and is **not** an `UNKNOWN_COMPONENT` — `config/inputs/01.test.yaml` is exactly that shape.
- `type: any` never fails a type check.

### Query validation

Where metadata declares a `query:` dialect for an argument (see `docs/OBJECTS-METADATA.md`), the engine validates the query inside the configuration — catching a bad nLinq operator, malformed JMESPath, or JMESPath written where a plug expects a simple dot-path:

```javascript
{ path: "input:JMX.execArgs.objects[1].path", code: "INVALID_QUERY",
  message: "Path: ParserError: Invalid token (EOF): \"\"", severity: "error" }
```

An unparseable but valid-looking query expression is reported as `UNSUPPORTED_QUERY_EXPRESSION` — a warning, because it is preserved as written and only means it cannot be edited structurally.

## Explaining

`explain` combines configuration with metadata. Everything in the result is derived deterministically; nothing is inferred or generated.

```javascript
engine.explainComponent(cfg, "input:Disks")
// { id: "input:Disks", name: "Disks", type: "input", file: "inputs/10.disks.yaml",
//   object: "nInput_Filesystem", inline: false,
//   title: "Filesystem volumes",
//   description: "Collects disk space and inode usage…",
//   metadata: { present: true, coverage: "full" },
//   trigger: { cron: "*/5 * * * *" },
//   parameters: {
//     volumeNames: { value: [ "/" ], type: "array<string>", required: true,
//                    description: "Device names or mount points to collect." }
//   },
//   produces: [ "Category/Name" ] }        // only when execArgs.attrTemplate says so

engine.explain(cfg)   // the whole configuration
```

Values of parameters declared `secret: true` are redacted to `"(secret)"`.

## Serializing

```javascript
engine.toYAML(cfg)   // { files: [ { path, content, dirty, formattingLoss } ], warnings: [] }
engine.toJSON(cfg)   // { files: [ { path, content } ] }
engine.save(cfg, "./config")
engine.save(cfg, "./config", { allowFormattingLoss: true })
```

Files you never modified are returned **exactly as they were read**, so a load/serialize cycle over an untouched configuration changes nothing.

Rewriting a file does lose YAML anchors, comments and block-scalar formatting — there is no value-level model that can preserve them. That is reported rather than applied silently:

```javascript
{ path: "outputs/00.httpAll.yaml", code: "FORMATTING_LOSS", severity: "warning",
  message: "Rewriting 'outputs/00.httpAll.yaml' doesn't preserve its YAML anchors, comments or block scalars." }
```

and `save()` **refuses** such a file unless you pass `allowFormattingLoss: true`. `config/outputs/00.httpAll.yaml` is the motivating case: five outputs share one `&COMMON` anchor, so editing one entry would expand the anchor across all five. Making that an explicit decision is the point.

Anything the engine does not model — a top-level `common:` block, unknown descriptor fields — survives the round trip intact.

## End to end

`nQuery` is available without a separate `loadLib` here because `lib/nconfigengine.js` pulls in `lib/nquery.js`; load it explicitly when using the query builder on its own.

```javascript
var engine = new nConfigEngine({ home: NATTRMON_HOME, configPath: dir })

engine.listComponents("input")                                   // discover
engine.getComponent("input", "nInput_JMX")                       // inspect
var sk = engine.createSkeleton("input", "nInput_JMX")            // skeleton

var cfg = engine.load(dir)
var e   = engine.add(cfg, "input", sk.descriptor, { file: "inputs/50.jmx.yaml" })
engine.patch(cfg, e.id, { name: "JMX Runtime", cron: "*/30 * * * * *" })   // set parameters

var path = nQuery.path().field("services").filter("status == 'up'").field("name")
engine.set(cfg, "input:JMX Runtime", "execArgs.objects",
           [ { object: "java.lang:type=Runtime", path: path.compile() } ])  // build a query

engine.validate(cfg)                                             // validate config + query
path.test({ services: [ { name: "a", status: "up" } ] })         // test against sample data
engine.save(cfg, dir)                                            // serialize
engine.load(dir)                                                 // load again, losslessly
```

## From the shell

`util/config.yaml` is a thin wrapper for driving the engine by hand. The API is the product; this only exercises it.

```
ojob util/config.yaml op=components [kind=input] [search=kube]
ojob util/config.yaml op=describe name=nInput_Shell
ojob util/config.yaml op=skeleton kind=input name=nInput_JMX
ojob util/config.yaml op=validate dir=./config [mode=strict]
ojob util/config.yaml op=explain dir=./config [id="input:Directory Name"]
ojob util/config.yaml op=query expr="equals('t','db').sort('-v')" [sample=data.json]
ojob util/config.yaml op=path  expr="services[?status == 'up'].name" [sample=data.json]
```

Add `format=json` for machine-readable output. `validate` and `path` exit non-zero when invalid.

## See also

- `docs/QUERY-BUILDER.md` — the query builder in detail
- `docs/OBJECTS-METADATA.md` — the metadata contract, including `query:` declarations

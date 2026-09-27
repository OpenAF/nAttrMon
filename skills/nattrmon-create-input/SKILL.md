---
name: nattrmon-create-input
description: Create or extend an nAttrMon input collector with OpenAF JavaScript, constructor metadata, a disabled sample configuration, and focused tests.
---

# Create an nAttrMon input

Work in the user's nAttrMon checkout. Paths below are relative to that checkout, even if this skill is installed elsewhere. Locate `lib/nmain.js` and read `AGENTS.md` first; preserve unrelated work.

1. Establish the source, sample payload, attribute names and value shape, polling frequency, credentials mechanism, and failure behavior. Inspect `config/objects/` for an existing collector before adding a constructor. Ask for missing source details only when needed; use fixtures for unavailable services.
2. Read `util/templates/Object_nInput_template.js`, `lib/ninput.js`, and the closest working input with its metadata and disabled example. Templates are source scaffolds to read and adapt, not executable generators. Use OpenAF APIs already used by that integration; do not assume Node.js modules or browser globals.
3. Implement `config/objects/nInput_<Name>.js`: normalize the optional parameter map before reading it, validate required parameters, call `nInput.call(this, this.input)`, and inherit from `nInput`. Implement `input(scope, args)` returning a map of attribute names to values. The base `exec` wraps that map as `attributes`; do not wrap it twice. Use `attrTemplate`/`templify` where configurable names are useful. Keep defaults and units explicit.
4. Bound network calls and release acquired resources using the integration's existing lifecycle. Decide whether missing data, an empty result, and a collection failure have different meanings; never manufacture healthy values after a failure. Keep credentials out of logs and samples.
5. Add `config/objects.meta/nInput_<Name>.yaml` following `docs/OBJECTS-METADATA.md`: `kind: input`, matching `constructor`, title, description, examples, and every constructor argument with a real type, description, and example. Include required/default/secret fields as appropriate and declare query dialects. Metadata documents parameters; constructor checks enforce them at runtime.
6. Add a runnable descriptor under `config/inputs.disabled/yaml/` with an `input` root, unique name, appropriate trigger, `execFrom`, and `execArgs`. Keep scheduling fields outside `execArgs`; follow a current example for cron, time interval, and timeout units. Keep new samples disabled by default.
7. Use `tests/autotest/harness.js` and nearby tests to add focused cases under `tests/autotest/test_*.js`: a representative source payload, expected attribute names/values, invalid configuration, and meaningful failure behavior. Stub external services. Run `openaf -f tests/autoTestAll.js`; a bare script path can silently do nothing.

Deliver the constructor, metadata, disabled example, and test results together. Explain dependencies and activation steps, and distinguish fixture-based proof from any live integration check actually performed.

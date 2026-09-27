---
name: nattrmon-create-output
description: Create or extend an nAttrMon output for attributes or warnings, with event handling, filtering, metadata, disabled examples, and isolated tests.
---

# Create an nAttrMon output

Work in the user's nAttrMon checkout. Resolve the paths below there even when the skill is installed elsewhere. Read `AGENTS.md`; preserve unrelated changes.

1. Establish the destination, payload format, whether the output consumes attributes or warnings, event subscription versus scheduled snapshots, batching, and delivery-failure behavior. Inspect existing outputs before creating another integration.
2. Read `util/templates/Object_nOutput_template.js`, `lib/noutput.js`, and the closest output with its metadata and disabled example. Read the template as a scaffold, not a generator or guaranteed-correct implementation: normalize the optional parameter map before accessing fields and review filtering logic.
3. Add `config/objects/nOutput_<Name>.js`. Validate parameters, call `nOutput.call(this, this.output)`, and inherit from `nOutput`. Implement `output(scope, args)` (with `meta` when needed). The base wrapper produces `{ outputs: result }`; do not publish input attributes as an output return contract.
4. For event-driven outputs, handle `args.op`, `args.ch`, `args.k`, and `args.v`: `set` carries one record and `setall` carries arrays. Honor `considerSetAll` if supported, ignore unrelated operations, and distinguish attribute `name` from warning `title`. For scheduled outputs, read scope snapshots instead of assuming an event payload.
5. If include/exclude filtering is offered, combine predicates so an exclude check cannot re-enable a record rejected by include. Test both together. Bound delivery calls, close resources using established lifecycle patterns, and define retry/duplicate behavior according to the destination. Do not add unbounded retries or claim exactly-once delivery without a supporting design.
6. Add `config/objects.meta/nOutput_<Name>.yaml` per `docs/OBJECTS-METADATA.md` with `kind: output`, typed arguments, required/default/secret annotations as appropriate, query dialects, and example links. Add an `output` descriptor under `config/outputs.disabled/yaml/` with `execFrom`, `execArgs`, and a suitable subscription or schedule. Use credential placeholders. Put any shipped UI assets under `config/objects.assets/` with relative asset URLs.
7. Add isolated tests using `tests/autotest/harness.js` and nearby examples. Cover relevant `set`/`setall` or snapshot payloads, filters, formatting, empty input, and destination failures. Use a stub destination or temporary files; do not send real notifications as a unit test. Run `openaf -f tests/autoTestAll.js`.

Deliver the output, metadata, disabled sample, and validation results. Explain destination dependencies and activation steps, distinguishing local payload verification from actual delivery.

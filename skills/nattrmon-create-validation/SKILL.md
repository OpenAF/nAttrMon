---
name: nattrmon-create-validation
description: Create or extend nAttrMon validation logic, including warning severity, stable identity, recovery, metadata, disabled examples, and tests.
---

# Create an nAttrMon validation

Work in the user's nAttrMon checkout. Resolve all paths below there, regardless of where this skill is installed. Read `AGENTS.md` and preserve unrelated work.

1. Establish the attribute shape, condition, threshold boundaries, warning severity, title, recovery condition, and behavior for missing or stale data. Inspect `config/objects/nValidation_Generic.js` and its disabled examples: a declarative check may satisfy the request without a new constructor. Create custom JavaScript when requested or needed.
2. Read `lib/nvalidation.js`, `lib/nwarning.js`, and a similar validation such as `config/objects/nValidation_Semaphores.js`. There is no validation template in `util/templates/`. Older constructors may take positional arguments; new reusable constructors should follow the parameter-map pattern used by `nValidation_Generic`.
3. For a custom object, add `config/objects/nValidation_<Name>.js`, normalize and validate parameters, call `nValidation.call(this, this.validate)`, and inherit from `nValidation`. The callback signature is `validate(warns, scope, args)` and it returns an array of `nWarning` objects. The base wrapper publishes and wraps them; do not return an input-style attribute map.
4. Read current values through the established scope/channel APIs; current-value records contain `.val`. Give each monitored entity a stable warning title, using `nWarning.LEVEL_*` constants for severity. On recovery call `this.closeWarning(title)` for that same title. Returning an empty array alone does not close an existing warning. Define missing-data behavior explicitly instead of treating absence as recovery.
5. Keep remediation separate from detection unless requested. Generic expressions and healing code execute at runtime; never splice untrusted source data into generated executable expressions. An offline descriptor check does not prove the expression or remediation works.
6. Add matching `config/objects.meta/nValidation_<Name>.yaml` per `docs/OBJECTS-METADATA.md` with `kind: validation`, real argument types, required/default/secret annotations as appropriate, query dialects, and an example link. Add a `validation` descriptor under `config/validations.disabled/yaml/` with its trigger, `execFrom`, and `execArgs`. For a Generic-only solution, add the descriptor without inventing a new constructor or metadata entry.
7. Add focused tests using `tests/autotest/harness.js`: normal, failing, threshold boundary, repeated failure without changing identity, recovery, and missing-data cases as relevant. Verify warning state after recovery, not only the returned array. Run `openaf -f tests/autoTestAll.js`.

Deliver the code or declarative check, metadata when applicable, disabled example, and test results. State the warning lifecycle and how to activate the validation.

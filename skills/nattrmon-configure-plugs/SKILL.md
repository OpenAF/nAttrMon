---
name: nattrmon-configure-plugs
description: Discover and configure existing nAttrMon inputs, validations, and outputs, including schedules, subscriptions, execArgs, and queries, using the offline configuration engine.
---

# Configure nAttrMon plugs

Locate the user's nAttrMon checkout or installation and active configuration directory separately. All source paths below refer to that checkout/installation. Read `AGENTS.md` when present. For global settings in `nattrmon.yaml`, use the runtime-settings workflow instead.

## Discover and inspect

Read `docs/CONFIG-ENGINE.md`, `util/config.yaml`, and the selected constructor's `config/objects.meta/` entry. Use explicit arguments to avoid interactive prompts. From the intended checkout, these read-only commands pin the source home so an installed oPack cannot silently take precedence:

```sh
NATTRMON_HOME="$PWD" ojob util/config.yaml op=components kind=input format=json
NATTRMON_HOME="$PWD" ojob util/config.yaml op=describe kind=input name=nInput_Filesystem format=json
NATTRMON_HOME="$PWD" ojob util/config.yaml op=skeleton kind=input name=nInput_Filesystem format=json
```

Change kind/name for the requested component; add `dir=/absolute/config/path` to inspect local objects/metadata. Metadata coverage may be generated, partial, or absent. Read the constructor's parameter handling when metadata is incomplete; a successful validation or an empty skeleton does not establish that all required values are present.

## Edit

Identify the desired attribute flow, trigger, and destination. Prefer existing components for ordinary collection and threshold checks. Inspect a matching disabled example and verify its keys against current code.

- Keep `name`, `cron`/`timeInterval`/`chSubscribe`, `waitForFinish`, and `killAfterMinutes` at descriptor level; keep constructor parameters under `execArgs`. Verify trigger combinations and units in `lib/nplug.js` and descriptor validation in `lib/nmain.js`.
- Use the appropriate `input`, `validation`, or `output` root. Write repository examples under the matching `config/*.disabled/yaml/` directory. Edit active files when deployment configuration is the user's requested scope; creating an example does not activate it.
- Preserve comments, anchors, secrets, and unrelated entries with a narrow textual edit. The engine API supports structured edits, but its save operation may refuse formatting loss. Inspect `toYAML()` diagnostics first; do not turn on `allowFormattingLoss` merely to bypass the refusal. Re-read entry IDs after edits that alter duplicate names.
- Keep metadata loading declarative. Do not execute `exec`, `execFrom`, constructors, or JS configuration files to discover parameters. Read code as text when necessary.
- For query arguments, read `docs/QUERY-BUILDER.md` and the metadata's `query` declaration. JMESPath, dot-path, and nLinq are different languages. Use `op=query` or `op=path` with the appropriate dialect and a non-secret sample file to check behavior.
- Use the constructor's supported secret-resolution mechanism. A `$TOKEN` placeholder in documentation is not evidence that every parameter expands environment variables.

## Validate and deliver

```sh
NATTRMON_HOME="$PWD" ojob util/config.yaml op=validate dir=/absolute/config/path mode=strict format=json
NATTRMON_HOME="$PWD" ojob util/config.yaml op=explain dir=/absolute/config/path format=json
```

Inspect diagnostics as well as the exit status, and avoid exposing secrets from incomplete metadata. The engine does not evaluate plug code and does not validate global bootstrap settings. To check a disabled sample, copy only the relevant descriptor into a temporary configuration tree under `inputs/`, `validations/`, or `outputs/`; validate that tree without activating the sample. Remove the temporary tree afterward.

Report changed files, trigger/parameter choices, diagnostics, and remaining integration checks. Give activation/restart guidance appropriate to the user's deployment; perform service operations only within the requested scope.

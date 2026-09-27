---
name: nattrmon-configure-runtime
description: Configure nAttrMon runtime settings such as workers, logging, buffering, persistence, watchdogs, metrics, and configuration paths in nattrmon.yaml or deployment environment variables.
---

# Configure nAttrMon runtime settings

Locate the intended checkout/installation and deployment home; resolve source paths below there. Read `AGENTS.md` when available and preserve unrelated configuration. This workflow concerns global bootstrap settings; plug constructor arguments and schedules belong in input/output/validation descriptors.

## Resolve the effective configuration

Read `nattrmon.js`, the bootstrap configuration section of `lib/nmain.js`, and `nattrmon.yaml.sample` before editing. The implementation is authoritative when sample comments differ from current defaults or types.

- `NATTRMON_HOME` identifies installation code. The bootstrap derives `NATTRMON_SUBHOME` from `NATTRMON_DIR`, then `withHome`, then the installation home. `lib/nmain.js` reads `nattrmon.yaml` from that subhome.
- Environment values are merged over YAML settings. Inspect only relevant environment keys and redact credentials. Explain when an environment override would mask a YAML change.
- Trace `withDirectory` and `CONFIG` handling for the selected launch method. The plug directory and the directory containing `nattrmon.yaml` are distinct concerns; setting `withDirectory` alone does not relocate the settings file.
- Trace any requested CLI override (such as `watchdogSleep`) in `nattrmon.js`; do not invent a generic CLI flag for every YAML setting. Inspect an oJob/service/container wrapper when it controls launch behavior.

## Make a focused change

Map the user's operational requirement to the exact setting read by code. Read its parser/coercion, default, units, and consumers. YAML settings normally omit the internal `__NAM_` prefix; for example, `NUMBER_WORKERS` configures internal worker state. Preserve native types: `JAVA_ARGS` is handled as an array in current code even though an older sample comment shows a string.

Use the relevant sources without copying the whole configuration catalog:

| Concern | Starting points |
| --- | --- |
| Workers, plug timeout, slowdown | `NUMBER_WORKERS`, `MAXPLUGEXECUTE_TIME`, `SLOWDOWN*` in `lib/nmain.js` |
| Logging and retention | `LOGCONSOLE`, `LOG_ASYNC`, `LOGAUDIT`, `LOGHK_HOWLONGAGOINMINUTES` |
| Buffering and persistence | `BUFFERCHANNELS`, `BUFFERBYNUMBER`, `BUFFERBYTIME`, `NEED_CH_PERSISTENCE`, `CH_PERSISTENCE_PATH`, `CHANNEL_*` |
| Watchdog | `MAIN_WATCHDOG_*` and CLI parsing in `nattrmon.js` |
| Metrics and diagnostics | `RUNTIME_METRICS*`, `RUNTIME_DIAGNOSTICS`, `DEGRADED_*`; `docs/TERMINAL-DASHBOARD.md` for viewing |
| Loading and integrity | `COREOBJECTS*`, `PLUGSORDER`, `ALLOW_EVAL_EXECFROM`, `INTEGRITY*` |

Record the old/new values and expected effect. Use a narrow edit to preserve comments and unrelated settings. For a repository example, update or provide sample configuration; for a deployment task, edit the specified active settings or environment source. Keep secrets out of committed files. Avoid weakening integrity/authentication or changing persistence merely to make a validation command succeed.

## Verify

Parse the edited YAML without loading the daemon; verify types and units against the relevant source branches. `util/config.yaml op=validate` validates plug descriptors, not global runtime settings. Do not present it as a validator for `nattrmon.yaml`.

For source-backed regression work, use `tests/autotest/harness.js` and run `openaf -f tests/autoTestAll.js`. For a settings-only edit, syntax/type checks and inspection of effective overrides are normally sufficient before deployment. Inspect startup/preflight side effects before using `nattrmon.js` as a check: constructing the engine can initialize channels, persistence, and other resources.

Explain which process needs a restart to consume bootstrap changes, how to verify the effective value afterward, and how to restore the previous setting. Restart or probe a running deployment only when that action is within the user's requested scope. Report file validation separately from runtime confirmation.

# Terminal metrics & dashboard

A lightweight, read-only terminal viewer for nAttrMon's own attributes and runtime health —
built for the moment you have nothing but a shell:

```bash
kubectl exec -it <nattrmon-pod> -- sh
openaf -f nattrmon.js -e 'metrics=list'
openaf -f nattrmon.js -e 'metrics=watch;select=Java/Memory/Used'
openaf -f nattrmon.js -e 'dashboard=runtime'
```

No Grafana, no Prometheus, no listening port, and no separate metrics-collection path: it reads
exactly the attributes and runtime metrics nAttrMon already collects. This is **short-term live
visualization**, not persistent historical monitoring — if you need history beyond the current
process's bounded in-memory window, that's what the existing H2/PostgreSQL/Prometheus history
providers (`getHistoryValuesByTime`/`addHistoryProvider`) are for.

## Why this is safe to run against an already-running daemon

`metrics=`/`dashboard=` use `new nAttrMon(configPath, debugFlag, { inspection: true })`.
This mode creates no daemon scheduler, persistence subscribers, housekeeping, logging writers or
runtime collector, and it refuses `.start()`. Input/output/validation plugs and configured
external libraries are not loaded by this constructor. Normal daemon construction is unchanged.

The viewer reads the daemon's `nattrmon.attrs.snapshot`, `nattrmon.cvals.snapshot` and
`nattrmon.runtimehistory.snapshot` files directly. It uses `CH_PERSISTENCE_PATH` when configured,
otherwise the selected configuration directory. Each sampling cycle or runtime-dashboard frame
refreshes those files once and shares the result across its metric getters or panels. One-shot
`list` and `snapshot` commands refresh before resolving their selection. Configured external
current-value channels continue to be read live instead of being replaced by local snapshots.

The daemon writes attribute/value snapshots when `NEED_CH_PERSISTENCE` is enabled (the default);
runtime history also requires `RUNTIME_METRICS.persist` (enabled by default). An incomplete,
missing or unreadable file leaves the viewer's last valid snapshot and its original timestamps
intact. The next cycle retries the read. Before any valid data has arrived, attributes are
unavailable and runtime panels report `source: unavailable` rather than inventing zero values.
The attribute CLI prints `Metric data unavailable` on stderr when no valid attribute or default
current-value snapshot has been read, while keeping `list`/`snapshot` JSON output as an array.
A valid empty snapshot is distinct from missing data and can still produce `No metrics matched`.
Watch reports missing data at startup; if attributes are available it can keep sampling while
waiting for the first value snapshot. Configured external value channels do not require a local
`cvals` file. API callers can inspect `nMetrics.inspectionStatus()` after a read without causing
another refresh. See [Runtime dashboard](#runtime-dashboard) for runtime availability details.

OpenAF's `processExpr()` reads named parameters from `-e`, separated by semicolons, as in the
commands below. The option names used in this guide (`metrics`, `select`, `refresh`, and so on)
refer to those named parameters.

## Discovery

```bash
openaf -f nattrmon.js -e 'metrics=list'
openaf -f nattrmon.js -e 'metrics=list;select=Java/*'
openaf -f nattrmon.js -e 'metrics=list;select=Java/Memory/*,Database/*'
openaf -f nattrmon.js -e 'metrics=list;format=json'
openaf -f nattrmon.js -e 'metrics=list;format=yaml'
```

`select` takes one or more comma-separated patterns — an exact attribute name, or a glob using
`*`/`?` — matched against every known attribute name. No `select` lists everything.

## Snapshot (scripting-friendly)

```bash
openaf -f nattrmon.js -e 'metrics=snapshot;select=Java/*;format=json'
kubectl exec <pod> -- openaf -f nattrmon.js -e 'metrics=snapshot;select=Database/*'
```

`snapshot` is `list`'s current-values sibling — same selector syntax, same `format`
(`table`/`json`/`yaml`), meant for one-shot inspection or piping into other tooling. Non-TTY
output (redirected/piped, or `format=json|yaml`) never emits ANSI color codes.

## Watch a metric live

```bash
openaf -f nattrmon.js -e 'metrics=watch;select=Java/Memory/Used'
openaf -f nattrmon.js -e 'metrics=watch;select=Java/Memory/Used,Java/GC/Collections;refresh=5s;samples=60'
```

Numeric metrics render as a chart with current/min/max/avg over the retained window; non-numeric
metrics (strings, tables, status flags) fall back to a small value table instead of erroring out.
`samples` bounds memory use regardless of how long you leave it running — old samples are
dropped as new ones arrive. `refresh` accepts `5s`/`500ms`/`1m`/a bare number (seconds);
defaults to nAttrMon's own runtime-metrics publish period. The first sample is synchronous;
subsequent samples start after the configured period. An active watch keeps the metric names
selected at startup, while a new selection can discover attributes added since it began.

Ctrl-C restores the terminal and stops the sampling thread cleanly. Run it with redirected output
and you get exactly one snapshot frame plus a note that live refresh needs a TTY — never a hang,
never raw escape codes in a file.

## Runtime dashboard

```bash
openaf -f nattrmon.js -e 'dashboard=runtime'
kubectl exec -it <nattrmon-pod> -- openaf -f nattrmon.js -e 'dashboard=runtime'
```

The one command for "is this nAttrMon instance OK": an Overview panel (threads, plug
executions/errors, degraded-plug count, watchdog restarts), a plug-error trend chart, a per-plug
error-rate table, and a degraded-plugs list — all built from
`nAttrMon.prototype.getRuntimeMetricsSnapshot()`/`getDegradedPlugs()`, no new instrumentation.

The CLI refreshes its runtime numbers from persisted history on every frame. The first line
of the Overview panel always
tells you where the data is from and whether the daemon looks alive:

- `source: restored` — normal case, reading the daemon's last few published points.
- `source: unavailable` — runtime metrics are enabled but the daemon hasn't published+persisted a
  periodic snapshot yet (e.g. it predates `RUNTIME_METRICS.persist`, or just started). Shown as
  an explicit message, never as an empty/misleading panel.
- Per-plug detail (the "Plugs" panel) needs a live, same-process view — it isn't persisted, to
  keep the history file small and cheap to write on every tick.

`dashboard=runtime;format=json` (or `yaml`) skips the live view entirely and dumps every
panel's current data as a one-shot structured document instead — the same idea as
`metrics=snapshot;format=json`, and what makes `kubectl exec <pod> -- openaf -f nattrmon.js -e 'dashboard=runtime;format=json'` (no `-it`, so no TTY) scriptable:

```bash
kubectl exec <nattrmon-pod> -- openaf -f nattrmon.js -e 'dashboard=runtime;format=json'
```

## Ad-hoc dashboard

```bash
openaf -f nattrmon.js -e 'dashboard=Java/Memory/*,Java/GC/*'
```

One panel per resolved metric — chart for numeric, value table otherwise — deterministically, no
GenAI involved anywhere in this feature.

## Options

| Parameter | Applies to | Default |
| --- | --- | --- |
| `select=<pattern>[,<pattern>...]` | `list`, `snapshot`, `watch` | none (all metrics for `list`/`snapshot`; required for `watch`) |
| `refresh=<Ns\|Nms\|Nm\|N>` | `watch`, `dashboard` | nAttrMon's runtime-metrics publish period (default 5s) |
| `samples=<N>` | `watch`, ad-hoc `dashboard` | `60` |
| `format=table\|json\|yaml` | `list`, `snapshot`, `dashboard` | `table` (`dashboard` ignores it and stays live) |

`watch` doesn't support `format` — it's a chart/live view by design; use `snapshot` if you want
a single metric's current value as JSON/YAML instead.

## Terminal capabilities

Sizing/ANSI/unicode are detected via `ow.format.term.getCapabilities()` when the running OpenAF
has it (landed 2026-04-22); on an older OpenAF, a dependency-free fallback (env vars,
`java.lang.System.console()`, 80×24 default) is used instead — either way, the same graceful
degradation rules apply: no color/box-drawing when not a TTY, `printTable`'s own width wrapping on
a narrow terminal, and `ow.format.viz.live()`'s efficient diff-based redraw when available, a
plain `cls()`+redraw loop otherwise. You never get a hard version-refusal just for this feature.

## Adding a custom dashboard

Dashboard definitions live in `lib/ndashboards.js` as `{ panels: [{ title, type: "chart"|"table",
pull() }] }` — `nDashboards.build(aName, aNMetrics, aOptions)` resolves either the built-in
`"runtime"` name or an array of metric selectors into that shape.  To add a new named dashboard
(e.g. `nattrmon dashboard database`), add a case to `nDashboards.build()` returning your own panel
list; each panel's `pull()` just needs to return `{ values: [...] }` (chart) or `{ rows: [...] }`
(table) — `lib/nmetricsview.js#renderDashboardFrame` handles the rest.

## Architecture

```
nAttrMon
    |
current attributes (cvals/lvals/attributes)   runtime metrics (getRuntimeMetricsSnapshot/
    |                                           getDegradedPlugs/getRuntimeMetricsHistory)
    +--------------------+----------------------------------+
                         |
                 lib/nmetrics.js  (list/get/match/snapshot/runtimeSnapshot/watchSession)
                         |
                 lib/nmetricsview.js + lib/ndashboards.js
                         |
              OpenAF core: printTable / ow.format.string.lineChart /
              printSparkline / ow.format.printDashboard / ow.format.viz.live
```

`lib/nmetrics.js` is the only layer that touches nAttrMon internals; the terminal renderer only
ever sees its output. That's deliberate — the same small API is meant to back HTTP, MCP, the
Configurator and GenAI dashboard generation later without re-deriving metric selection from
scratch.

## Out of scope (this feature)

Grafana dashboard generation, Prometheus historical queries beyond a best-effort seed from an
already-configured history provider, persistent metrics storage beyond the small bounded runtime
snapshot described above, MCP, GenAI analysis/generation, a web UI, and alert rule generation are
all separate roadmap items.

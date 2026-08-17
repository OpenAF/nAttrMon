# Terminal metrics & dashboard

A lightweight, read-only terminal viewer for nAttrMon's own attributes and runtime health —
built for the moment you have nothing but a shell:

```bash
kubectl exec -it <nattrmon-pod> -- sh
openaf nattrmon.js --metrics=list
openaf nattrmon.js --metrics=watch --select="Java/Memory/Used"
openaf nattrmon.js --dashboard=runtime
```

No Grafana, no Prometheus, no listening port, and no separate metrics-collection path: it reads
exactly the attributes and runtime metrics nAttrMon already collects. This is **short-term live
visualization**, not persistent historical monitoring — if you need history beyond the current
process's bounded in-memory window, that's what the existing H2/PostgreSQL/Prometheus history
providers (`getHistoryValuesByTime`/`addHistoryProvider`) are for.

## Why this is safe to run against an already-running daemon

`--metrics=`/`--dashboard=` construct a second `nAttrMon` instance against the same `config/`
directory but **never call `.start()`** — no input/output/validation plug runs a second time, no
port gets bound twice. Current/last attribute values come back immediately because the
constructor restores them from the daemon's own on-disk snapshot files
(`config/nattrmon.{cvals,lvals,attrs}.snapshot`), which nAttrMon keeps continuously up to date
whenever `NEED_CH_PERSISTENCE` is enabled (the default). Runtime metrics (JVM/plug/watchdog
health) work the same way via `config/nattrmon.runtimehistory.snapshot`, gated by
`RUNTIME_METRICS.persist` (also on by default when runtime metrics are enabled) — see
[Runtime dashboard](#runtime-dashboard) below for what that means for a daemon that predates this
feature.

## Discovery

```bash
openaf nattrmon.js --metrics=list
openaf nattrmon.js --metrics=list --select="Java/*"
openaf nattrmon.js --metrics=list --select="Java/Memory/*,Database/*"
openaf nattrmon.js --metrics=list --format=json
openaf nattrmon.js --metrics=list --format=yaml
```

`--select` takes one or more comma-separated patterns — an exact attribute name, or a glob using
`*`/`?` — matched against every known attribute name. No `--select` lists everything.

## Snapshot (scripting-friendly)

```bash
openaf nattrmon.js --metrics=snapshot --select="Java/*" --format=json
kubectl exec <pod> -- openaf nattrmon.js --metrics=snapshot --select="Database/*"
```

`snapshot` is `list`'s current-values sibling — same selector syntax, same `--format`
(`table`/`json`/`yaml`), meant for one-shot inspection or piping into other tooling. Non-TTY
output (redirected/piped, or `--format=json|yaml`) never emits ANSI color codes.

## Watch a metric live

```bash
openaf nattrmon.js --metrics=watch --select="Java/Memory/Used"
openaf nattrmon.js --metrics=watch --select="Java/Memory/Used,Java/GC/Collections" --refresh=5s --samples=60
```

Numeric metrics render as a chart with current/min/max/avg over the retained window; non-numeric
metrics (strings, tables, status flags) fall back to a small value table instead of erroring out.
`--samples` bounds memory use regardless of how long you leave it running — old samples are
dropped as new ones arrive. `--refresh` accepts `5s`/`500ms`/`1m`/a bare number (seconds);
defaults to nAttrMon's own runtime-metrics publish period.

Ctrl-C restores the terminal and stops the sampling thread cleanly. Run it with redirected output
and you get exactly one snapshot frame plus a note that live refresh needs a TTY — never a hang,
never raw escape codes in a file.

## Runtime dashboard

```bash
openaf nattrmon.js --dashboard=runtime
kubectl exec -it <nattrmon-pod> -- openaf nattrmon.js --dashboard=runtime
```

The one command for "is this nAttrMon instance OK": an Overview panel (threads, plug
executions/errors, degraded-plug count, watchdog restarts), a plug-error trend chart, a per-plug
error-rate table, and a degraded-plugs list — all built from
`nAttrMon.prototype.getRuntimeMetricsSnapshot()`/`getDegradedPlugs()`, no new instrumentation.

Because the CLI's own instance never `.start()`s, its *current* runtime numbers come from the
persisted history file, not a live read — so the very first line of the Overview panel always
tells you where the data is from and whether the daemon looks alive:

- `source: restored` — normal case, reading the daemon's last few published points.
- `source: unavailable` — runtime metrics are enabled but the daemon hasn't published+persisted a
  periodic snapshot yet (e.g. it predates `RUNTIME_METRICS.persist`, or just started). Shown as
  an explicit message, never as an empty/misleading panel.
- Per-plug detail (the "Plugs" panel) needs a live, same-process view — it isn't persisted, to
  keep the history file small and cheap to write on every tick.

`--dashboard=runtime --format=json` (or `yaml`) skips the live view entirely and dumps every
panel's current data as a one-shot structured document instead — the same idea as
`--metrics=snapshot --format=json`, and what makes `kubectl exec <pod> -- ... --dashboard=runtime
--format=json` (no `-it`, so no TTY) scriptable:

```bash
kubectl exec <nattrmon-pod> -- openaf nattrmon.js --dashboard=runtime --format=json
```

## Ad-hoc dashboard

```bash
openaf nattrmon.js --dashboard="Java/Memory/*,Java/GC/*"
```

One panel per resolved metric — chart for numeric, value table otherwise — deterministically, no
GenAI involved anywhere in this feature.

## Options

| Flag | Applies to | Default |
| --- | --- | --- |
| `--select=<pattern>[,<pattern>...]` | `list`, `snapshot`, `watch` | none (all metrics for `list`/`snapshot`; required for `watch`) |
| `--refresh=<Ns\|Nms\|Nm\|N>` | `watch`, `dashboard` | nAttrMon's runtime-metrics publish period (default 5s) |
| `--samples=<N>` | `watch`, ad-hoc `dashboard` | `60` |
| `--format=table\|json\|yaml` | `list`, `snapshot`, `dashboard` | `table` (`dashboard` ignores it and stays live) |

`watch` doesn't support `--format` — it's a chart/live view by design; use `snapshot` if you want
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

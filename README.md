# nAttrMon

![version](.github/version.svg)

**nAttrMon** (n-Attribute-Monitor) is a flexible, lightweight monitoring framework designed for functional monitoring of solutions, including RAID systems and custom applications. It provides a plugin-based architecture for collecting metrics, validating conditions, and generating alerts.

## Features

- **Flexible Plugin Architecture**: Extensible inputs, outputs, and validation plugins
- **YAML/JavaScript Configuration**: Define monitoring configurations using YAML or JavaScript
- **Cron-based Scheduling**: Schedule inputs and outputs with cron expressions
- **Real-time Validation**: Execute custom validation logic on collected attributes
- **Multiple Output Channels**: Support for various output formats and destinations
- **Built-in Debugging**: Comprehensive logging and debugging capabilities
- **Single-run Mode**: Execute monitoring tasks once or run as a daemon
- **Easy Updates**: Simple package-based update mechanism

## Prerequisites

- [OpenAF](https://openaf.io/) >= 20241117

## Quick Start

1. **Install nAttrMon**:
   ```bash
   opack install nattrmon
   ```

2. **Configure your monitoring** by editing the configuration files in the `config` folder

3. **Run nAttrMon**:
   ```bash
   ojob nattrmon.yaml
   ```

For a single execution without daemon mode:
```bash
ojob nAttrmon_single.yaml.sample
```

## Runtime Hardening And Tuning

You can tune runtime behavior in `nattrmon.yaml`:

- `ALLOW_EVAL_EXECFROM` (default: `true`): keeps compatibility for `execFrom` expressions by allowing eval fallback. Set to `false` to restrict `execFrom` to resolvable constructor names.
- `INTEGRITY_WARN` (default: `true`): when integrity is configured and a file hash mismatches, emit warning and continue loading.
- `INTEGRITY_STRICT` (default: `false`): when integrity is configured, also fail files that do not have a configured hash.
- `MAIN_WATCHDOG_SLEEP` (default: `60000`): watchdog loop period in milliseconds.
- `MAIN_WATCHDOG_STUCKFACTOR` (default: `500`): multiplier used in stuck-thread/process detection.
- `MAIN_WATCHDOG_WARN_COOLDOWN` (default: `300000`): minimum interval in milliseconds between repeated watchdog warnings for the same key.
- `RUNTIME_METRICS` (default: `true`): enables runtime metrics snapshots (plugs/scheduler/channels/watchdog) in session/channel data.
- `RUNTIME_METRICS_PERIOD` (default: `5000`): periodic refresh cadence for runtime snapshots.
- `RUNTIME_METRICS_CH` (default: `nattrmon::runtime::metrics`): channel storing the latest runtime metrics snapshot.
- `RUNTIME_EVENTS_CH` (default: `nattrmon::runtime::events`): channel with watchdog/runtime event entries.
- `RUNTIME_OWMETRICS` (default: `false`): when true, registers an optional `ow.metrics` collector for runtime internals.
- `RUNTIME_OWMETRICS_NAME` (default: `nattrmon_runtime`): collector name used when `RUNTIME_OWMETRICS=true`.
- `DEGRADED_ERROR_RATE_THRESHOLD` (default: `0.25`): error-rate threshold to mark a plug as degraded once min executions is reached.
- `DEGRADED_MIN_EXECS` (default: `5`): minimum execution count before error-rate degradation is considered.
- `DEGRADED_TIMEOUT_HITS` (default: `2`): timeout-hit threshold to flag a plug as degraded.
- `DEGRADED_WATCHDOG_HITS` (default: `1`): watchdog thread-hit threshold to flag a plug as degraded.

Optional integrity manifest example in `nattrmon.yaml`:

```yaml
INTEGRITY:
   warn: true
   strict: false
   list:
      - config/inputs/00.nattrmon.yaml: sha256-<hash>
      - config/objects/nOutput_HTTP.js: sha256-<hash>
```

You can also override watchdog values at startup:

```bash
openaf nattrmon.js --watchdogSleep=30000 --watchdogStuckFactor=300 --watchdogWarnCooldown=60000
```

Run startup preflight checks (without starting daemon execution):

```bash
openaf nattrmon.js --preflight=true
```

Preflight loads plugs and reports unresolved `execFrom` constructors and integrity issues early.

Runtime watchdog counters are exposed in session data under `watchdog.stats` (threshold hits, warnings emitted/suppressed, and restart metadata).

Phase 5 runtime snapshots are exposed in session data under `runtime.metrics`, and watchdog/runtime events under `watchdog.lastEvent` plus the configured runtime events channel.

Phase 5.3 diagnostics are exposed in session data under `runtime.diagnostics` and via HTTP endpoints:

- `GET /diagnostics` (JSON report of degraded plugs and reasons)
- `GET /diagnostics?format=openmetrics` (summary gauges)
- `GET /metrics?type=diagnostics` (diagnostics in the existing metrics route)

OpenMetrics diagnostics now include both summary and per-plug lines:

- `nattrmon_diagnostics_totalDegraded`
- `nattrmon_diagnostics_plug_degraded{type,category,name}`
- `nattrmon_diagnostics_plug_error_rate{type,category,name}`
- `nattrmon_diagnostics_plug_timeout_hits{type,category,name}`
- `nattrmon_diagnostics_plug_watchdog_hits{type,category,name}`
- `nattrmon_diagnostics_plug_reason{type,category,name,rule}`

### Terminal metrics & dashboard

Inspect a running (or `kubectl exec`'d into) nAttrMon from a plain shell, no Grafana/Prometheus required:

```bash
openaf nattrmon.js --metrics=list
openaf nattrmon.js --metrics=snapshot --select="Java/*" --format=json
openaf nattrmon.js --metrics=watch --select="Java/Memory/Used"
openaf nattrmon.js --dashboard=runtime
```

See [Terminal metrics & dashboard](docs/TERMINAL-DASHBOARD.md) for the full command reference.

## Installation

### Install from opack repository

```bash
opack install nattrmon
```

### Install a specific version

```bash
opack install nattrmon-yyyyMMdd.opack
```

Where `nattrmon-yyyyMMdd.opack` is the specific package version.

## Updating

### Step 1: Backup your configuration

```bash
cd /the/folder/where/nAttrMon/is/installed
ojob ./util/backupConfig.yaml
```

This generates a file called `nattrmonConfig-yyyyMMdd.zip`. Move it to a safe location (e.g., your home folder).

### Step 2: Update nAttrMon

```bash
opack update nattrmon
```

**Important notes**:
- Newer versions may require updated OpenAF versions
- If you encounter errors, use the install procedure instead

### Configuration considerations after update

If you use a custom config folder (not the default):

- Check the `inputs.disabled`, `outputs.disabled`, and `validations.disabled` examples in the default config folder for updates
- If your config folder has objects and `objects.assets` copied from the default `config/objects` folder, merge them or use the `COREOBJECTS` setting in the main `nattrmon.yaml` configuration file
- You can restore from the backup created in Step 1 if needed

## Documentation

For comprehensive documentation, tutorials, and plugin references, visit:

[https://openaf.github.io/nattrmon-docs/](https://openaf.github.io/nattrmon-docs/)

Object constructor arguments, descriptions, and linked disabled-config examples are declared in [`config/objects.meta/`](config/objects.meta/). See [Object metadata](docs/OBJECTS-METADATA.md) for the format and the runtime discovery API.

See [Terminal metrics & dashboard](docs/TERMINAL-DASHBOARD.md) for `nattrmon metrics`/`nattrmon dashboard` — a Grafana/Prometheus-free way to inspect a running nAttrMon from a shell (including `kubectl exec`).

## Building from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/OpenAF/nAttrMon.git
   cd nAttrMon
   ```

2. Build the package:
   ```bash
   opack pack .
   ```

3. This generates a package named `nattrmon-yyyyMMdd.opack`

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:
- How to fork and create feature branches
- Testing requirements for new plugins
- Pull request guidelines
- Documentation contributions

## Support

- **Issues**: [GitHub Issues](https://github.com/OpenAF/nAttrMon/issues)
- **Documentation**: [nattrmon-docs](https://github.com/OpenAF/nattrmon-docs)

## License

nAttrMon is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Authors

- Nuno Aguiar
- Andreia Brizida
- Jose Alves
- Leandro Fernandes
- Surya Kalyan Jaddu

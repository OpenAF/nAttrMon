# Correctness and performance verification

Run the hermetic suite with `openaf -f tests/autoTestAll.js`. Test-file loading
errors fail the runner, as do failed assertions. No live service or backend is
required. The fixtures use temporary files, channels, fake service clients and
independent OpenAF processes for snapshot and configuration inspection checks.

## Correctness coverage

| Area | Regression coverage under `tests/autotest/` |
| --- | --- |
| HTTP authentication routing and instance isolation | `test_safe_config_regressions.js` |
| Inert YAML, strict diagnostics, metadata rejection, untouched bytes, JSON refusal | `test_safe_config_regressions.js`, existing config-engine tests |
| Wrapper failures, failure-only diagnostics, ordered batches and shared deadlines | `test_remediation_execution.js` |
| Email failure recovery and in-flight exclusion | `test_alert_history_remediation.js` |
| Timed rows/attributes, snapshots, removals, failed reads and concurrency | `test_alert_history_remediation.js` |
| H2/PostgreSQL/Oracle transaction retry and retention acknowledgement | `test_alert_history_remediation.js` |
| Init retry state, filesystem routing, collection shapes, forwarding and retention | `test_collection_remediation.js` |
| Read-only inspection, snapshot freshness/recovery, fixed selection and sampling | `test_remediation_inspection.js`, existing phase 9 tests |

Backend tests verify calls, transaction boundaries and retry bookkeeping through
controlled clients. They do not claim a live H2/PostgreSQL/Oracle or SMTP integration
run. Package verification uses a temporary staged package and an unrelated working
directory, without installing it over the user's existing oPack.

## Performance contracts

`test_collection_performance.js` compares OTLP bodies against the prior serializer
and batching algorithm, byte for byte. Cases include Unicode, escaping, interleaved
metric names, count limits, exact byte limits and oversized records. It also counts
serialization work and proves DB inputs retrieve and clone only the requested
last-value entry at each query's execution time.

`test_remediation_performance.js` compares output cache behavior against the prior
algorithm, counts cache enumerations, tests replacement maps and counts UUID reads
while building runtime snapshots. These operation counts are the acceptance checks;
the suite has no performance timing thresholds.

For observational before/after measurements:

```sh
openaf -f tests/benchmarkCollection.js
openaf -f tests/benchmarkRuntime.js
```

One local OpenAF run measured the following (milliseconds; machine and JVM warmup
influence these values):

| Workload | Prior algorithm | Updated algorithm |
| --- | ---: | ---: |
| OTLP, 2,000 metric records | 982 | 22 |
| OTLP, 2,000 log records | 962 | 8 |
| 100 DB lookups among 10,000 last values | 10,111 | 1 |
| Output cache, 10,000 inserts, cap 8,192 | 613 | 68 |
| Runtime snapshot, 1,000 sessions and 3,000 process statuses | 12,141 | 11 |

OTLP bodies, deduplication state and running counts were equivalent in those runs.
The runtime reference deliberately restores the prior per-session scan while
retaining the new index construction, so its timing includes a small extra linear
pass. These measurements are diagnostic, not promises about production latency.

# OpenTelemetry output

`nOutput_OpenTelemetry` pushes current attribute values as gauges and warning
updates as logs using OTLP/HTTP JSON. It uses OpenAF's HTTP client and requires no
OpenTelemetry SDK. Collector delivery requires no extra oPack; direct AWS delivery
requires the AWS oPack. Existing OpenMetrics endpoints can run alongside it.

Copy `config/outputs.disabled/yaml/20.opentelemetry.yaml` into your active outputs
directory and set `execArgs.endpoint` to your Collector's HTTP base URL, normally
`http://localhost:4318`. Signal paths `/v1/metrics` and `/v1/logs` are appended;
an optional base path is preserved. gRPC and binary Protobuf are not supported.
The output is disabled until the sample is installed in the active directory.

## Configuration

| Argument | Default | Meaning |
| --- | --- | --- |
| `endpoint` | Required unless `aws` is set | HTTP(S) base URL; no credentials, query, fragment or signal suffix |
| `aws` | Unset | Direct AWS delivery: required `region`, plus `logGroup` and `logStream` for warnings; mutually exclusive with `endpoint` |
| `headers` | `{}` | Additional HTTP headers; AWS authentication/signature/routing headers are reserved; Accept/Content-Type are fixed to `application/json` |
| `resourceAttributes` | `service.name: nattrmon` | Resource identity shared by both signals |
| `includeValues`, `includeWarns` | `true` | Enable each signal independently |
| `include`, `exclude` | All included, none excluded | Regex lists matching original attribute names or warning titles; exclusion wins |
| `metricPrefix` | `nattrmon` | Prefix for generated metric names |
| `metricOverrides` | `{}` | Generated-name keys with optional `name`, `unit`, `description` strings |
| `labelFields` | `[]` | Explicit string fields on array rows to use as labels |
| `timeoutMs` | `5000` | Per-attempt timeout in milliseconds |
| `maxRetries` | `2` | Additional attempts per batch |
| `maxBatchSize` | `500` | Maximum points or log records per request |
| `maxPayloadBytes` | `1048576` | Maximum serialized UTF-8 request bytes, including envelopes |

Set `service.instance.id` in `resourceAttributes` to distinguish nAttrMon instances.
Resource values use OTLP typed strings, numbers, booleans, arrays and maps; nulls
and dates are not accepted. JVM TLS verification remains enabled. Collector credentials can
be supplied using the standard output descriptor `execArgs.secKey` and
`execArgs.secOut: headers` secret-resolution mechanism. Do not store live tokens
in checked-in YAML. Redirects are disabled to keep authentication at the configured endpoint.

The sample subscribes to `nattrmon::cvals` and `nattrmon::warnings`. Their
`::buffer` variants are also supported; subscribe to either the base or buffered
channel for each signal to avoid duplicate exports. The output processes `set`
and `setall`. Other operations and unrelated channels are ignored. It does not
poll values on a timer or forward nAttrMon's own runtime log channel.
The sample sets `waitForFinish: false` so channel updates remain eligible while
another export is running. Setting it to `true` makes nAttrMon skip overlapping
invocations; it does not queue them for later delivery.

## Metrics

Finite numeric leaves become OTLP gauges. Booleans become `0` or `1`. Strings,
nulls, dates, non-finite numbers and unsupported values are skipped. Map keys are
traversed in sorted order. For example:

```yaml
name: Service/Memory
val:
  bytes: 1024
  available: true
```

This produces `nattrmon_Service_Memory_bytes = 1024` and
`nattrmon_Service_Memory_available = 1`. Names join the prefix, original name and
nested field path with underscores; other characters become underscores. A name
without an initial letter receives `n_`. Names are limited to 255 characters.
Overrides are keyed by the generated name and may supply a distinct final name,
UCUM unit (for example `By` or `s`) and description. No unit or counter semantics
are inferred from field names.

Arrays retain row identity using string point attributes
`nattrmon.array.index.0`, `nattrmon.array.index.1`, etc., one per nested array.
Indices follow array ordering. `labelFields: [host]` also attaches a row's string
`host` field; other strings are skipped. Avoid labels with unbounded values.
The `nattrmon.` prefix is reserved. The same configured label in a nested row
overrides the outer row's value.

Conflicting normalized or overridden metric names from different source paths,
and duplicate points with identical name, labels and timestamp, reject that
update before any network request. Rename source attributes or fields to resolve
normalization collisions. Overrides cannot separate two paths that already
normalize to the same generated name.

Observation time comes from the attribute's `date`, falling back to export time
when absent, invalid or outside the OTLP unsigned nanosecond range. Nanoseconds are decimal strings calculated without
floating-point multiplication. Gauge values use `asDouble`. There are no
counters, histograms, rate calculations or periodic refresh of unchanged values.
Resource/scope envelopes use scope name `nattrmon.output.opentelemetry`.

## Warning logs

Each warning update, including `Closed`, becomes a log record. Its description
is the body (or title when no string description exists). Attributes retain
`nattrmon.warning.title`, `.level`, `.category`, and `.createdate` (Unix
nanoseconds as a string). Notification bookkeeping is excluded.

| Original level | Severity number | OTel severity |
| --- | --- | --- |
| High | 17 | ERROR |
| Medium, Low | 13 | WARN |
| Info, Closed | 9 | INFO |
| Unknown | 0 | Unspecified |

`severityText` retains the original level. Event time is `lastupdate` and observed
time is export time. Missing/invalid dates fall back to export time. These are
channel updates: duplicate updates, notification-related writes and buffered
replays can produce duplicate logs. Closing a warning emits its Closed update;
deleting a warning does not synthesize a closure record.

## Delivery and failures

Requests are split by point/record count and actual encoded byte size. An
individually oversized record is dropped with a diagnostic. Empty updates send
no requests. Each batch has a 20-second total retry budget; each attempt uses the
smaller of `timeoutMs` and the remaining budget. A large update can span multiple
batches and therefore take longer than 20 seconds in total.

Connection failures and HTTP 429, 502, 503 and 504 are retried with exponential
backoff and jitter. A valid `Retry-After` header is honored if the delay fits the
remaining budget; otherwise the batch is dropped. Other HTTP statuses are not
retried. HTTP 200 responses are decoded for partial success: rejected counts are
reported, and partial successes are never retried. An empty default
`partialSuccess` object is accepted without a warning. Malformed success responses
leave delivery unconfirmed and are not replayed. Diagnostics omit endpoints,
headers, payloads, remote error text and exception text.

Export runs in the output invocation, so timeout and retry delays occupy that
output worker. Each HTTP attempt owns its response state and releases its client
in a `finally` block. No queue or deduplication state survives an invocation.
Outages can lose telemetry; a lost acknowledgement can cause retry duplicates.
Use a nearby Collector with a persistent sending queue and retries for durable
downstream export. Collector durability begins after it accepts the request.

Protocol reference: [OTLP specification](https://opentelemetry.io/docs/specs/otlp/).

## Collector smoke test

This minimal Collector configuration decodes both signals and prints them:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
exporters:
  debug:
    verbosity: detailed
service:
  pipelines:
    metrics:
      receivers: [otlp]
      exporters: [debug]
    logs:
      receivers: [otlp]
      exporters: [debug]
```

Run the Collector with this configuration, install the disabled output sample,
then publish a numeric current value and a warning followed by a Closed update.
Check the debug exporter for resource identity, gauges, values, exact observation
times, warning attributes and ERROR/WARN/INFO severity. The debug exporter is for
validation; configure your backend exporter and its queue/retry storage for deployment.

Hermetic regression coverage runs with `openaf -f tests/autoTestAll.js`; it mocks
HTTP, delays and clocks and requires no Collector or network access.

## Direct AWS delivery

Install AWS oPack version 20261030 or later alongside nAttrMon. Enable the
[disabled AWS example](../config/outputs.disabled/yaml/21.opentelemetry-aws.yaml)
and set `aws.region`, `aws.logGroup` and `aws.logStream`. The group and stream
must already exist; the output creates no infrastructure. Log routing is required
when `includeWarns` is true (the default). An instance accepts either `endpoint`
or `aws`. To send to a collector and AWS, enable two output instances using the
collector and AWS examples; each has its own delivery attempts and retry budget.

Metrics go to `https://monitoring.<region>.amazonaws.com/v1/metrics`, signed for
`monitoring`; warnings go to `https://logs.<region>.amazonaws.com/v1/logs`, signed
for `logs`, with `x-aws-log-group` and `x-aws-log-stream` headers. Only commercial
AWS regions are supported. Custom endpoints and other AWS partitions are not
supported. See [AWS OTLP endpoints](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OTLPEndpoint.html).
This output exports gauges and warning logs; it does not generate or export traces.

Grant the sending identity `cloudwatch:PutMetricData` (resource `*`) and
`logs:PutLogEvents` on the destination log stream. Credential discovery can also
require provider permissions, such as the web identity role trust policy. No
`CreateLogGroup` or `CreateLogStream` permission is needed. Scope read permissions
for smoke-test verification separately from the sending identity.

Credentials use the AWS oPack's existing discovery order: environment, shared
credentials file, credential process, web identity, container URI and IMDS.
This output accepts no access key, secret or session token fields. Expiring
credentials refresh 60 seconds before expiration; credentials without expiration
are rediscovered after five minutes. Refresh is serialized per client. A failed
refresh retains a valid session and throttles acquisition retries for 30 seconds;
expired sessions fail signing. Each HTTP retry obtains a new signature. Credential
acquisition and signing consume the per-attempt timeout and the 20-second batch
budget. Signing failures drop that batch with a sanitized diagnostic; they never
send unsigned requests. Later channel updates can try again.

`headers` may supply additional headers, but authentication, AWS signature, host,
log routing and transport framing headers are reserved. Keep TLS certificate
verification enabled; redirects remain disabled.

### Opt-in live smoke test

The smoke script sends exactly one current gauge and one warning to an existing
group and stream. It creates no AWS resources. It uses signed PromQL and log API requests for arrival
verification, requiring `cloudwatch:ListMetrics`, `cloudwatch:GetMetricData` and
`logs:FilterLogEvents` on the verifying identity. Run from the repository root:

```sh
NATTRMON_OTEL_AWS_LIVE=1 AWS_REGION=eu-west-1 \
  NATTRMON_OTEL_LOG_GROUP=/nattrmon/warnings \
  NATTRMON_OTEL_LOG_STREAM=monitoring-01 \
  openaf -f tests/opentelemetry-aws-live.js
```

The unique run identifier is printed. The script polls for up to three minutes
and exits unsuccessfully if either signal is missing. New CloudWatch metrics can
take longer to become queryable; use the printed metric name for a later manual
check if polling expires. Offline tests do not establish IAM, regional availability
or arrival in CloudWatch. Live delivery is verified only when both arrival checks
succeed.

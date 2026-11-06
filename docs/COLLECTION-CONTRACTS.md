# Collection and forwarding contracts

## OpenMetrics series

`nInput_OpenMetrics` keeps the existing object for a metric with one series. If
several series have the same name after filtering and replacement, its value is
an array in parser order. Each series keeps its target `key`, labels and `value`.
For example:

```yaml
requests_total:
  - key: frontend
    method: GET
    value: 12
  - key: frontend
    method: POST
    value: 3
uptime_seconds:
  key: frontend
  value: 60
```

A direct URL still returns one metric map under `attrTemplate`; `chKeys` still
returns an array of those maps, one per target. Filtering and name replacement
happen before accumulation, so replacement collisions also retain all series.
Consumers of a repeated metric should iterate its array instead of assuming that
only the final series is present.

## JMX attributes

`nInput_JMX` flattens the results from every target in channel order. A rendered
attribute name with one result keeps its existing object shape. Repeated names
produce an ordered array of result objects, each retaining its target `key`.
Different MBeans using the same `attrTemplate` follow the same rule. For example:

```yaml
Java/JMX Memory:
  - key: server-a
    HeapMemoryUsage:
      used: 1024
  - key: server-b
    HeapMemoryUsage:
      used: 2048
```

The input still reuses its existing JMX connections. Neither change introduces a
new constructor option.

## Remote channel forwarding

`nOutput_RemoteChannel` applies `include` and `exclude` independently to each
record's id. These lists contain exact ids; exclusion wins when an id appears in
both lists. `setall` values supply the ids, while its keys remain the channel's
key-field list. Selected records retain their source order. An empty selection
makes no remote call. Attribute templating and optional `valueKey` wrapping act
on copies, leaving the source event's keys and values unchanged.

## Housekeeping and DB query context

`nOutput_HK.attributeDeleteAfter` reads the attribute's stored `lastcheck` metadata,
including attributes without a current value. Warning filters use each warning's
actual title. Existing time thresholds, filter precedence and deletion channels
remain unchanged.

`nInput_DB` reads the requested last-value entry immediately before each query's
template is rendered. The template still receives a cloned entry containing
`name`, `val` and `date`; unrelated last values are no longer read or cloned.

## Verification and performance

`openaf -f tests/autoTestAll.js` includes behavioral regressions for collection,
forwarding and housekeeping. OTLP regression tests compare complete request
bodies with the previous batching algorithm at count and byte boundaries,
including Unicode, escaping, interleaved metric names and oversized records.
They also count processed text to verify linear byte-accounting work. DB tests
require one last-value key lookup per query and reject full-channel reads.

`openaf -f tests/benchmarkCollection.js` runs those performance regressions and
prints optional before/after timings. It uses 2,000 OTLP records and 100 DB
lookups among 10,000 stored attributes. Timing is observational and never a
pass/fail threshold; machine load and JVM warm-up affect the results.

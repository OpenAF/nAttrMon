# HTTP metrics formats

`nOutput_HTTP_Metrics` exposes `/metrics` and `/diagnostics` beneath the configured relative path.

Set `execArgs.format: openmetrics` to make `/metrics` return strict OpenMetrics 1.0, or request `/metrics?format=openmetrics`. The diagnostics route supports `/diagnostics?format=openmetrics`; its default remains JSON. Metrics selectors (`type=self`, `cvals`, `lvals`, `warns`, or `diagnostics`) also work with strict format.

Strict responses use `application/openmetrics-text; version=1.0.0; charset=utf-8`, group samples by family, and finish with one `# EOF` line. Explicit timestamps are epoch seconds. Scalar families use the `unknown` type rather than inferring counter semantics from attribute names. Array labels retain the serializer's prefix-based IDs even when `removeIds` is enabled, so distinct array entries remain distinct series.

Strict mode requires an OpenAF runtime providing `ow.metrics._fromObj2OpenMetricsStrict` and the `aStrict` argument on `fromObj2OpenMetrics`. Older runtimes return HTTP 500 with an explanatory server log instead of silently serving legacy text as OpenMetrics. Name collisions, duplicate series, invalid text, and configured `findAndReplace` on strict `/metrics` responses also fail with HTTP 500. Rename colliding attributes or prefixes and remove text replacements before enabling strict mode.

With `format` omitted, `/metrics` retains its legacy text format. `format=json` remains available. Format selection is explicit; the endpoint does not negotiate using the HTTP Accept header. See `config/outputs.disabled/yaml/04.httpmetrics.yaml` for a configuration example.

// Phase 9.5 -- terminal output formatting (lib/nmetricsview.js): table/json/yaml rendering,
// value formatting, and that non-TTY/narrow output never emits ANSI escapes or throws.

loadLib(NATTRMON_HOME + "/lib/nmetricsview.js")

var __t9f_ESC = String.fromCharCode(27) // real ANSI escapes start with ESC (0x1B); a bare "[" is not a reliable indicator (e.g. JSON arrays)
// printTable(..., useAnsi=false, ...) still appends a harmless trailing bare SGR reset ("[m",
// no color/style digits) regardless of useAnsi -- that's OpenAF core's own printTable behavior, not
// something this layer controls, and it's inert even in a redirected/piped file. What must NOT
// appear with ansi=false is an actual color/style code (ESC[ followed by a digit).
var __t9f_hasColorCode = (s) => new RegExp(__t9f_ESC + "\\[\\d").test(s)

var __t9f_rows = [
	{ name: "Java/Memory/Used", value: 1234, type: "num", date: new Date(Date.now() - 2000) },
	{ name: "Database/Status", value: "ok", type: "str", date: new Date(Date.now() - 4000) }
]

ow.test.test("nMetricsView.output::table format includes metric names/values and no ANSI when ansi=false", () => {
	var out = nMetricsView.output(__t9f_rows, { format: "table", caps: { width: 80, height: 24, ansi: false, unicode: true } })
	ow.test.assert(out.indexOf("Java/Memory/Used") >= 0, true, "table should mention the metric name")
	ow.test.assert(out.indexOf("1234") >= 0, true, "table should mention the metric value")
	ow.test.assert(__t9f_hasColorCode(out), false, "no ANSI color/style codes should be emitted when caps.ansi is false (non-TTY/redirected output)")
})

ow.test.test("nMetricsView.output::json format is valid JSON reusing OpenAF's own stringify()", () => {
	var out = nMetricsView.output(__t9f_rows, { format: "json" })
	var parsed = jsonParse(out)
	ow.test.assert(isArray(parsed) && parsed.length, 2, "json output should parse back to the same number of rows")
	ow.test.assert(parsed[0].name, "Java/Memory/Used", "json output should preserve field values")
	ow.test.assert(out.indexOf(__t9f_ESC) < 0, true, "json output must never contain ANSI escapes")
})

ow.test.test("nMetricsView.output::yaml format reuses OpenAF's own af.toYAML()", () => {
	var out = nMetricsView.output(__t9f_rows, { format: "yaml" })
	ow.test.assert(out.indexOf("Java/Memory/Used") >= 0, true, "yaml output should mention the metric name")
	var parsed = af.fromYAML(out)
	ow.test.assert(isArray(parsed) && parsed.length, 2, "yaml output should parse back to the same number of rows")
})

ow.test.test("nMetricsView.output::empty selection reports a clear message instead of an empty table crash", () => {
	var out = nMetricsView.output([], { format: "table", caps: { width: 80, height: 24, ansi: false } })
	ow.test.assert(out, "(no metrics matched)", "empty rows should produce a clear message, not printTable([]) which returns an empty string")
})

ow.test.test("nMetricsView.output::narrow terminal width doesn't throw", () => {
	var out = nMetricsView.output(__t9f_rows, { format: "table", caps: { width: 20, height: 24, ansi: false } })
	ow.test.assert(isString(out) && out.length > 0, true, "a very narrow width should still render something (printTable's own wrapping), not throw")
})

ow.test.test("nMetricsView.formatValue::raw values pass through, table/array/map values get a structural summary, null is explicit", () => {
	ow.test.assert(nMetricsView.formatValue(42, "num"), "42", "numbers should be stringified as-is (no unit inference, per spec)")
	ow.test.assert(nMetricsView.formatValue("ok", "str"), "ok", "strings should pass through as-is")
	ow.test.assert(nMetricsView.formatValue(undefined, "num"), "(null)", "an undefined value should be shown explicitly, not as an empty string")
	ow.test.assert(nMetricsView.formatValue(null, "num"), "(null)", "a null value should be shown explicitly")
	ow.test.assert(nMetricsView.formatValue([ 1, 2, 3 ], "tab"), "(3 rows)", "a table-typed array value should get a row-count summary")
	ow.test.assert(nMetricsView.formatValue({ a: 1, b: 2 }, "sta"), "(2 keys)", "a map value should get a key-count summary")
})

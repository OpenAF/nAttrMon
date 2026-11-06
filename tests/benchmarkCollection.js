// Optional observational benchmarks; timings are never pass/fail thresholds.
// Run: openaf -f tests/benchmarkCollection.js
var NATTRMON_HOME = String(__scriptfile).replace(/\\/g, "/").replace(/\/?tests\/benchmarkCollection\.js$/, "")
if (!NATTRMON_HOME) NATTRMON_HOME = "."
ow.loadTest()
load(NATTRMON_HOME + "/tests/autotest/harness.js")
load(NATTRMON_HOME + "/tests/autotest/test_collection_performance.js")
var metrics = [], logs = [], dataset = []
for (var i = 0; i < 2000; i++) {
 metrics.push({name: "host_metric_" + (i % 50), unit: "By", description: "memory bytes", point: {asDouble: i, attributes: [{key: "host", value: {stringValue: "host-" + i}}]}})
 logs.push({timeUnixNano: "1700000000000000000", severityNumber: 17, body: {stringValue: "警告 é memory threshold " + i}, attributes: [{key: "host", value: {stringValue: "host-" + i}}]})
}
;[{signal: "metrics", records: metrics}, {signal: "logs", records: logs}].forEach(item => {
 var before = __remediationOTLP(), after = __remediationOTLP(), start
 before.maxBatchSize = after.maxBatchSize = 500
 start = now(); __remediationLegacyExport(before, item.signal, item.records); var oldMs = now() - start
 start = now(); after._export(item.signal, item.records); var newMs = now() - start
 print("BENCH " + stringify({signal:item.signal, records:2000, oldMs:oldMs, newMs:newMs, equal:compare(before.bodies,after.bodies)},__ ,""))
})
var rows = [], map = {}
for (var i = 0; i < 10000; i++) { var row = {name: "attribute-" + i, val: {count: i, labels: ["one", "two"]}, date: "2026-11-06T00:00:00Z"}; rows.push(row); map[row.name] = row }
var start = now(); for (var i = 0; i < 100; i++) { var oldValue = ow.obj.fromArray2Obj(rows,"name",true)["attribute-" + i] } var oldMs = now() - start
start = now(); for (var i = 0; i < 100; i++) { var newValue = clone(map["attribute-" + i]) } var newMs = now() - start
print("BENCH " + stringify({operation:"DB last value", attributes:10000, queries:100, oldMs:oldMs, newMs:newMs},__,""))
exit(ow.test.getCountFail() ? 1 : 0)

// Collection shapes, independent forwarding filters and retention, without network services.
var __remediationPlug = function(file, name, dependencies) {
	var keys = Object.keys(dependencies || {})
	return (new Function(keys.join(","), "var " + name + ";\n" + io.readFileString(NATTRMON_HOME + "/config/objects/" + file) + "\nreturn " + name)).apply(null, keys.map(k => dependencies[k]))
}

ow.test.test("remediation::Init CH initializes retries before populating channels", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_Init.js")
	var name = "test::init::" + genUUID()
	try {
		var input = new nInput_Init({ CH: [{ name: name, entries: [{ key: { key: "a" }, value: { key: "a", value: 7 } }] }] })
		ow.test.assert($ch(name).get({ key: "a" }).value, 7, "CH entries are created")
		ow.test.assert(input._entryRetries.CH[0].get(), 0, "per-type retry collection exists")
	} finally { $ch(name).destroy() }
})

ow.test.test("remediation::Filesystem resolves channel targets before choosing Kubernetes or SSH", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_Filesystem.js")
	var name = "test::fs::" + genUUID(), oldSec = __nam_getSec, oldPack = getOPackPath, oldLoad = loadLib, oldKube = global.$kube, oldSecret = $sec, oldNm = global.nattrmon
	var resolved = [], kubeCalls = [], sshCalls = []
	$ch(name).create()
	$ch(name).set({ key: "kube" }, { key: "kube", type: "kube", pod: "pod-a", namespace: "ns" })
	$ch(name).set({ key: "ssh" }, { key: "ssh", type: "ssh" })
	try {
		var Input = __remediationPlug("nInput_Filesystem.js", "nInput_Filesystem", {
			__nam_getSec: v => { resolved.push(v.key); return v },
			getOPackPath: () => "/fake", loadLib: () => {}, $sec: () => ({}),
			$kube: () => ({ ns: function(n) { return this }, exec: (pod, cmd) => { kubeCalls.push(pod + ":" + cmd); return "ignored" } }),
			nattrmon: { useObject: (key, fn) => { sshCalls.push(key); fn({ exec: () => "ignored" }) } }
		})
		var input = new Input({ chKeys: name, volumeNames: ["/dev/test"], attrTemplate: "Filesystems" })
		input.__parseCmd = () => [{ volume: "/dev/test" }]
		var result = input.input({}, {}).Filesystems
		ow.test.assert(resolved, ["kube", "ssh"], "both target records reach secret resolution")
		ow.test.assert(kubeCalls, ["pod-a:df -P", "pod-a:df -i -P"], "Kubernetes route executes both commands")
		ow.test.assert(sshCalls, ["ssh"], "SSH object-pool routing stays intact")
		ow.test.assert(result.map(r => r.key), ["kube", "ssh"], "target identity retained")
	} finally {
		global.__nam_getSec = oldSec; global.getOPackPath = oldPack; global.loadLib = oldLoad; global.$kube = oldKube; global.$sec = oldSecret; global.nattrmon = oldNm
		$ch(name).destroy()
	}
})

ow.test.test("remediation::JMX flattens target results and promotes duplicate attribute names", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_JMX.js")
	var name = "test::jmx::" + genUUID()
	$ch(name).create()
	$ch(name).set({ key: "first" }, { url: "unused-a" })
	$ch(name).set({ key: "second" }, { url: "unused-b" })
	try {
		var input = new nInput_JMX({ chKeys: name })
		input.get = data => [{ key: data.key, _attrTemplate: "Shared", count: 1 }, { key: data.key, _attrTemplate: data.key, count: 2 }]
		var result = input.input({}, {})
		ow.test.assert(result.Shared, [{ key: "first", count: 1 }, { key: "second", count: 1 }], "duplicates remain ordered and keep keys")
		ow.test.assert(result.first, { key: "first", count: 2 }, "singleton shape stays a map")
		ow.test.assert(Object.keys(result).indexOf("undefined"), -1, "no nested-array pseudo attribute")
	} finally { $ch(name).destroy() }
})

ow.test.test("remediation::OpenMetrics keeps every renamed series in parser order", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_OpenMetrics.js")
	var input = new nInput_OpenMetrics({}), oldRest = $rest, oldParse = ow.metrics.fromOpenMetrics2Array
	try {
		var Input = __remediationPlug("nInput_OpenMetrics.js", "nInput_OpenMetrics", { $rest: () => ({ get: () => "unused" }) })
		input = new Input({})
		ow.metrics.fromOpenMetrics2Array = () => [
			{ metric: "first_total", labels: { host: "a" }, value: 1 },
			{ metric: "other", labels: {}, value: 5 },
			{ metric: "second_total", labels: { host: "b" }, value: 2 },
			{ metric: "first_total", labels: { host: "c" }, value: 3 },
			{ metric: "ignored", labels: {}, value: 99 }
		]
		var result = input._get({ key: "source", url: "unused", excludePrefix: ["ignored"], replace: [{ pattern: "^(first|second)_", replacement: "" }] })
		ow.test.assert(result.total, [{ key: "source", host: "a", value: 1 }, { key: "source", host: "b", value: 2 }, { key: "source", host: "c", value: 3 }], "renaming collisions preserve every series")
		ow.test.assert(result.other, { key: "source", value: 5 }, "singleton shape retained")
		ow.test.assert(result.ignored, undefined, "existing filtering applies before accumulation")
	} finally { global.$rest = oldRest; ow.metrics.fromOpenMetrics2Array = oldParse }
})

ow.test.test("remediation::RemoteChannel filters each bulk record without source mutation", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_RemoteChannel.js")
	var oldCh = $ch, calls = [], remote = { createRemote: () => {}, setAll: (k, v) => calls.push({ op: "setall", k: clone(k), v: clone(v) }), set: (k, v) => calls.push({ op: "set", k: clone(k), v: clone(v) }), unset: k => calls.push({ op: "unset", k: clone(k) }) }
	try {
		var Output = __remediationPlug("nOutput_RemoteChannel.js", "nOutput_RemoteChannel", { $ch: () => remote })
		var out = new Output({ url: "unused", include: ["first", "blocked", "last"], exclude: ["blocked"], attrTemplate: "Remote/{{id}}" })
		var args = { op: "setall", k: ["name"], v: [{ name: "first", val: 1 }, { name: "missing", val: 2 }, { name: "blocked", val: 3 }, { name: "last", val: 4 }] }, before = clone(args)
		out.output({}, args, { chSubscribe: "test" })
		ow.test.assert(calls[0], { op: "setall", k: ["name"], v: [{ name: "Remote/first", val: 1 }, { name: "Remote/last", val: 4 }] }, "membership at index zero, exclusion and ordering")
		ow.test.assert(args, before, "source keys and values are unchanged")
		out.output({}, { op: "setall", k: ["name"], v: [{ name: "missing" }] }, { chSubscribe: "test" })
		ow.test.assert(calls.length, 1, "empty selection skips remote call")
		out.output({}, { op: "unset", k: { name: "first" } }, { chSubscribe: "test" })
		ow.test.assert(calls[1], { op: "unset", k: { name: "Remote/first" } }, "unset uses the original key without a value")
		var wrapped = new Output({ url: "unused", valueKey: "payload", attrTemplate: "Remote/{{id}}" })
		wrapped.output({}, { op: "set", k: { name: "first" }, v: { name: "first", val: 1 } }, { chSubscribe: "test" })
		ow.test.assert(calls[2].v, { payload: { name: "first", val: 1 }, name: "Remote/first" }, "transformed value is what gets sent")
	} finally { global.$ch = oldCh }
})

ow.test.test("remediation::HK uses stored lastcheck and actual warning titles", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_HK.js")
	var oldNm = global.nattrmon, oldNot = global.__NAM_CHANNEL_WNOTS, oldCh = $ch, removed = [], now = new Date(), old = new Date(Date.now() - 120000)
	var attrs = { getKeys: () => [{ name: "stale" }, { name: "fresh" }], get: k => ({ name: k.name, lastcheck: k.name == "stale" ? old : now }), unset: k => removed.push("attr:" + k.name) }
	var warns = { getAll: () => [{ title: "delete-me", createdate: old }, { title: "keep-me", createdate: old }], unset: k => removed.push("warn:" + k.title) }
	try {
		global.nattrmon = { listOfAttributes: { getCh: () => attrs }, currentValues: { getKeys: () => [], get: () => undefined, unset: k => removed.push("current:" + k.name) }, lastValues: { unset: k => removed.push("last:" + k.name) }, listOfWarnings: { getCh: () => warns }, chNotifications: "notified" }
		global.__NAM_CHANNEL_WNOTS = {}
		var Output = __remediationPlug("nOutput_HK.js", "nOutput_HK", { $ch: () => ({ unset: k => removed.push("notification:" + k.title) }) })
		new Output({ attributeDeleteAfter: 1 }).output({}, {})
		new Output({ warningDeleteAfter: 1, include: ["^delete"] }).output({}, {})
		ow.test.assert(removed, ["attr:stale", "current:stale", "last:stale", "warn:delete-me", "notification:delete-me"], "lastcheck and title filters delete from original destinations")
	} finally { global.nattrmon = oldNm; global.__NAM_CHANNEL_WNOTS = oldNot; global.$ch = oldCh }
})


ow.test.test("remediation::JMX preserves prototype-named attributes as own result properties", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_JMX.js")
	var input = new nInput_JMX({ objects: [] })
	input.get = () => [{ key: "one", _attrTemplate: "__proto__", count: 1 }]
	var singleton = input.input({}, {})
	ow.test.assert(Object.keys(singleton), ["__proto__"], "prototype-named singleton is an enumerable result")
	ow.test.assert(singleton["__proto__"], { key: "one", count: 1 }, "singleton keeps its normal value shape")
	ow.test.assert(Object.getPrototypeOf(singleton) === Object.prototype, true, "result remains an ordinary map")
	input.get = () => [{ key: "one", _attrTemplate: "__proto__", count: 1 }, { key: "two", _attrTemplate: "__proto__", count: 2 }]
	var repeated = input.input({}, {})
	ow.test.assert(repeated["__proto__"], [{ key: "one", count: 1 }, { key: "two", count: 2 }], "prototype-named duplicates retain target order")
	ow.test.assert(Object.getPrototypeOf(repeated) === Object.prototype, true, "aggregation does not change the prototype")
})

ow.test.test("remediation::OpenMetrics preserves prototype-named series as own result properties", () => {
	var Input = __remediationPlug("nInput_OpenMetrics.js", "nInput_OpenMetrics", { $rest: () => ({ get: () => "unused" }) })
	var input = new Input({}), original = ow.metrics.fromOpenMetrics2Array
	try {
		ow.metrics.fromOpenMetrics2Array = () => [{ metric: "__proto__", labels: { host: "one" }, value: 1 }]
		var singleton = input._get({ key: "source", url: "unused" })
		ow.test.assert(Object.keys(singleton), ["__proto__"], "prototype-named singleton is an enumerable metric")
		ow.test.assert(singleton["__proto__"], { key: "source", host: "one", value: 1 }, "singleton keeps labels and value")
		ow.test.assert(Object.getPrototypeOf(singleton) === Object.prototype, true, "result remains an ordinary map")
		ow.metrics.fromOpenMetrics2Array = () => [{ metric: "__proto__", labels: { host: "one" }, value: 1 }, { metric: "__proto__", labels: { host: "two" }, value: 2 }]
		var repeated = input._get({ key: "source", url: "unused" })
		ow.test.assert(repeated["__proto__"], [{ key: "source", host: "one", value: 1 }, { key: "source", host: "two", value: 2 }], "prototype-named duplicates retain series order")
		ow.test.assert(Object.getPrototypeOf(repeated) === Object.prototype, true, "aggregation does not change the prototype")
	} finally { ow.metrics.fromOpenMetrics2Array = original }
})

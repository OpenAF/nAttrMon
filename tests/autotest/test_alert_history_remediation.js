// Delivery acknowledgement, transaction retry and grouped-duration regressions.
load(NATTRMON_HOME + "/config/objects/nOutput_EmailWarnings.js")
load(NATTRMON_HOME + "/config/objects/nValidation_Generic.js")
load(NATTRMON_HOME + "/config/objects/nOutput_H2.js")
load(NATTRMON_HOME + "/config/objects/nOutput_PostgreSQL.js")
load(NATTRMON_HOME + "/config/objects/nOutput_Oracle.js")

var __emailFixture = function() {
	var rows = [ { title: "A", level: "High", description: "Something has failed", date: new Date() } ];
	var marks = {}, calls = [], fixture = { rows: rows, marks: marks, calls: calls };
	var scope = harness.stubNattrmon({
		getWarnings: raw => raw ? { getCh: () => ({ getAll: () => rows }) } : { High: rows },
		isNotified: (title, id) => !!marks[title + "|" + id],
		setNotified: (title, id) => { calls.push([title, id]); marks[title + "|" + id] = true; return true },
		getConfigPath: () => NATTRMON_HOME + "/config"
	});
	var output = Object.create(nOutput_EmailWarnings.prototype);
	nOutput.call(output, output.output);
	output.first = false; output.lock = false; output.custom = ""; output.subject = "Test";
	output.mailserver = "example.invalid"; output.from = "a@example.invalid"; output.addresses = ["b@example.invalid"];
	output.warnTypes = ["High"]; output.warnTypesShow = ["High"]; output.templateImages = {};
	output.htmlTemplate = (name, data) => { fixture.data = data; return "body" };
	fixture.output = output;
	fixture.run = () => output.output(scope, { op: "set", v: rows[0] }, { chSubscribe: "nattrmon::warnings", aName: "email-test" });
	return fixture;
};

ow.test.test("Email::failed send and preparation remain retryable and release the guard", () => {
	var saved = global.Email, fixture = __emailFixture(), attempts = 0;
	global.Email = function() { this.setHTML = () => {}; this.send = () => { attempts++; if (attempts == 1) throw "send failed" } };
	try {
		var failed = false;
		try { fixture.run() } catch(e) { failed = true }
		ow.test.assert(failed, true, "send error propagates");
		ow.test.assert(fixture.calls.length, 0, "failed sends acknowledge nothing");
		ow.test.assert(fixture.output.lock, false, "send failure releases guard");
		fixture.run();
		ow.test.assert(fixture.calls.length, 1, "next invocation acknowledges successful delivery");
		fixture.run();
		ow.test.assert(attempts, 2, "acknowledged warnings are not sent again");
		fixture = __emailFixture(); fixture.output.htmlTemplate = () => { throw "template failed" };
		try { fixture.run() } catch(e) {}
		ow.test.assert(fixture.calls.length, 0, "preparation acknowledges nothing");
		ow.test.assert(fixture.output.lock, false, "preparation failure releases guard");
	} finally { global.Email = saved }
});

ow.test.test("Email::guard covers send and acknowledgement while staging similarity marks", () => {
	var saved = global.Email, fixture = __emailFixture(), sends = 0;
	fixture.rows.push({ title: "B", level: "High", description: "Something has failed", date: new Date() });
	fixture.output.groupBySimilarity = 20;
	fixture.output.alertUntilBySimilarity = 1;
	global.Email = function() {
		this.setHTML = () => {};
		this.send = () => {
			sends++;
			ow.test.assert(fixture.calls.length, 0, "no persistent marks during delivery");
			fixture.run();
		};
	};
	try {
		fixture.run();
		ow.test.assert(sends, 1, "overlapping invocation cannot send");
		ow.test.assert(fixture.data.warns[0].list.map(w => w.title), ["A"], "later sibling observes staged similarity state");
		ow.test.assert(fixture.rows[0].extraMessage, __, "preparation keeps source warning untouched");
		ow.test.assert(fixture.output.lock, false, "guard releases after acknowledgement");
	} finally { global.Email = saved }
});

var __historyFixture = function(Constructor, oracle) {
	var fixture = { inserts: 0, committed: 0, staged: 0, insertFailure: false, commitFailure: false, retentionFailure: false };
	var value = { name: "A", val: 1, date: new Date(1000) };
	var attrs = { A: { name: "A", description: "A", lastcheck: new Date(2000) } };
	var db = {
		u: () => {}, qs: () => ({ results: [{ TABLE_NAME: "ATTRIBUTES" }, { TABLE_NAME: "ATTRIBUTES_VALUES" }] }),
		us: (sql, params) => {
			if (/^insert into attribute_values|^insert into ATTRIBUTES_VALUES/.test(sql)) {
				fixture.inserts++;
				if (fixture.insertFailure) { fixture.insertFailure = false; throw "insert failed" }
				fixture.staged++;
			}
		},
		commit: () => { if (fixture.commitFailure) { fixture.commitFailure = false; throw "commit failed" } fixture.committed += fixture.staged; fixture.staged = 0 },
		rollback: () => { fixture.staged = 0 }, close: () => {}
	};
	var scope = harness.stubNattrmon({
		getAttributes: raw => raw ? Object.keys(attrs).map(key => attrs[key]) : { getAttributeByName: name => attrs[name] },
		getCurrentValues: raw => raw ? { get: key => value } : { A: value },
		declareMonitoredObjectDirty: () => {}, getMonitoredObject: () => db
	});
	var output = Object.create(Constructor.prototype);
	nOutput.call(output, output.output);
	output.firstTime = {}; output.db = db;
	output.tablesNames = { attribute: "ATTRIBUTES", values: "ATTRIBUTES_VALUES" };
	output.connect = () => db;
	output.rolldata = () => { if (fixture.retentionFailure) throw "retention failed" };
	fixture.output = output; fixture.value = value;
	fixture.run = onlyOnEvent => output.output(scope, { k: { name: "A" }, onlyOnEvent: onlyOnEvent });
	return fixture;
};

;[nOutput_H2, nOutput_PostgreSQL, nOutput_Oracle].forEach(Constructor => {
	ow.test.test(Constructor.name + "::history acknowledges only data commits and preserves retry eligibility", () => {
		var f = __historyFixture(Constructor);
		f.insertFailure = true; f.run(true);
		ow.test.assert(f.output.firstTime.A, __, "insert failure remains unseen");
		f.commitFailure = true; f.run(true);
		ow.test.assert(f.output.lastSeen.A, __, "failed commit leaves timestamp unchanged");
		f.run(true);
		ow.test.assert(f.committed, 1, "retry commits initial value once");
		var inserts = f.inserts;
		f.run(true);
		ow.test.assert(f.inserts, inserts, "same committed timestamp is skipped");
		f.value.date = new Date(3000); f.commitFailure = true; f.run(true);
		ow.test.assert(f.output.lastSeen.A, 1000, "changed timestamp is not acknowledged before commit");
		f.retentionFailure = true; f.run(true);
		ow.test.assert(f.output.lastSeen.A, 3000, "retention failure keeps already committed timestamp");
		inserts = f.inserts; f.run(true);
		ow.test.assert(f.inserts, inserts, "retention failure does not duplicate committed history");
		f.retentionFailure = false; f.run(false); f.run(false);
		ow.test.assert(f.committed, 4, "onlyOnEvent false inserts every invocation");
	});
});

var __timedFixture = function(extraChecks) {
	var f = { rows: [ { name: "A", val: [{ bad: true, id: "one" }, { bad: false, id: "two" }], date: new Date(1000) } ], reads: 0, closed: [] };
	var scope = harness.stubNattrmon({
		fromTimeAbbreviation: value => Number(String(value).replace("s", "")) * 1000,
		getCurrentValues: () => { f.reads++; if (f.failRead) throw "snapshot failed"; return f.rows }
	});
	var check = { attrPattern: "^[AB]$", expr: "{{value.bad}}", for: "1s", warnLevel: "HIGH", warnTitleTemplate: "Shared", warnDescTemplate: "{{name}}/{{value.id}}" };
	f.validator = new nValidation_Generic({ checks: [check].concat(extraChecks || []) });
	f.validator.closeWarning = title => { f.closed.push(title); return [] };
	f.scope = scope;
	f.setAge = ms => Object.keys(f.validator.__timedGroups).forEach(key => { f.validator.__timedGroups[key].since = nowUTC() - ms });
	f.run = args => f.validator.validate([], scope, args || { op: "set", k: { name: "A" }, v: f.rows[0] });
	return f;
};

ow.test.test("Generic timed::healthy siblings and partial/reordered events preserve grouped duration", () => {
	{
		var f = __timedFixture();
		ow.test.assert(f.run().length, 0, "first failure begins timer");
		f.rows.push({ name: "B", val: [{ bad: true, id: "three" }], date: new Date(1000) });
		f.setAge(500); f.rows[0].val.reverse();
		ow.test.assert(f.run({ op: "set", k: { name: "A" }, v: { name: "A", val: [{ bad: false }] } }).length, 0, "partial healthy event cannot reset authoritative group");
		f.setAge(1500);
		var result = f.run();
		ow.test.assert(result.map(w => w.description), ["A/one", "B/three"], "expired group renders each failing row in snapshot order");
		ow.test.assert(f.closed.length, 0, "healthy siblings never close failing group");
		ow.test.assert(f.reads, 3, "one authoritative read per trigger");
		f.rows[0].val = [{ bad: false, id: "one" }]; f.rows[1].val = [{ bad: false, id: "three" }];
		f.run(); f.run();
		ow.test.assert(f.closed, ["Shared"], "healthy group closes once");
	}
});

ow.test.test("Generic timed::removals prune groups and failed snapshots preserve state", () => {
	{
		var f = __timedFixture(); f.run();
		var before = stringify(f.validator.__timedGroups);
		f.failRead = true; var failed = false;
		try { f.run() } catch(e) { failed = true }
		ow.test.assert(failed, true, "source read error is visible");
		ow.test.assert(stringify(f.validator.__timedGroups), before, "failed read does not mutate timer state");
		f.failRead = false; f.setAge(1500);
		ow.test.assert(f.run().length, 1, "recovered source retains original elapsed time");
		f.rows = []; f.run({ op: "unset", k: { name: "A" } });
		ow.test.assert(Object.keys(f.validator.__timedGroups).length, 0, "absent groups are pruned");
		ow.test.assert(f.closed, ["Shared"], "removed group closes once");
		f.run({ op: "unsetall", k: ["name"], v: [] });
		ow.test.assert(f.closed.length, 1, "repeated removal does not close again");
	}
});

ow.test.test("Generic timed::instances, check identities and rendered titles have independent timers", () => {
	{
		var a = __timedFixture(), b = __timedFixture(); a.run();
		a.setAge(1500);
		ow.test.assert(a.run().length, 1, "first instance duration expired");
		ow.test.assert(b.run().length, 0, "second instance starts independently");
		var f = __timedFixture([{ attribute: "A", expr: "{{value.bad}}", for: "2s", warnTitleTemplate: "{{value.id}}", warnDescTemplate: "row" }]);
		f.run(); f.setAge(1500);
		ow.test.assert(f.run().map(w => w.title), ["Shared"], "second check keeps its longer independent duration");
		f.setAge(2500);
		ow.test.assert(f.run().map(w => w.title), ["Shared", "one"], "rendered title and check identity preserve separate groups");
	}
});

ow.test.test("Generic timed::concurrent reconciliation is serialized per instance", () => {
	var f = __timedFixture(), attempts = new java.util.concurrent.CountDownLatch(2);
	var active = new java.util.concurrent.atomic.AtomicInteger(0), peak = new java.util.concurrent.atomic.AtomicInteger(0);
	f.scope.getCurrentValues = () => {
		var n = active.incrementAndGet(); peak.set(Math.max(peak.get(), n));
		try { if (!attempts.await(3, java.util.concurrent.TimeUnit.SECONDS)) throw "concurrent calls did not start"; return f.rows }
		finally { active.decrementAndGet() }
	};
	pForEach([1, 2], () => { attempts.countDown(); return f.run().length }, e => { throw e });
	ow.test.assert(peak.get(), 1, "snapshots never overlap on the same validator");
	ow.test.assert(Object.keys(f.validator.__timedGroups).length, 1, "concurrent triggers share one timer group");
});

ow.test.test("Generic timed::channel domains and buffer snapshots remain independent", () => {
	var one = "timed-one-" + genUUID(), two = "timed-two-" + genUUID();
	$ch(one).create(); $ch(two).create();
	try {
		var f = __timedFixture();
		$ch(one).set({ name: "A" }, f.rows[0]); $ch(two).set({ name: "A" }, f.rows[0]);
		f.run({ ch: one, op: "set", k: { name: "A" }, v: f.rows[0] }); f.setAge(1500);
		ow.test.assert(f.run({ ch: one + "::buffer", op: "set", k: { name: "A" }, v: f.rows[0] }).length, 1, "buffer uses authoritative source domain");
		ow.test.assert(f.run({ ch: two, op: "set", k: { name: "A" }, v: f.rows[0] }).length, 0, "other source starts a separate group");
		ow.test.assert(f.reads, 0, "configured channels are read directly");
	} finally { $ch(one).destroy(); $ch(two).destroy() }
});

ow.test.test("Generic timed::scheduled checks share one snapshot and healing follows failing row order", () => {
	var f = __timedFixture([{ attribute: "A", expr: "{{value.bad}}", warnTitleTemplate: "Immediate {{value.id}}", warnDescTemplate: "Immediate" }]);
	f.rows[0].val = [{ bad: true, id: "one" }, { bad: false, id: "two" }, { bad: true, id: "three" }];
	f.scope.isNotified = () => __; f.scope.setNotified = () => false;
	f.validator.params.checks[0].healing = { exec: "record", execArgs: { id: "{{value.id}}" } };
	var healed = [];
	f.validator.__getFn = source => args => healed.push(args.id);
	f.run({});
	ow.test.assert(f.reads, 1, "scheduled mixed checks share a single current-values snapshot");
	f.setAge(1500);
	var result = f.run({});
	ow.test.assert(f.reads, 2, "next invocation refreshes the snapshot once");
	ow.test.assert(healed, ["one", "three"], "healing runs only for failing rows in source order");
	ow.test.assert(result.map(w => w.title), ["Shared", "Shared", "Immediate one", "Immediate three"], "timed rows render individually and untimed scheduled checks remain active");
});

ow.test.test("Email::in-flight guards are isolated between constructor instances", () => {
	var saved = global.Email, first = __emailFixture(), second = __emailFixture(), sends = 0;
	global.Email = function() {
		this.setHTML = () => {};
		this.send = () => { sends++; if (sends == 1) second.run() };
	};
	try {
		first.run();
		ow.test.assert(sends, 2, "one instance does not suppress another instance's delivery");
		ow.test.assert(first.output.lock || second.output.lock, false, "both instance guards release");
	} finally { global.Email = saved }
});

ow.test.test("Generic timed::exec serializes reconciliation through the warning commit", () => {
	var f = __timedFixture(); f.run(); f.setAge(1500);
	f.validator.closeWarning = nValidation.prototype.closeWarning;
	var firstCommit = new java.util.concurrent.CountDownLatch(1), secondAttempt = new java.util.concurrent.CountDownLatch(1);
	var secondDone = new java.util.concurrent.CountDownLatch(1), secondThread = new java.util.concurrent.atomic.AtomicReference();
	var blockedByFirst = new java.util.concurrent.atomic.AtomicBoolean(false), readCount = new java.util.concurrent.atomic.AtomicInteger(0);
	var current;
	f.scope.getCurrentValues = () => {
		return [{ name: "A", val: [{ bad: readCount.incrementAndGet() == 1, id: "one" }], date: new Date(1000) }];
	};
	f.scope.getWarnings = () => isDef(current) ? { High: [current] } : {};
	f.scope.setWarnings = warnings => {
		if (warnings.length == 0) return;
		if (warnings[0].level == "High") {
			firstCommit.countDown();
			if (!secondAttempt.await(3, java.util.concurrent.TimeUnit.SECONDS)) throw "second exec did not start";
			var owner = java.lang.Thread.currentThread().getId();
			var bean = java.lang.management.ManagementFactory.getThreadMXBean(), deadline = nowUTC() + 3000;
			while (secondDone.getCount() > 0 && nowUTC() < deadline) {
				var info = bean.getThreadInfo(secondThread.get().getId());
				if (isDef(info) && String(info.getThreadState()) == "BLOCKED" && info.getLockOwnerId() == owner) {
					blockedByFirst.set(true); break;
				}
				sleep(1, true);
			}
		}
		current = warnings[0];
	};
	pForEach([1, 2], order => {
		if (order == 2) {
			if (!firstCommit.await(3, java.util.concurrent.TimeUnit.SECONDS)) throw "first exec did not reach commit";
			secondThread.set(java.lang.Thread.currentThread()); secondAttempt.countDown();
		}
		try { return f.validator.exec(f.scope, { op: "set", k: { name: "A" }, v: f.rows[0] }, { aName: "timed" }) }
		finally { if (order == 2) secondDone.countDown() }
	}, e => { throw e });
	ow.test.assert(blockedByFirst.get(), true, "newer reconciliation waits until the older warning commit completes");
	ow.test.assert(current.level, "Closed", "the newer healthy snapshot remains authoritative after both commits");
});

;[nOutput_H2, nOutput_PostgreSQL, nOutput_Oracle].forEach(Constructor => {
	ow.test.test(Constructor.name + "::history reads the real engine's channel-backed attribute metadata", () => {
		var f = __historyFixture(Constructor), nm = harness.newEngine({}, { name: "history-metadata" });
		try {
			nm.addValues(false, { attributes: { A: 42, Other: 7 } });
			f.output.attrToInclude = ["A"];
			ow.test.assert(isUnDef(nm.getAttributes().attributes), true, "engine metadata has no legacy attributes property");
			f.output.output(nm, { k: { name: "A" }, onlyOnEvent: true });
			ow.test.assert(f.committed, 1, "current value is committed using public metadata accessors");
			ow.test.assert(f.output.lastSeen.A, new Date(nm.getCurrentValues(true).get({ name: "A" }).date).getTime(), "committed timestamp matches actual channel value");
			f.output.output(nm, { k: { name: "A" }, onlyOnEvent: true });
			ow.test.assert(f.committed, 1, "unchanged channel value is not duplicated");
		} finally { harness.stopEngine(nm) }
	});
});

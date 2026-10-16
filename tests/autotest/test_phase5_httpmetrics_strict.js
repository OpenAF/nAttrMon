// Exercise response assembly through captured HTTP routes without opening sockets.
ow.test.test("nOutput_HTTP_Metrics::strict routes and legacy compatibility", () => {
	ow.loadServer(); ow.loadMetrics();
	load(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Metrics.js");
	var original = ow.server.httpd, routes, nm;
	ow.server.httpd = {
		start: port => ({ getPort: () => port, stop: () => {} }),
		getPrefix: () => "/",
		route: (h, r) => { routes = r; },
		mapWithExistingRoutes: (h, r) => r,
		mapRoutesWithLibs: (h, r) => r,
		reply: (data, status, mimetype) => ({ data: data, status: status, mimetype: mimetype })
	};
	try {
		nm = harness.newEngine({}, { name: "strictmetrics" });
		nm.getHttpPreProcessFn = () => (req, response) => response;
		nm.getCurrentValues = () => ({ a: { name: "temperature", val: [{ zone: "a\n\"\\", value: 2 }, { zone: "b", value: 3 }], date: "2026-01-01T00:00:00Z" } });
		nm.getDegradedPlugs = () => ({ total: 1, thresholds: {}, degraded: [{ type: "input", category: "test", name: "plug\nname", reasons: [] }] });
		var output = new nOutput_HTTP_Metrics({ includeWarns: false });
		var legacy = routes["/metrics"]({ params: { type: "cvals" } });
		ow.test.assert(legacy.status, 200, "legacy scrape succeeds");
		ow.test.assert(legacy.mimetype, "text/plain", "legacy content type is preserved");
		if (!isFunction(ow.metrics._fromObj2OpenMetricsStrict)) {
			ow.test.assert(routes["/metrics"]({ params: { format: "openmetrics" } }).status, 500, "unsupported runtimes fail explicitly");
		} else {
			var strict = routes["/metrics"]({ params: { format: "openmetrics", type: "cvals" } });
			ow.test.assert(strict.status, 200, "strict scrape succeeds");
			ow.test.assert(strict.mimetype, "application/openmetrics-text; version=1.0.0; charset=utf-8", "strict content type");
			ow.test.assert(strict.data.indexOf(" 1767225600\n") >= 0, true, "timestamps use seconds");
			ow.test.assert(strict.data.indexOf('nattrmon_id="0"') >= 0, true, "array IDs survive");
			ow.test.assert(strict.data.split("# EOF").length, 2, "one EOF for entire response");
			ow.test.assert(strict.data.endsWith("# EOF\n"), true, "EOF is final");
			var combined = routes["/metrics"]({ params: { format: "openmetrics" } });
			ow.test.assert(combined.status, 200, "combined attributes and diagnostics succeed");
			ow.test.assert(combined.data.split("# EOF").length, 2, "combined response has one EOF");
			output.useCurrentTime = true;
			var current = routes["/metrics"]({ params: { format: "openmetrics", type: "cvals" } });
			var timestamp = Number(current.data.split("\n").filter(line => line.indexOf("nattrmon_temperature_value{") == 0)[0].split(" ").pop());
			ow.test.assert(Math.abs(timestamp - Date.now() / 1000) < 5, true, "scrape timestamps use seconds");
			var diag = routes["/diagnostics"]({ params: { format: "openmetrics" } });
			ow.test.assert(diag.status, 200, "diagnostics is strict");
			ow.test.assert(diag.data.indexOf('name="plug\\nname"') >= 0, true, "diagnostic newlines are escaped");
		}
		output.findAndReplace = [{ find: "x", replace: "y" }];
		ow.test.assert(routes["/metrics"]({ params: { format: "openmetrics" } }).status, 500, "unsafe replacements fail");
	} finally {
		if (nm) harness.stopEngine(nm);
		ow.server.httpd = original;
	}
});

ow.test.test("nOutput_HTTP_Metrics::strict assembly groups families and rejects collisions", () => {
	load(NATTRMON_HOME + "/config/objects/nOutput_HTTP_Metrics.js");
	var output = Object.create(nOutput_HTTP_Metrics.prototype);
	var text = output.__strictExposition(['# TYPE a unknown\na{x="1"} 1\n# EOF\n', 'b 2\na{x="2"} 3\n# EOF\n']);
	ow.test.assert(text, '# TYPE a unknown\na{x="1"} 1\na{x="2"} 3\n# TYPE b unknown\nb 2\n# EOF\n', "families are contiguous");
	[ ['a{x="1",y="2"} 1', 'a{y="2",x="1"} 2'], ['a{x="1",x="2"} 1'], ['a 1\r'], ['a Infinity'] ].forEach(parts => {
		var rejected = false;
		try { output.__strictExposition(parts); } catch(e) { rejected = true; }
		ow.test.assert(rejected, true, "invalid or duplicate series rejected");
	});
});

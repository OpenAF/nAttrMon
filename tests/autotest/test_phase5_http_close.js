// Phase 5.3 -- #24: nOutput_HTTP.js's close() referenced constructor-local
// `hS` (and undefined `hs`/`e`) -> ReferenceError, so the HTTP server was
// never actually stopped on reload. Multiple output plugs (JSON, Channels,
// Metrics, HealthZ) can share one httpd session, and a same-port reload
// reuses the existing server rather than restarting it (the replacement
// instance is constructed BEFORE the old one's close() runs) -- so close()
// must only stop a server the session no longer points at (orphaned by a
// port-change reload), never the still-shared/active one.
//
// ow.server.httpd is replaced with an in-memory fake (no real sockets) so
// this stays hermetic; restored after each test.

var __withFakeHttpd = (fn) => {
	ow.loadServer()
	var _orig = ow.server.httpd
	var _servers = []
	var makeFakeServer = (port) => {
		var s = { port: port, stopped: false }
		s.getPort = () => s.port
		s.stop = () => { s.stopped = true }
		_servers.push(s)
		return s
	}
	ow.server.httpd = {
		start: (port) => makeFakeServer(port || 8090),
		getPrefix: () => "/",
		route: () => {},
		mapWithExistingRoutes: (h, routes) => routes,
		mapRoutesWithLibs: (h, routes) => routes,
		replyFile: () => ({}),
		reply: () => ({}),
		codes: { UNAUTHORIZED: 401 },
		authBasic: () => ({})
	}
	try {
		fn()
	} finally {
		ow.server.httpd = _orig
	}
}

ow.test.test("nOutput_HTTP::close() does not throw and does not stop a still-shared server (same-port reload)", () => {
	__withFakeHttpd(() => {
		load(NATTRMON_HOME + "/config/objects/nOutput_HTTP.js")
		var nm = harness.newEngine({}, { name: "httpclose1" })

		var o1 = new nOutput_HTTP({ port: 8090, title: "T1" })
		// Same-port reload: the replacement instance is constructed first and reuses the
		// existing session server (does not restart it)
		var o2 = new nOutput_HTTP({ port: 8090, title: "T2" })
		ow.test.assert(o2.httpd === o1.httpd, true, "a same-port reload should reuse the existing server, not start a new one")

		o1.close()
		ow.test.assert(o1.httpd.stopped, false, "close() on the replaced instance must not stop the still-shared/active server")
		ow.test.assert(nm.getSessionData(o1.hS) === o2.httpd, true, "the session should still point at the (still running) shared server")

		harness.stopEngine(nm)
	})
})

ow.test.test("nOutput_HTTP::close() stops a server orphaned by a port-change reload", () => {
	__withFakeHttpd(() => {
		load(NATTRMON_HOME + "/config/objects/nOutput_HTTP.js")
		var nm = harness.newEngine({}, { name: "httpclose2" })

		var o1 = new nOutput_HTTP({ port: 8090, title: "T1" })
		// Port-change reload: the constructor starts a NEW server and repoints the session,
		// orphaning o1's server
		var o2 = new nOutput_HTTP({ port: 9090, title: "T2" })
		ow.test.assert(o2.httpd === o1.httpd, false, "a port-change reload should start a distinct server")

		o1.close()
		ow.test.assert(o1.httpd.stopped, true, "close() must stop a server the session no longer points at")
		ow.test.assert(o2.httpd.stopped, false, "the new, still-active server must not be affected")

		harness.stopEngine(nm)
	})
})

ow.test.test("nOutput_HTTP::the custom-auth handler is compiled once and works correctly across requests", () => {
	ow.loadServer()
	var _orig = ow.server.httpd
	var _capturedCheck
	var _capturedRoutes
	ow.server.httpd = {
		start: (port) => ({ port: port || 8090, getPort() { return this.port }, stop() {} }),
		getPrefix: () => "/",
		route: (h, routes) => { _capturedRoutes = routes },
		mapWithExistingRoutes: (h, routes) => routes,
		mapRoutesWithLibs: (h, routes) => routes,
		replyFile: () => ({}),
		reply: () => ({}),
		codes: { UNAUTHORIZED: 401 },
		authBasic: (realm, httpd, req, checkFn, onSuccess, onFailure) => {
			_capturedCheck = checkFn
			return onSuccess()
		}
	}

	try {
		load(NATTRMON_HOME + "/config/objects/nOutput_HTTP.js")
		var nm = harness.newEngine({}, { name: "httpauth" })

		global.__authCallCount = 0
		var o = new nOutput_HTTP({
			port: 8090,
			title: "T1",
			authType: "basic",
			authLocal: {}, // preProcess only enters the auth branch when hauth_perms is defined
			authCustom: "global.__authCallCount++; return (u == 'nattrmon' && p == 'nattrmon');"
		})

		// Drive an actual route handler (registered via ow.server.httpd.route) to reach
		// preProcess() -> authBasic() -> the compiled custom-auth handler, twice
		var handler = _capturedRoutes["/f"]
		handler({ uri: "/f", header: {} })
		ow.test.assert(isDef(_capturedCheck), true, "the request should have reached authBasic")

		var ok1 = _capturedCheck("nattrmon", "nattrmon", {}, {})
		var ok2 = _capturedCheck("nattrmon", "wrongpass", {}, {})
		handler({ uri: "/f", header: {} })

		ow.test.assert(ok1, true, "correct credentials should authenticate via the compiled custom-auth handler")
		ow.test.assert(ok2, false, "incorrect credentials should be rejected")
		ow.test.assert(global.__authCallCount, 2, "the compiled handler should have run once per checked credential pair")

		harness.stopEngine(nm)
	} finally {
		ow.server.httpd = _orig
		delete global.__authCallCount
	}
})

// Phase 5.1 -- #22: nInput_JMX.js created a brand new JMX connection per MBean
// object per run (7 connections/run with the default object list), never
// closed -- the worst resource leak found. The openaf.plugins.JMX Java class
// has no exposed close/disconnect method (verified: only getClassName,
// newJMX, getObject, getJavaServerConnection, getLocals, attach2Local are
// public), so the fix caches one connection per url|user instead of
// creating (and leaking) a new one every time, and close() drops the cache
// on plug reload/removal.
//
// The real JMX Java class isn't exercised here (no live JMX server in a
// hermetic test) -- global.JMX is replaced with a counting stub AFTER
// constructing nInput_JMX (whose constructor calls plugin("JMX"), which would
// otherwise overwrite the stub back to the real class).

ow.test.test("nInput_JMX::get() reuses one connection per url|user across MBean objects and runs", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_JMX.js")

	var input = new nInput_JMX({ objects: [ { object: "test:type=A" }, { object: "test:type=B" } ] })

	var constructCount = 0
	global.JMX = function(url, user, pass, provider) {
		constructCount++
		this.getObject = function(objName) {
			return {
				getAttributes: function() { return { attributes: [ { name: "Foo" } ] } },
				get: function(name) { return "bar" }
			}
		}
	}

	var res1 = input.get({ url: "service:jmx:test", user: "u1" })
	ow.test.assert(constructCount, 1, "a single get() call with 2 configured MBean objects should open only one connection")
	ow.test.assert(res1.length, 2, "both configured MBean objects should still be queried over the one shared connection")

	input.get({ url: "service:jmx:test", user: "u1" })
	ow.test.assert(constructCount, 1, "a second get() call with the same url/user should reuse the cached connection")

	input.get({ url: "service:jmx:test", user: "u2" })
	ow.test.assert(constructCount, 2, "a different user should get its own cached connection, not reuse another user's")

	input.close()
	input.get({ url: "service:jmx:test", user: "u1" })
	ow.test.assert(constructCount, 3, "close() must drop the cache so the next get() call reconnects")
})

ow.test.test("nInput_JMX::get() drops a cached connection that fails for every configured object", () => {
	load(NATTRMON_HOME + "/config/objects/nInput_JMX.js")

	var input = new nInput_JMX({ objects: [ { object: "test:type=A" } ] })

	var constructCount = 0
	var shouldFail = false
	global.JMX = function(url, user, pass, provider) {
		constructCount++
		this.getObject = function(objName) {
			if (shouldFail) throw "connection is dead"
			return {
				getAttributes: function() { return { attributes: [ { name: "Foo" } ] } },
				get: function(name) { return "bar" }
			}
		}
	}

	input.get({ url: "service:jmx:test", user: "u1" })
	ow.test.assert(constructCount, 1, "the first call should open a connection")

	shouldFail = true
	input.get({ url: "service:jmx:test", user: "u1" })
	ow.test.assert(constructCount, 1, "a failing call still reuses the existing (not-yet-known-dead) connection")

	input.get({ url: "service:jmx:test", user: "u1" })
	ow.test.assert(constructCount, 2, "after a total failure the dead connection should have been dropped, so this call reconnects")
})

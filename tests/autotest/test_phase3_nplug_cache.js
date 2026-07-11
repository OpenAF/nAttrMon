// Phase 3 -- #14: nPlug must compile execPre/execPos with `new Function` at
// most once per plug instance (not on every exec()) and must not mutate
// this.aExecPre in place.

ow.test.test("nplug::execPre/execPos are compiled once and reused across exec() calls", () => {
	harness.stubNattrmon()
	var calls = []
	var p = new nPlug({
		name: "p1",
		execPre: "args.seen = (args.seen || 0) + 1; return args",
		execPos: "return value + '-' + args.seen"
	}, {}, { exec: function(aScope, args) { calls.push(args.seen); return "v" } })

	var origAExecPre = p.aExecPre

	var r1 = p.exec({}, {})
	ow.test.assert(p.aExecPre, origAExecPre, "aExecPre must not be mutated in place")
	var fnAfterFirst = p.__fnExecPre
	ow.test.assert(isDef(fnAfterFirst), true, "execPre should be compiled after first exec")

	var r2 = p.exec({}, {})
	ow.test.assert(p.__fnExecPre === fnAfterFirst, true, "the compiled execPre function should be reused, not recompiled")
	ow.test.assert(calls, [1, 1], "execPre should run before every exec, incrementing the per-call args")
	ow.test.assert(r2, "v-1", "execPos should combine the plug result with the execPre-derived arg")

	$ch(p.chPlugs).destroy()
})

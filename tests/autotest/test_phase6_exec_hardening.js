// Phase 6 -- dynamic exec hardening without breaking compatibility:
// - inline YAML/JSON exec snippets are compiled once per type/source and cached
// - execFrom resolves plain constructor identifiers without eval
// - eval fallback can be disabled and unresolved expressions fail gracefully

ow.test.test("nmain::getInlineExecFn caches compiled inline functions per type/source", () => {
	var nm = harness.newEngine({}, { name: "inlexec-cache" })

	var src = "return { ok: true }"
	var f1 = nm.getInlineExecFn("input", src)
	var f2 = nm.getInlineExecFn("input", src)
	ow.test.assert(f1 === f2, true, "same type/source should reuse the cached compiled function")

	for (var i = 0; i < 130; i++) {
		nm.getInlineExecFn("input", "return { v: " + i + " }")
	}
	ow.test.assert(Object.keys(nm.__inlineExecFnCache).length <= 128, true, "inline exec cache must be bounded")

	harness.stopEngine(nm)
})

ow.test.test("nmain::resolveExecFromCtor resolves plain constructor names even when eval fallback is disabled", () => {
	var nm = harness.newEngine({}, { name: "execfrom-resolve" })

	global.nInput_TestCtor_Resolve = function(aMap) {
		this.input = function(scope, args) {
			return { "test/ok": { val: 1 } }
		}
		nInput.call(this, this.input)
	}
	inherit(nInput_TestCtor_Resolve, nInput)

	var _prev = __NAM_ALLOW_EVAL_EXECFROM
	__NAM_ALLOW_EVAL_EXECFROM = false

	var ctor = nm.resolveExecFromCtor("nInput_TestCtor_Resolve")
	ow.test.assert(isFunction(ctor), true, "plain constructor name should resolve via global scope")

	var y = nm.loadObject({ name: "t", execFrom: "nInput_TestCtor_Resolve", execArgs: {} }, "input")
	ow.test.assert(isDef(y.exec), true, "loadObject should build the input object without needing eval")

	__NAM_ALLOW_EVAL_EXECFROM = _prev
	try { delete global.nInput_TestCtor_Resolve } catch(e) {}
	harness.stopEngine(nm)
})

ow.test.test("nmain::loadObject fails gracefully on unresolved execFrom expression when eval fallback is disabled", () => {
	var nm = harness.newEngine({}, { name: "execfrom-noeval" })

	var _prev = __NAM_ALLOW_EVAL_EXECFROM
	__NAM_ALLOW_EVAL_EXECFROM = false

	var y = nm.loadObject({ name: "t", execFrom: "(function(){ return 1 })" }, "input")
	ow.test.assert(isDef(y.exec), false, "unresolved execFrom should not throw and should leave exec undefined")

	__NAM_ALLOW_EVAL_EXECFROM = _prev
	harness.stopEngine(nm)
})

ow.test.test("nmain::resolveExecFromCtor supports expression fallback when eval is enabled", () => {
	var nm = harness.newEngine({}, { name: "execfrom-eval" })

	global.nInput_TestCtor_Eval = function(aMap) {
		this.input = function(scope, args) { return { "test/eval": { val: 1 } } }
		nInput.call(this, this.input)
	}
	inherit(nInput_TestCtor_Eval, nInput)

	var _prev = __NAM_ALLOW_EVAL_EXECFROM
	__NAM_ALLOW_EVAL_EXECFROM = true

	var expr = "(function(){ return nInput_TestCtor_Eval })()"
	var ctor = nm.resolveExecFromCtor(expr)
	ow.test.assert(isFunction(ctor), true, "eval fallback should still resolve expression-based constructor references")
	ow.test.assert(isDef(nm.__execFromEvalWarned) && nm.__execFromEvalWarned[expr] === true, true, "eval fallback usage should be tracked for one-time warnings")

	__NAM_ALLOW_EVAL_EXECFROM = _prev
	try { delete global.nInput_TestCtor_Eval } catch(e) {}
	harness.stopEngine(nm)
})

ow.test.test("nmain::resolveExecFromCtor cache is bounded", () => {
	var nm = harness.newEngine({}, { name: "execfrom-cache-bound" })

	for (var i = 0; i < 270; i++) {
		var n = "nInput_TestCtor_Bound_" + i
		global[n] = function(aMap) {
			this.input = function(scope, args) { return {} }
			nInput.call(this, this.input)
		}
		nm.resolveExecFromCtor(n)
	}

	ow.test.assert(Object.keys(nm.__execFromCtorCache).length <= 256, true, "execFrom constructor cache must be bounded")

	for (var ii = 0; ii < 270; ii++) {
		try { delete global["nInput_TestCtor_Bound_" + ii] } catch(e) {}
	}
	harness.stopEngine(nm)
})

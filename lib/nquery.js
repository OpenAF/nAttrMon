// nAttrMon query builder functionality
// Copyright 2023 Nuno Aguiar
//
// Deterministic, offline builder for the query expressions nAttrMon and OpenAF already use:
//
//   * nLinq  -- the $from() query language. Its structured form is the AST map
//               { where: [ { cond, args } ], transform: [ { func, args } ],
//                 select: ..., selector: { func, args } }
//               already produced by af.fromNLinq(), executed by $from().query(),
//               ow.obj.filter() and nAttrMon.prototype.filter(), and already stored
//               verbatim inside nAttrMon configurations (see config/inputs.disabled/yaml/20.chvals.yaml).
//   * jmespath -- the $path() expression language.
//   * dotpath  -- the simple ow.obj.getPath()/$$().get() path language.
//
// This library deliberately builds no new query language: compile() emits the AST above.
//
// It has no dependency on lib/nmain.js nor on the config engine and can be loaded on its own:
//   loadLib(NATTRMON_HOME + "/lib/nquery.js")

// Operators whose argument is a function or arbitrary source code. They cannot be represented
// in a declarative, serializable AST and executing them would mean running caller-supplied code,
// so the builder never exposes them and the validator rejects them.
var __NQ_NON_DECLARATIVE = [
	"where", "andWhere", "orWhere", "notWhere", "andNotWhere", "orNotWhere", "setWhere",
	"takeWhile", "skipWhile", "each", "filter", "define", "removed", "attach", "assign",
	"stream", "streamFn", "pselect", "fnBy", "minBy", "maxBy", "averageBy", "sumBy",
	"apply", "query", "_getState", "_setState", "useCase"
]

// Slot each operator occupies in the AST. Derived from the OpenAF nLinq text-DSL grammar
// (js/nlinqParse.js) by parsing one expression per operator, so it matches what af.fromNLinq()
// produces and what existing configurations contain.
var __NQ_SLOT_TRANSFORM = [
	"ignoreCase", "sort", "limit", "skip", "take", "skipTake", "head", "tail",
	"toDate", "detach", "attachBy", "attachNotBy", "attachByEmpty",
	"intersect", "except", "union", "cartesian", "join"
]
var __NQ_SLOT_SELECTOR = [
	"reverse", "count", "distinct", "first", "last", "at", "min", "max", "sum", "average",
	"group", "groupBy", "countBy", "any", "all", "none"
]
var __NQ_SLOT_SELECT = [ "select", "mselect" ]

// Operators that open or close a boolean group. nLinq applies them through the same flat
// dispatch loop as any other condition, so nested groups survive into the AST unchanged.
var __NQ_GROUP_OPEN  = [ "begin", "andBegin", "orBegin" ]
var __NQ_GROUP_CLOSE = [ "end" ]

var __nq_opsCache

// Builds the operator registry from the $from() implementation actually installed, so the
// builder tracks the running OpenAF instead of a hand-maintained catalogue
// ----------------------------------------
// Returns { names, slots, has(n), slotOf(n) }
// ----------------------------------------
var __nq_ops = function() {
	if (isDef(__nq_opsCache)) return __nq_opsCache

	var _chain = $from([])
	var _names = []
	for(var _k in _chain) {
		if (typeof _chain[_k] == "function" && __NQ_NON_DECLARATIVE.indexOf(_k) < 0) _names.push(_k)
	}
	_names = _names.sort()

	var _slots = {}
	_names.forEach(n => {
		if (__NQ_SLOT_SELECT.indexOf(n) >= 0)         _slots[n] = "select"
		else if (__NQ_SLOT_SELECTOR.indexOf(n) >= 0)  _slots[n] = "selector"
		else if (__NQ_SLOT_TRANSFORM.indexOf(n) >= 0) _slots[n] = "transform"
		else                                          _slots[n] = "where"
	})

	__nq_opsCache = {
		names : _names,
		slots : _slots,
		has   : function(n) { return isString(n) && this.slots.hasOwnProperty(n) },
		slotOf: function(n) { return this.slots[n] }
	}
	return __nq_opsCache
}

// True when an argument list is the "no arguments" form. af.fromNLinq() emits [ "" ] for
// zero-argument operators while the builder emits []; both are accepted everywhere.
// ----------------------------------------
// args = argument array
// Returns boolean
// ----------------------------------------
var __nq_noArgs = function(args) {
	if (!isArray(args)) return true
	if (args.length == 0) return true
	return (args.length == 1 && args[0] === "")
}

// ---------------------------------------------------------------------------------------------
// nLinq query builder
// ---------------------------------------------------------------------------------------------

// nLinq query builder. Accumulates operators into the nLinq AST
// ----------------------------------------
// anAST = optional AST map to start from
// ----------------------------------------
var nQueryFrom = function(anAST) {
	this._where     = []
	this._transform = []
	this._select    = __
	this._selector  = __

	if (isMap(anAST)) {
		if (isArray(anAST.where))     this._where     = clone(anAST.where)
		if (isArray(anAST.transform)) this._transform = clone(anAST.transform)
		if (isDef(anAST.select))      this._select    = clone(anAST.select)
		if (isMap(anAST.selector))    this._selector  = clone(anAST.selector)
	}
}

// Installs one builder method per declarative nLinq operator
// ----------------------------------------
;(function() {
	var _ops = __nq_ops()
	_ops.names.forEach(name => {
		var slot = _ops.slotOf(name)
		nQueryFrom.prototype[name] = function() {
			var args = Array.prototype.slice.call(arguments)
			switch(slot) {
			case "where"    : this._where.push({ cond: name, args: args }); break
			case "transform": this._transform.push({ func: name, args: args }); break
			case "selector" : this._selector = { func: name, args: args }; break
			case "select"   : this._select = (args.length > 0 ? args[0] : {}); break
			}
			return this
		}
	})
})()

// Returns the structured nLinq AST -- the lossless representation of this query
// ----------------------------------------
// Returns AST map consumable by $from().query(), ow.obj.filter() and nattrmon.filter()
// ----------------------------------------
nQueryFrom.prototype.toAST = function() {
	var _r = {}
	if (this._where.length > 0)     _r.where     = clone(this._where)
	if (this._transform.length > 0) _r.transform = clone(this._transform)
	if (isDef(this._select))        _r.select    = clone(this._select)
	if (isDef(this._selector))      _r.selector  = clone(this._selector)
	return _r
}

// Returns an independent copy of this builder
// ----------------------------------------
// Returns nQueryFrom
// ----------------------------------------
nQueryFrom.prototype.clone = function() {
	return new nQueryFrom(this.toAST())
}

// Renders one argument into its nLinq text-DSL form
// ----------------------------------------
// v = argument value
// Returns { ok: true, text } or { ok: false }
// ----------------------------------------
var __nq_argText = function(v) {
	if (isString(v))  return { ok: true, text: "'" + v.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'" }
	if (isNumber(v))  return { ok: true, text: String(v) }
	if (isBoolean(v)) return { ok: true, text: String(v) }
	return { ok: false }
}

// Renders this query into the nLinq text DSL. The text DSL is narrower than the AST -- it has
// no syntax for array/map arguments -- so this is best-effort by design
// ----------------------------------------
// Returns { ok: true, text } or { ok: false, reason }
// ----------------------------------------
nQueryFrom.prototype._toText = function() {
	var _parts = []
	var _fail

	var _render = (name, args) => {
		if (isDef(_fail)) return
		if (__nq_noArgs(args)) { _parts.push(name + "()"); return }
		var _as = []
		args.forEach(a => {
			var _t = __nq_argText(a)
			if (!_t.ok) { _fail = "UNSUPPORTED_IN_TEXT_DSL"; return }
			_as.push(_t.text)
		})
		if (isDef(_fail)) return
		_parts.push(name + "(" + _as.join(",") + ")")
	}

	this._where.forEach(w => _render(w.cond, w.args))
	this._transform.forEach(t => _render(t.func, t.args))
	if (isDef(this._select)) {
		if (isMap(this._select) && Object.keys(this._select).length == 0) _parts.push("select()")
		else _fail = "UNSUPPORTED_IN_TEXT_DSL"
	}
	if (isDef(this._selector)) _render(this._selector.func, this._selector.args)

	if (isDef(_fail)) return { ok: false, reason: _fail }
	if (_parts.length == 0) return { ok: false, reason: "EMPTY_QUERY" }

	// Confirm against the real parser rather than trusting the rendering
	var _text = _parts.join(".")
	try {
		af.fromNLinq(_text)
	} catch(e) {
		return { ok: false, reason: "UNSUPPORTED_IN_TEXT_DSL" }
	}
	return { ok: true, text: _text }
}

// Compiles this query into the form consumers execute
// ----------------------------------------
// Returns { dialect, ast, text?, textUnavailable? }
// ----------------------------------------
nQueryFrom.prototype.compile = function() {
	var _r = { dialect: "nlinq", ast: this.toAST() }
	var _t = this._toText()
	if (_t.ok) _r.text = _t.text
	else _r.textUnavailable = _t.reason
	return _r
}

// Validates the query structurally, without executing anything
// ----------------------------------------
// Returns { valid, errors, warnings, info }
// ----------------------------------------
nQueryFrom.prototype.validate = function() {
	return nQuery.validateAST(this.toAST())
}

// Runs this query against caller-supplied sample data
// ----------------------------------------
// aData    = sample array (or map) to query
// anOptions = { via, allowFunctions }
// Returns { success: true, result } or { success: false, error: { code, message } }
// ----------------------------------------
nQueryFrom.prototype.test = function(aData, anOptions) {
	return nQuery.exec(aData, this.toAST(), anOptions)
}

// ---------------------------------------------------------------------------------------------
// $path (JMESPath) builder
// ---------------------------------------------------------------------------------------------

// JMESPath expression builder for $path()
// ----------------------------------------
// anExpr = optional expression to start from
// ----------------------------------------
var nQueryPath = function(anExpr) {
	this._parts = []
	if (isString(anExpr) && anExpr.length > 0) this._parts.push({ op: "raw", value: anExpr })
}

// Appends a field access
// ----------------------------------------
// aName = field name
// Returns this
// ----------------------------------------
nQueryPath.prototype.field = function(aName) {
	_$(aName, "field name").isString().$_()
	this._parts.push({ op: "field", value: aName })
	return this
}

// Appends an array index access
// ----------------------------------------
// aIdx = index number
// Returns this
// ----------------------------------------
nQueryPath.prototype.index = function(aIdx) {
	_$(aIdx, "index").isNumber().$_()
	this._parts.push({ op: "index", value: aIdx })
	return this
}

// Appends a slice
// ----------------------------------------
// aStart, aStop, aStep = slice bounds (any may be undefined)
// Returns this
// ----------------------------------------
nQueryPath.prototype.slice = function(aStart, aStop, aStep) {
	this._parts.push({ op: "slice", value: [ aStart, aStop, aStep ] })
	return this
}

// Appends a wildcard projection ([*])
// ----------------------------------------
// Returns this
// ----------------------------------------
nQueryPath.prototype.all = function() {
	this._parts.push({ op: "all" })
	return this
}

// Appends a flatten projection ([])
// ----------------------------------------
// Returns this
// ----------------------------------------
nQueryPath.prototype.flatten = function() {
	this._parts.push({ op: "flatten" })
	return this
}

// Appends a filter projection ([?expression])
// ----------------------------------------
// anExpr = JMESPath comparator expression (e.g. "status == 'up'")
// Returns this
// ----------------------------------------
nQueryPath.prototype.filter = function(anExpr) {
	_$(anExpr, "filter expression").isString().$_()
	this._parts.push({ op: "filter", value: anExpr })
	return this
}

// Appends a multi-select hash ({a: x, b: y})
// ----------------------------------------
// aMap = map of output name to JMESPath expression
// Returns this
// ----------------------------------------
nQueryPath.prototype.select = function(aMap) {
	_$(aMap, "select map").isMap().$_()
	this._parts.push({ op: "select", value: aMap })
	return this
}

// Appends a pipe
// ----------------------------------------
// Returns this
// ----------------------------------------
nQueryPath.prototype.pipe = function() {
	this._parts.push({ op: "pipe" })
	return this
}

// Wraps the expression built so far in a JMESPath function call
// ----------------------------------------
// aName      = function name (e.g. "sort_by", "length")
// extraArgs  = optional array of extra raw arguments
// Returns this
// ----------------------------------------
nQueryPath.prototype.fn = function(aName, extraArgs) {
	_$(aName, "function name").isString().$_()
	this._parts = [ { op: "raw", value: aName + "(" + [ this.compile() ].concat(_$(extraArgs).isArray().default([])).join(", ") + ")" } ]
	return this
}

// Returns the structured representation of this path
// ----------------------------------------
// Returns { dialect: "jmespath", parts: [...] }
// ----------------------------------------
nQueryPath.prototype.toAST = function() {
	return { dialect: "jmespath", parts: clone(this._parts) }
}

// Compiles into a JMESPath expression string
// ----------------------------------------
// Returns expression string
// ----------------------------------------
nQueryPath.prototype.compile = function() {
	var _e = ""
	this._parts.forEach(p => {
		switch(p.op) {
		case "raw"    : _e += (_e.length > 0 ? "." : "") + p.value; break
		case "field"  : _e += (_e.length > 0 ? "." : "") + p.value; break
		case "index"  : _e += "[" + p.value + "]"; break
		case "slice"  : _e += "[" + p.value.map(v => isDef(v) ? String(v) : "").join(":").replace(/:$/, "") + "]"; break
		case "all"    : _e += "[*]"; break
		case "flatten": _e += "[]"; break
		case "filter" : _e += "[?" + p.value + "]"; break
		case "pipe"   : _e += " | "; break
		case "select" : _e += (_e.length > 0 ? "." : "") + "{" + Object.keys(p.value).map(k => k + ": " + p.value[k]).join(", ") + "}"; break
		}
	})
	return _e
}

// Validates the expression by compiling it with the JMESPath parser -- never executes it
// ----------------------------------------
// Returns { valid, errors, warnings, info }
// ----------------------------------------
nQueryPath.prototype.validate = function() {
	return nQuery.validatePath(this.compile(), "jmespath")
}

// Runs this path against caller-supplied sample data
// ----------------------------------------
// aData = sample data
// Returns { success: true, result } or { success: false, error }
// ----------------------------------------
nQueryPath.prototype.test = function(aData) {
	return nQuery.execPath(aData, this.compile(), "jmespath")
}

// ---------------------------------------------------------------------------------------------
// dot-path builder (ow.obj.getPath / $$().get)
// ---------------------------------------------------------------------------------------------

// Simple dot-path builder. This is NOT JMESPath -- ow.obj.getPath()/$$().get() support only
// field access and array indexes
// ----------------------------------------
// anExpr = optional expression to start from
// ----------------------------------------
var nQueryDotPath = function(anExpr) {
	this._parts = []
	if (isString(anExpr) && anExpr.length > 0) {
		var _p = nQuery.parsePath(anExpr, "dotpath")
		if (isDef(_p.parts)) this._parts = _p.parts
	}
}

// Appends a field access
// ----------------------------------------
// aName = field name
// Returns this
// ----------------------------------------
nQueryDotPath.prototype.field = function(aName) {
	_$(aName, "field name").isString().$_()
	this._parts.push({ op: "field", value: aName })
	return this
}

// Appends an array index access
// ----------------------------------------
// aIdx = index number
// Returns this
// ----------------------------------------
nQueryDotPath.prototype.index = function(aIdx) {
	_$(aIdx, "index").isNumber().$_()
	this._parts.push({ op: "index", value: aIdx })
	return this
}

// Returns the structured representation of this path
// ----------------------------------------
// Returns { dialect: "dotpath", parts: [...] }
// ----------------------------------------
nQueryDotPath.prototype.toAST = function() {
	return { dialect: "dotpath", parts: clone(this._parts) }
}

// Compiles into a dot-path expression string
// ----------------------------------------
// Returns expression string
// ----------------------------------------
nQueryDotPath.prototype.compile = function() {
	var _e = ""
	this._parts.forEach(p => {
		if (p.op == "field") _e += (_e.length > 0 ? "." : "") + p.value
		if (p.op == "index") _e += "[" + p.value + "]"
	})
	return _e
}

// Validates the dot-path structurally
// ----------------------------------------
// Returns { valid, errors, warnings, info }
// ----------------------------------------
nQueryDotPath.prototype.validate = function() {
	return nQuery.validatePath(this.compile(), "dotpath")
}

// Runs this dot-path against caller-supplied sample data
// ----------------------------------------
// aData = sample data
// Returns { success: true, result } or { success: false, error }
// ----------------------------------------
nQueryDotPath.prototype.test = function(aData) {
	return nQuery.execPath(aData, this.compile(), "dotpath")
}

// ---------------------------------------------------------------------------------------------
// nQuery namespace
// ---------------------------------------------------------------------------------------------

var nQuery = {}

// Query dialects nAttrMon plugs consume
nQuery.DIALECTS = [ "nlinq", "nlinqText", "nlinqAny", "jmespath", "dotpath" ]

// Creates a new nLinq query builder
// ----------------------------------------
// anAST = optional AST map to start from
// Returns nQueryFrom
// ----------------------------------------
nQuery.from = function(anAST) {
	return new nQueryFrom(anAST)
}

// Creates a new JMESPath ($path) builder
// ----------------------------------------
// anExpr = optional expression to start from
// Returns nQueryPath
// ----------------------------------------
nQuery.path = function(anExpr) {
	return new nQueryPath(anExpr)
}

// Creates a new dot-path (ow.obj.getPath) builder
// ----------------------------------------
// anExpr = optional expression to start from
// Returns nQueryDotPath
// ----------------------------------------
nQuery.dotPath = function(anExpr) {
	return new nQueryDotPath(anExpr)
}

// Returns the operators this builder supports on the running OpenAF
// ----------------------------------------
// Returns { names, slots }
// ----------------------------------------
nQuery.operators = function() {
	var _o = __nq_ops()
	return { names: clone(_o.names), slots: clone(_o.slots) }
}

// Parses an existing nLinq query into a builder. AST maps pass straight through; text is parsed
// with OpenAF's own af.fromNLinq() grammar. Anything outside that subset is preserved verbatim
// and reported as not structurally editable -- it is never discarded
// ----------------------------------------
// anExpr = nLinq AST map or text-DSL string
// Returns nQueryFrom, or { mode: "raw", editable: false, reason, expression }
// ----------------------------------------
nQuery.parse = function(anExpr) {
	var _raw = aReason => ({ mode: "raw", editable: false, reason: aReason, expression: anExpr })

	if (isMap(anExpr)) {
		var _v = nQuery.validateAST(anExpr)
		if (!_v.valid) return _raw("UNSUPPORTED_QUERY_EXPRESSION")
		return new nQueryFrom(anExpr)
	}

	if (!isString(anExpr)) return _raw("UNSUPPORTED_QUERY_EXPRESSION")

	// Expressions written as JavaScript ($from(...)...) are not structurally editable: the
	// builder never parses JavaScript source.
	if (anExpr.indexOf("$from(") >= 0 || anExpr.indexOf("=>") >= 0 || anExpr.indexOf("function") >= 0)
		return _raw("UNSUPPORTED_QUERY_EXPRESSION")

	var _ast
	try {
		_ast = af.fromNLinq(anExpr)
	} catch(e) {
		return _raw("UNSUPPORTED_QUERY_EXPRESSION")
	}
	if (!isMap(_ast) || Object.keys(_ast).length == 0) return _raw("UNSUPPORTED_QUERY_EXPRESSION")

	var _vv = nQuery.validateAST(_ast)
	if (!_vv.valid) return _raw("UNSUPPORTED_QUERY_EXPRESSION")

	return new nQueryFrom(_ast)
}

// Parses an existing path expression into a structured representation
// ----------------------------------------
// anExpr    = expression string
// aDialect  = jmespath | dotpath
// Returns { dialect, parts, editable: true } or { mode: "raw", editable: false, reason, expression }
// ----------------------------------------
nQuery.parsePath = function(anExpr, aDialect) {
	aDialect = _$(aDialect, "dialect").isString().default("jmespath")
	var _raw = aReason => ({ mode: "raw", editable: false, reason: aReason, expression: anExpr })

	if (!isString(anExpr)) return _raw("UNSUPPORTED_QUERY_EXPRESSION")

	if (aDialect == "dotpath") {
		// Only field access and numeric indexes are representable
		if (!anExpr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*(\[[0-9]+\]|\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/)) return _raw("UNSUPPORTED_QUERY_EXPRESSION")
		var _parts = []
		anExpr.split(".").forEach(seg => {
			var _m = seg.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)((\[[0-9]+\])*)$/)
			if (isNull(_m)) return
			_parts.push({ op: "field", value: _m[1] })
			if (isDef(_m[2]) && _m[2].length > 0) {
				_m[2].split("]").forEach(ix => {
					if (ix.length > 1) _parts.push({ op: "index", value: Number(ix.replace("[", "")) })
				})
			}
		})
		return { dialect: "dotpath", parts: _parts, editable: true }
	}

	// JMESPath: only the safely re-buildable subset is structurally editable. Everything else
	// is preserved as a single raw part so a round trip never loses the expression.
	var _v = nQuery.validatePath(anExpr, "jmespath")
	if (!_v.valid) return _raw("INVALID_QUERY")

	var _simple = anExpr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*((\.[a-zA-Z_$][a-zA-Z0-9_$]*)|(\[[0-9]+\])|(\[\*\])|(\[\]))*$/)
	if (isNull(_simple)) return { dialect: "jmespath", parts: [ { op: "raw", value: anExpr } ], editable: false, reason: "UNSUPPORTED_QUERY_EXPRESSION" }

	var _pp = []
	var _rest = anExpr
	while(_rest.length > 0) {
		var _m = _rest.match(/^\.?([a-zA-Z_$][a-zA-Z0-9_$]*)/)
		if (!isNull(_m)) { _pp.push({ op: "field", value: _m[1] }); _rest = _rest.substring(_m[0].length); continue }
		_m = _rest.match(/^\[([0-9]+)\]/)
		if (!isNull(_m)) { _pp.push({ op: "index", value: Number(_m[1]) }); _rest = _rest.substring(_m[0].length); continue }
		if (_rest.indexOf("[*]") == 0) { _pp.push({ op: "all" }); _rest = _rest.substring(3); continue }
		if (_rest.indexOf("[]") == 0)  { _pp.push({ op: "flatten" }); _rest = _rest.substring(2); continue }
		break
	}
	return { dialect: "jmespath", parts: _pp, editable: true }
}

// Builds an empty diagnostics structure
// ----------------------------------------
// Returns { valid, errors, warnings, info }
// ----------------------------------------
var __nq_diag = function() {
	return { valid: true, errors: [], warnings: [], info: [] }
}

// Adds one diagnostic
// ----------------------------------------
// aDiag = diagnostics structure
// aSev  = errors | warnings | info
// ----------------------------------------
var __nq_add = function(aDiag, aSev, aPath, aCode, aMessage) {
	aDiag[aSev].push({ path: aPath, code: aCode, message: aMessage, severity: aSev.replace(/s$/, "") })
	if (aSev == "errors") aDiag.valid = false
}

// Validates an nLinq AST structurally. Never executes any part of the query
// ----------------------------------------
// anAST = AST map
// Returns { valid, errors, warnings, info }
// ----------------------------------------
nQuery.validateAST = function(anAST) {
	var _d = __nq_diag()
	var _ops = __nq_ops()

	if (!isMap(anAST)) {
		__nq_add(_d, "errors", "", "STRUCTURAL_ERROR", "Query: expected a map.")
		return _d
	}

	var _depth = 0
	if (isDef(anAST.where)) {
		if (!isArray(anAST.where)) {
			__nq_add(_d, "errors", "where", "STRUCTURAL_ERROR", "Query: 'where' must be an array.")
		} else {
			anAST.where.forEach((w, i) => {
				var _p = "where[" + i + "]"
				if (!isMap(w)) { __nq_add(_d, "errors", _p, "STRUCTURAL_ERROR", "Query: condition must be a map."); return }
				if (!isString(w.cond) || w.cond.length == 0) { __nq_add(_d, "errors", _p + ".cond", "STRUCTURAL_ERROR", "Query: condition needs a non-empty 'cond'."); return }
				if (__NQ_NON_DECLARATIVE.indexOf(w.cond) >= 0) { __nq_add(_d, "errors", _p + ".cond", "INVALID_QUERY", "Query: operator '" + w.cond + "' takes a function and cannot be represented declaratively."); return }
				if (!_ops.has(w.cond)) { __nq_add(_d, "errors", _p + ".cond", "INVALID_QUERY", "Query: unsupported operator '" + w.cond + "'."); return }
				if (_ops.slotOf(w.cond) != "where") __nq_add(_d, "warnings", _p + ".cond", "INVALID_QUERY", "Query: operator '" + w.cond + "' normally belongs in '" + _ops.slotOf(w.cond) + "'.")
				if (isDef(w.args) && !isArray(w.args)) __nq_add(_d, "errors", _p + ".args", "STRUCTURAL_ERROR", "Query: 'args' must be an array.")
				if (__NQ_GROUP_OPEN.indexOf(w.cond) >= 0)  _depth++
				if (__NQ_GROUP_CLOSE.indexOf(w.cond) >= 0) _depth--
				if (_depth < 0) { __nq_add(_d, "errors", _p, "INVALID_QUERY", "Query: '" + w.cond + "' closes a group that was never opened."); _depth = 0 }
			})
			if (_depth > 0) __nq_add(_d, "errors", "where", "INVALID_QUERY", "Query: " + _depth + " boolean group(s) opened and never closed.")
		}
	}

	if (isDef(anAST.transform)) {
		if (!isArray(anAST.transform)) {
			__nq_add(_d, "errors", "transform", "STRUCTURAL_ERROR", "Query: 'transform' must be an array.")
		} else {
			anAST.transform.forEach((t, i) => {
				var _p = "transform[" + i + "]"
				if (!isMap(t)) { __nq_add(_d, "errors", _p, "STRUCTURAL_ERROR", "Query: transform must be a map."); return }
				if (!isString(t.func) || t.func.length == 0) { __nq_add(_d, "errors", _p + ".func", "STRUCTURAL_ERROR", "Query: transform needs a non-empty 'func'."); return }
				if (__NQ_NON_DECLARATIVE.indexOf(t.func) >= 0) { __nq_add(_d, "errors", _p + ".func", "INVALID_QUERY", "Query: transform '" + t.func + "' takes a function and cannot be represented declaratively."); return }
				if (!_ops.has(t.func)) { __nq_add(_d, "errors", _p + ".func", "INVALID_QUERY", "Query: unsupported transform '" + t.func + "'."); return }
				if (isDef(t.args) && !isArray(t.args)) { __nq_add(_d, "errors", _p + ".args", "STRUCTURAL_ERROR", "Query: 'args' must be an array."); return }
				if (t.func == "sort" && !__nq_noArgs(t.args)) {
					t.args.forEach((a, ai) => {
						if (!isString(a)) __nq_add(_d, "errors", _p + ".args[" + ai + "]", "INVALID_QUERY", "Query: sort arguments must be field-name strings ('-field' for descending).")
					})
				}
				if ([ "limit", "skip", "take", "head", "tail" ].indexOf(t.func) >= 0 && !__nq_noArgs(t.args)) {
					if (!isNumber(t.args[0])) __nq_add(_d, "errors", _p + ".args[0]", "INVALID_QUERY", "Query: '" + t.func + "' expects a number.")
				}
			})
		}
	}

	if (isDef(anAST.select)) {
		if (isString(anAST.select)) __nq_add(_d, "warnings", "select", "INVALID_QUERY", "Query: a string 'select' is compiled as JavaScript and is only executed when explicitly allowed.")
		else if (!isMap(anAST.select) && !isArray(anAST.select) && !isFunction(anAST.select)) __nq_add(_d, "errors", "select", "STRUCTURAL_ERROR", "Query: 'select' must be a map, an array or a string.")
	}

	if (isDef(anAST.selector)) {
		if (!isMap(anAST.selector)) {
			__nq_add(_d, "errors", "selector", "STRUCTURAL_ERROR", "Query: 'selector' must be a map.")
		} else {
			if (!isString(anAST.selector.func) || anAST.selector.func.length == 0) __nq_add(_d, "errors", "selector.func", "STRUCTURAL_ERROR", "Query: 'selector' needs a non-empty 'func'.")
			else if (!_ops.has(anAST.selector.func)) __nq_add(_d, "errors", "selector.func", "INVALID_QUERY", "Query: unsupported selector '" + anAST.selector.func + "'.")
			else if (_ops.slotOf(anAST.selector.func) != "selector") __nq_add(_d, "warnings", "selector.func", "INVALID_QUERY", "Query: '" + anAST.selector.func + "' is not normally a selector.")
		}
	}

	if (isDef(anAST.select) && isDef(anAST.selector)) __nq_add(_d, "warnings", "", "INVALID_QUERY", "Query: 'select' and 'selector' are both set; 'select' wins.")

	return _d
}

// Validates a path expression without executing it
// ----------------------------------------
// anExpr   = expression string
// aDialect = jmespath | dotpath
// Returns { valid, errors, warnings, info }
// ----------------------------------------
nQuery.validatePath = function(anExpr, aDialect) {
	aDialect = _$(aDialect, "dialect").isString().default("jmespath")
	var _d = __nq_diag()

	if (!isString(anExpr) || anExpr.trim().length == 0) {
		__nq_add(_d, "errors", "", "INVALID_QUERY", "Path: expected a non-empty expression string.")
		return _d
	}

	if (aDialect == "dotpath") {
		if (!anExpr.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*(\[[0-9]+\]|\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/))
			__nq_add(_d, "errors", "", "INVALID_QUERY", "Path: '" + anExpr + "' isn't a valid dot-path (only field access and numeric indexes are supported).")
		return _d
	}

	// Compiling with the JMESPath parser validates the grammar without evaluating anything
	try {
		$path({}, "@")
		jmespath.compile(anExpr)
	} catch(e) {
		__nq_add(_d, "errors", "", "INVALID_QUERY", "Path: " + String(e))
	}
	return _d
}

// Executes an nLinq AST against caller-supplied sample data.
//
// This mirrors nAttrMon.prototype.filter rather than $from().query()/apply(): both of those call
// code.tselect(), which doesn't exist in OpenAF, so they throw whenever 'select' is a string.
// ----------------------------------------
// aData     = sample array (or map) to query
// anAST     = AST map
// anOptions = { via: "ow.obj.filter" | "nattrmon.filter", allowFunctions: false }
// Returns { success: true, result } or { success: false, error: { code, message } }
// ----------------------------------------
nQuery.exec = function(aData, anAST, anOptions) {
	anOptions = _$(anOptions, "options").isMap().default({})
	var _via  = _$(anOptions.via, "via").isString().default("ow.obj.filter")
	var _allowFns = _$(anOptions.allowFunctions, "allowFunctions").isBoolean().default(false)

	var _err = (aCode, aMessage) => ({ success: false, error: { code: aCode, message: aMessage } })

	var _v = nQuery.validateAST(anAST)
	if (!_v.valid) return _err("INVALID_QUERY", _v.errors.map(e => e.message).join(" | "))

	if (isMap(aData) && !isArray(aData)) aData = Object.keys(aData).map(k => merge({ _key: k }, isMap(aData[k]) ? aData[k] : { value: aData[k] }))
	if (!isArray(aData)) return _err("QUERY_EXECUTION_ERROR", "Sample data must be an array or a map.")

	try {
		var _f = $from(aData)

		// nattrmon.filter attaches <key>_ms age columns for date-like keys; ow.obj.filter does not.
		// Previews must match whichever one the consuming plug will actually use.
		if (_via == "nattrmon.filter" && aData.length > 0 && isMap(aData[0])) {
			Object.keys(aData[0]).forEach(k => {
				if (k.indexOf("date") >= 0 && !isNull(new Date(aData[0][k]))) _f = _f.attach(k + "_ms", r => now() - (new Date(r[k]).getTime()))
			})
		}

		if (isArray(anAST.where))     anAST.where.forEach(w => { _f = _f[w.cond].apply(_f, __nq_noArgs(w.args) ? [] : w.args) })
		if (isArray(anAST.transform)) anAST.transform.forEach(t => { _f = _f[t.func].apply(_f, __nq_noArgs(t.args) ? [] : t.args) })

		var _res
		if (isString(anAST.select)) {
			if (!_allowFns) return _err("FUNCTION_SELECT_NOT_ALLOWED", "This query's 'select' is JavaScript source; re-run with allowFunctions:true to evaluate it.")
			_res = _f.select(new Function("elem", "index", "array", anAST.select))
		}
		if (isMap(anAST.select) || isArray(anAST.select)) {
			_res = (isMap(anAST.select) && Object.keys(anAST.select).length == 0) ? _f.select() : _f.select(anAST.select)
		}
		if (isUnDef(_res) && isMap(anAST.selector)) {
			var _args = __nq_noArgs(anAST.selector.args) ? [] : anAST.selector.args
			_res = $$({}).set(anAST.selector.func, _f[anAST.selector.func].apply(_f, _args))
		}
		if (isUnDef(_res)) _res = _f.select()

		return { success: true, result: _res }
	} catch(e) {
		return _err("QUERY_EXECUTION_ERROR", String(e))
	}
}

// Executes a path expression against caller-supplied sample data
// ----------------------------------------
// aData    = sample data
// anExpr   = expression string
// aDialect = jmespath | dotpath
// Returns { success: true, result } or { success: false, error: { code, message } }
// ----------------------------------------
nQuery.execPath = function(aData, anExpr, aDialect) {
	aDialect = _$(aDialect, "dialect").isString().default("jmespath")

	var _v = nQuery.validatePath(anExpr, aDialect)
	if (!_v.valid) return { success: false, error: { code: "INVALID_QUERY", message: _v.errors.map(e => e.message).join(" | ") } }

	try {
		return { success: true, result: (aDialect == "dotpath" ? $$(aData).get(anExpr) : $path(aData, anExpr)) }
	} catch(e) {
		return { success: false, error: { code: "QUERY_EXECUTION_ERROR", message: String(e) } }
	}
}

// nAttrMon configuration engine functionality
// Copyright 2023 Nuno Aguiar
//
// Deterministic, offline API to discover nAttrMon components, and to load, validate, create,
// modify, explain and serialize nAttrMon configurations. It contains no terminal, browser or
// UI concepts and no GenAI dependency -- it is the model those consumers build on.
//
// Two properties are load-bearing:
//
//   * It never evaluates plug code. Unlike nAttrMon.prototype.loadObject, it does not resolve
//     execFrom, af.load() an object file or run a constructor. Validating a configuration has
//     no side effects.
//   * It is not a lossy parser. Every loaded file keeps its original text, and files the caller
//     never modified are re-emitted byte for byte.
//
// Requires lib/nmain.js to have been loaded (for the descriptor/metadata helpers it reuses) and
// lib/nquery.js (loaded below):
//   loadLib(NATTRMON_HOME + "/lib/nmain.js")
//   loadLib(NATTRMON_HOME + "/lib/nconfigengine.js")

var __NCE_HOME = getEnv("NATTRMON_HOME")
if (isUnDef(__NCE_HOME)) __NCE_HOME = (isDef(global.NATTRMON_HOME) ? global.NATTRMON_HOME : (getOPackPath("nAttrMon") || "."))
loadLib(__NCE_HOME + "/lib/nquery.js")

// The kinds of component a configuration can reference. Kept as data so other object kinds can
// be added without reshaping the API.
var NCE_KINDS = [ "input", "output", "validation" ]

// Maps a component kind to the constructor-name prefix used under config/objects/
var NCE_KIND_PREFIX = {
	input     : "nInput_",
	output    : "nOutput_",
	validation: "nValidation_"
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

// Builds an empty diagnostics structure
// ----------------------------------------
// Returns { valid, errors, warnings, info, stats }
// ----------------------------------------
var __nce_diag = function() {
	return { valid: true, errors: [], warnings: [], info: [], stats: {} }
}

// Adds one diagnostic
// ----------------------------------------
// aDiag = diagnostics structure
// aSev  = errors | warnings | info
// ----------------------------------------
var __nce_add = function(aDiag, aSev, aPath, aCode, aMessage) {
	aDiag[aSev].push({ path: aPath, code: aCode, message: aMessage, severity: aSev.replace(/s$/, "") })
	if (aSev == "errors") aDiag.valid = false
}

// Merges one diagnostics structure into another, prefixing paths
// ----------------------------------------
// aTarget = diagnostics to merge into
// aSource = diagnostics to merge from
// aPrefix = path prefix
// ----------------------------------------
var __nce_merge = function(aTarget, aSource, aPrefix) {
	;[ "errors", "warnings", "info" ].forEach(sev => {
		_$(aSource[sev]).isArray().default([]).forEach(d => {
			aTarget[sev].push(merge(clone(d), { path: aPrefix + (d.path.length > 0 ? "." + d.path : "") }))
			if (sev == "errors") aTarget.valid = false
		})
	})
}

// Normalizes a metadata type string into a structured form. Handles the generic and union
// syntaxes actually used in config/objects.meta (e.g. "array<string>", "string | array<string>")
// ----------------------------------------
// aType = raw type string
// Returns { raw, base, of, union }
// ----------------------------------------
var __nce_normalizeType = function(aType) {
	if (!isString(aType) || aType.trim().length == 0) return { raw: "any", base: "any", union: [] }
	var _raw = aType.trim()

	if (_raw.indexOf("|") > 0) {
		return { raw: _raw, base: "union", union: _raw.split("|").map(t => __nce_normalizeType(t)) }
	}

	var _g = _raw.match(/^([a-zA-Z]+)\s*<\s*(.+?)\s*>$/)
	if (!isNull(_g)) return { raw: _raw, base: _g[1].toLowerCase(), of: _g[2].toLowerCase(), union: [] }

	return { raw: _raw, base: _raw.toLowerCase(), union: [] }
}

// Checks a value against a normalized metadata type
// ----------------------------------------
// aValue = value to check
// aType  = normalized type (from __nce_normalizeType)
// Returns true, false, or undefined when the type carries no information
// ----------------------------------------
var __nce_checkType = function(aValue, aType) {
	if (isUnDef(aType)) return __
	switch(aType.base) {
	case "any"    :
	case "object" :
	case "map"    : return (aType.base == "any" ? __ : isMap(aValue))
	case "union"  :
		var _known = false
		for(var i in aType.union) {
			var _r = __nce_checkType(aValue, aType.union[i])
			if (_r === true) return true
			if (_r === false) _known = true
		}
		return (_known ? false : __)
	case "string" : return isString(aValue)
	case "number" : return isNumber(aValue)
	case "integer": return isNumber(aValue) && (Number(aValue) % 1 === 0)
	case "boolean": return isBoolean(aValue)
	case "array"  : return isArray(aValue)
	case "date"   : return isDate(aValue)
	default       : return __
	}
}

// ---------------------------------------------------------------------------------------------
// nConfigEngine
// ---------------------------------------------------------------------------------------------

// nAttrMon configuration engine
// ----------------------------------------
// aParams = { home, configPath, mode }
//   home       = nAttrMon installation path (defaults to NATTRMON_HOME/opack path)
//   configPath = active configuration directory (defaults to <home>/config)
//   mode       = warn | strict (default warn)
// ----------------------------------------
var nConfigEngine = function(aParams) {
	aParams = _$(aParams, "aParams").isMap().default({})

	this.home = _$(aParams.home, "home").isString().default(__NCE_HOME)
	this.configPath = _$(aParams.configPath, "configPath").isString().default(this.home + "/config")
	this.mode       = _$(aParams.mode, "mode").isString().default("warn")

	// Lightweight stand-in so the pure descriptor/metadata helpers on nAttrMon.prototype can be
	// reused without constructing an engine (which would create channels, threads and a scheduler).
	//
	// _preflightIssue is a no-op: those helpers report by logging and by collecting preflight
	// issues, while the engine reports diagnostics. Legacy keys are detected from the same
	// compatibility map instead, so nothing depends on the helpers' side effects and no global
	// has to be toggled to silence them -- which matters because an engine may be constructed
	// inside a running daemon, alongside plug threads calling the very same helpers.
	this._shim = {
		getDescriptorLegacyMap: (isDef(global.nAttrMon) ? nAttrMon.prototype.getDescriptorLegacyMap : function() { return {} }),
		_preflightIssue       : function() {}
	}

	this._components = __
	this._metaIssues = []
}

// True when lib/nmain.js is available for helper reuse
// ----------------------------------------
// Returns boolean
// ----------------------------------------
nConfigEngine.prototype._hasNMain = function() {
	return isDef(global.nAttrMon) && isFunction(global.nAttrMon)
}

// Calls a pure nAttrMon.prototype helper on the shim, so there is one definition of descriptor
// validity and no engine instance is needed
// ----------------------------------------
// aName = helper name
// args  = argument array
// Returns the helper's result
// ----------------------------------------
nConfigEngine.prototype._callHelper = function(aName, args) {
	return nAttrMon.prototype[aName].apply(this._shim, args)
}

// ---------------------------------------------------------------------------------------------
// component discovery
// ---------------------------------------------------------------------------------------------

// Reads object metadata directly from disk. nAttrMon.prototype.loadObjectsMeta needs a fully
// constructed engine, so the search order of lib/nmain.js is reproduced here: packaged metadata
// first, then the active configuration, with local entries overriding packaged ones
// ----------------------------------------
// Returns map of constructor to metadata
// ----------------------------------------
nConfigEngine.prototype._loadMeta = function() {
	var _meta = {}
	this._metaIssues = []

	// Same order as lib/nmain.js: packaged metadata first, then the active configuration. The
	// packaged path follows this engine's home (which already defaults to the opack path), so an
	// engine pointed at a source tree reads that tree rather than a separately installed opack.
	var _paths = []
	var _packaged = this.home + "/config/objects.meta"
	if (io.fileExists(_packaged)) _paths.push(_packaged)
	var _local = this.configPath + "/objects.meta"
	if (io.fileExists(_local) && _paths.indexOf(_local) < 0) _paths.push(_local)

	var parent = this
	_paths.forEach(basePath => {
		$from(listFilesRecursive(basePath))
		.equals("isFile", true)
		.match("filename", ".*\\.(yaml|json)$")
		.sort("filepath")
		.select(f => {
			try {
				var m = f.filename.match(/\.json$/) ? io.readFileJSON(f.filepath) : io.readFileYAML(f.filepath, true)
				var issues = parent._hasNMain() ? nAttrMon.prototype.validateObjectMeta.call({}, m) : []
				if (issues.length > 0) {
					issues.forEach(i => parent._metaIssues.push(f.filepath + ": " + i))
					return
				}
				m.source = f.filepath
				_meta[m.constructor] = m
			} catch(e) {
				parent._metaIssues.push(f.filepath + ": couldn't read object metadata: " + String(e))
			}
		})
	})

	return _meta
}

// Indexes the object constructors available to this installation by filename, without loading
// or evaluating any of them
// ----------------------------------------
// Returns map of constructor name to filepath
// ----------------------------------------
nConfigEngine.prototype._indexObjects = function() {
	var _idx = {}
	var _paths = []
	var _packaged = this.home + "/config/objects"
	if (io.fileExists(_packaged)) _paths.push(_packaged)
	var _local = this.configPath + "/objects"
	if (io.fileExists(_local) && _paths.indexOf(_local) < 0) _paths.push(_local)

	_paths.forEach(basePath => {
		$from(listFilesRecursive(basePath))
		.equals("isFile", true)
		.match("filename", ".*\\.js$")
		.sort("filepath")
		.select(f => { _idx[f.filename.replace(/\.js$/, "")] = f.filepath })
	})
	return _idx
}

// Infers which component kind a constructor name belongs to
// ----------------------------------------
// aName = constructor name
// Returns kind or undefined
// ----------------------------------------
var __nce_kindOf = function(aName) {
	var _k
	NCE_KINDS.forEach(k => { if (isString(aName) && aName.indexOf(NCE_KIND_PREFIX[k]) == 0) _k = k })
	return _k
}

// Classifies how much usable information a metadata entry carries, so consumers can tell how
// much validation actually ran.
//
// Most packaged metadata is generated boilerplate ("type: any" with a stock description) that
// doesn't necessarily list every argument its constructor reads. Only entries that are entirely
// hand-written can be treated as a closed set of parameters -- see the UNKNOWN_PARAMETER check.
// ----------------------------------------
// aMeta = metadata entry (may be undefined)
// Returns none | generated | partial | full
// ----------------------------------------
var __nce_coverage = function(aMeta) {
	if (isUnDef(aMeta)) return "none"
	var _args = _$(aMeta.arguments).isArray().default([])
	if (_args.length == 0) return (isString(aMeta.description) && aMeta.description.match(/^Configuration metadata for /) ? "generated" : "full")

	var _generic = _args.filter(a => String(a.type).trim() == "any" && String(a.description).match(/^Configuration option read by /)).length
	if (_generic == 0) return "full"
	if (_generic * 2 >= _args.length) return "generated"
	return "partial"
}

// Normalizes one metadata argument into the shape consumers get
// ----------------------------------------
// anArg = raw metadata argument
// Returns normalized parameter map
// ----------------------------------------
var __nce_normalizeArg = function(anArg) {
	var _p = {
		name       : anArg.name,
		type       : __nce_normalizeType(anArg.type),
		description: anArg.description,
		required   : (isBoolean(anArg.required) ? anArg.required : false),
		example    : anArg.example
	}
	// Optional metadata fields are carried through as-is so new ones don't need code changes
	;[ "default", "enum", "secret", "unit", "deprecated", "visibleWhen", "query" ].forEach(k => {
		if (isDef(anArg[k])) _p[k] = clone(anArg[k])
	})
	return _p
}

// Builds (and caches) the normalized component catalogue for this installation
// ----------------------------------------
// Returns array of normalized components
// ----------------------------------------
nConfigEngine.prototype._buildComponents = function() {
	if (isDef(this._components)) return this._components

	var _meta = this._loadMeta()
	var _idx  = this._indexObjects()
	var _byName = {}

	// Everything with metadata
	Object.keys(_meta).forEach(name => {
		var m = _meta[name]
		_byName[name] = {
			type       : m.kind,
			name       : name,
			title      : m.title,
			description: m.description,
			examples   : _$(m.examples).isArray().default([]),
			source     : m.source,
			file       : _idx[name],
			metadata   : { present: true, coverage: __nce_coverage(m) },
			parameters : _$(m.arguments).isArray().default([]).map(a => __nce_normalizeArg(a))
		}
	})

	// Components without metadata must stay discoverable
	Object.keys(_idx).forEach(name => {
		if (isDef(_byName[name])) return
		var _k = __nce_kindOf(name)
		if (isUnDef(_k)) return
		_byName[name] = {
			type       : _k,
			name       : name,
			title      : name,
			description: __,
			examples   : [],
			source     : __,
			file       : _idx[name],
			metadata   : { present: false, coverage: "none" },
			parameters : []
		}
	})

	this._components = Object.keys(_byName).sort().map(k => _byName[k])
	return this._components
}

// Forces a re-read of metadata and object files
// ----------------------------------------
// Returns this
// ----------------------------------------
nConfigEngine.prototype.refresh = function() {
	this._components = __
	return this
}

// Lists the nAttrMon components available to this installation
// ----------------------------------------
// aKind = optional input | output | validation
// Returns array of normalized components
// ----------------------------------------
nConfigEngine.prototype.listComponents = function(aKind) {
	var _c = clone(this._buildComponents())
	if (isDef(aKind)) _c = _c.filter(c => c.type == aKind)
	return _c
}

// Returns a single component
// ----------------------------------------
// aKind = input | output | validation (optional when aName is unambiguous)
// aName = constructor name
// Returns normalized component or undefined
// ----------------------------------------
nConfigEngine.prototype.getComponent = function(aKind, aName) {
	if (isUnDef(aName)) { aName = aKind; aKind = __ }
	var _r = this._buildComponents().filter(c => c.name == aName && (isUnDef(aKind) || c.type == aKind))
	return (_r.length > 0 ? clone(_r[0]) : __)
}

// Searches components by name, title, description or parameter name
// ----------------------------------------
// aQuery = search string (case-insensitive)
// aKind  = optional kind filter
// Returns array of normalized components
// ----------------------------------------
nConfigEngine.prototype.searchComponents = function(aQuery, aKind) {
	var _q = String(_$(aQuery, "aQuery").isString().default("")).toLowerCase()
	return this.listComponents(aKind).filter(c => {
		if (String(c.name).toLowerCase().indexOf(_q) >= 0) return true
		if (isString(c.title) && c.title.toLowerCase().indexOf(_q) >= 0) return true
		if (isString(c.description) && c.description.toLowerCase().indexOf(_q) >= 0) return true
		return c.parameters.some(p => String(p.name).toLowerCase().indexOf(_q) >= 0)
	})
}

// Returns metadata files that couldn't be read or didn't pass the schema
// ----------------------------------------
// Returns array of issue strings
// ----------------------------------------
nConfigEngine.prototype.getMetadataIssues = function() {
	this._buildComponents()
	return clone(this._metaIssues)
}

// ---------------------------------------------------------------------------------------------
// configuration loading
// ---------------------------------------------------------------------------------------------

// Recomputes every entry's name, id and per-kind grouping from the descriptors themselves.
//
// Ids are human-meaningful and derived from the descriptor name, disambiguated only when names
// collide. Recomputing after every change keeps them identical to what a fresh load() of the
// same configuration would produce -- so an id never means one thing before a save and another
// thing after it.
// ----------------------------------------
// aCfg = config model
// ----------------------------------------
var __nce_reindex = function(aCfg) {
	var _seen = {}
	aCfg.entries.forEach(e => {
		e.name = (isMap(e.descriptor) && isString(e.descriptor.name)) ? e.descriptor.name : "unnamed"
		var _id = e.kind + ":" + e.name
		if (isDef(_seen[_id])) { _seen[_id]++; _id = _id + "#" + _seen[_id] } else { _seen[_id] = 1 }
		e.id = _id
	})
	NCE_KINDS.forEach(kind => { aCfg[kind + "s"] = aCfg.entries.filter(e => e.kind == kind) })
	return aCfg
}

// Registers the plug descriptors found inside one parsed document
// ----------------------------------------
var __nce_collect = function(aCfg, aFile, aDoc, aDocIndex) {
	NCE_KINDS.forEach(kind => {
		if (isUnDef(aDoc[kind])) return
		if (isArray(aDoc[kind])) {
			aDoc[kind].forEach((d, li) => aCfg.entries.push({ kind: kind, file: aFile.relPath, docIndex: aDocIndex, listIndex: li, descriptor: d }))
		} else {
			aCfg.entries.push({ kind: kind, file: aFile.relPath, docIndex: aDocIndex, listIndex: __, descriptor: aDoc[kind] })
		}
	})
}

// Loads an nAttrMon configuration directory into the normalized representation.
//
// The representation keeps a source tier -- each file's original text plus its parsed form --
// so an unmodified file is re-emitted byte for byte and nothing the engine doesn't model is lost.
// ----------------------------------------
// aPath = configuration directory (defaults to this engine's configPath)
// Returns config model
// ----------------------------------------
nConfigEngine.prototype.load = function(aPath) {
	aPath = _$(aPath, "aPath").isString().default(this.configPath)

	var _cfg = { configPath: aPath, files: [], entries: [] }
	var parent = this

	NCE_KINDS.forEach(kind => {
		var _dir = aPath + "/" + kind + "s"
		if (!io.fileExists(_dir)) return

		$from(listFilesRecursive(_dir))
		.equals("isFile", true)
		.sort("filepath")
		.select(f => {
			if (f.filename.indexOf(".") == 0) return
			var _fmt
			if (f.filename.match(/\.ya?ml$/)) _fmt = "yaml"
			if (f.filename.match(/\.json$/))  _fmt = "json"
			if (f.filename.match(/\.js$/))    _fmt = "js"
			if (isUnDef(_fmt)) return

			var _file = {
				path    : f.filepath,
				relPath : String(f.filepath).substring(aPath.length + 1),
				format  : _fmt,
				raw     : io.readFileString(f.filepath),
				parsed  : __,
				dirty   : false,
				docShape: __
			}

			// .js plug files are code, not data. They are kept verbatim so they survive a
			// round trip, but they carry no structurally editable descriptors.
			if (_fmt != "js") {
				try {
					// Parsed exactly the way lib/nmain.js loads plug files, so the engine accepts
					// everything nAttrMon accepts -- including the !!js/eval tag used by some samples
					_file.parsed = (_fmt == "json" ? io.readFileJSON(f.filepath) : io.readFileYAML(f.filepath, true))
					_file.docShape = isArray(_file.parsed) ? "array" : "map"
					if (isArray(_file.parsed)) _file.parsed.forEach((doc, di) => { if (isMap(doc)) __nce_collect(_cfg, _file, doc, di) })
					else if (isMap(_file.parsed)) __nce_collect(_cfg, _file, _file.parsed, __)
				} catch(e) {
					_file.parseError = String(e)
				}
			}

			_cfg.files.push(_file)
		})
	})

	__nce_reindex(_cfg)

	return _cfg
}

// Finds one entry by id
// ----------------------------------------
// aCfg = config model
// anId = entry id (e.g. "input:Directory Name")
// Returns entry or undefined
// ----------------------------------------
nConfigEngine.prototype.get = function(aCfg, anId) {
	var _r = _$(aCfg.entries).isArray().default([]).filter(e => e.id == anId)
	return (_r.length > 0 ? _r[0] : __)
}

// Returns the file record backing an entry
// ----------------------------------------
var __nce_fileOf = function(aCfg, anEntry) {
	var _r = aCfg.files.filter(f => f.relPath == anEntry.file)
	return (_r.length > 0 ? _r[0] : __)
}

// ---------------------------------------------------------------------------------------------
// creation
// ---------------------------------------------------------------------------------------------

// Generates a configuration skeleton for a component. Required parameters are emitted as null:
// the engine never invents values.
// ----------------------------------------
// aKind = input | output | validation
// aName = constructor name
// Returns { kind, descriptor, missingRequired, metadata }
// ----------------------------------------
nConfigEngine.prototype.createSkeleton = function(aKind, aName) {
	var _c = this.getComponent(aKind, aName)
	if (isUnDef(_c)) throw "Unknown " + aKind + " component '" + aName + "'."

	var _execArgs = {}
	var _missing  = []
	_c.parameters.forEach(p => {
		if (p.required) {
			// A documented default is a fact from metadata, not an invented value
			_execArgs[p.name] = (isDef(p.default) ? clone(p.default) : null)
			if (isUnDef(p.default)) _missing.push(p.name)
		}
	})

	return {
		kind      : aKind,
		descriptor: { name: aName.replace(NCE_KIND_PREFIX[aKind], ""), execFrom: aName, execArgs: _execArgs },
		missingRequired: _missing,
		metadata  : clone(_c.metadata)
	}
}

// Creates a configuration fragment for a component with caller-supplied values
// ----------------------------------------
// aKind       = input | output | validation
// aName       = constructor name
// aDescriptor = descriptor fields to apply (execArgs merged over the skeleton)
// Returns descriptor map
// ----------------------------------------
nConfigEngine.prototype.create = function(aKind, aName, aDescriptor) {
	aDescriptor = _$(aDescriptor, "aDescriptor").isMap().default({})
	var _sk = this.createSkeleton(aKind, aName).descriptor
	var _d  = merge(_sk, aDescriptor)
	if (isMap(aDescriptor.execArgs)) _d.execArgs = merge(_sk.execArgs, aDescriptor.execArgs)
	return _d
}

// ---------------------------------------------------------------------------------------------
// modification
// ---------------------------------------------------------------------------------------------

// Marks the file backing an entry as modified
// ----------------------------------------
var __nce_touch = function(aCfg, anEntry) {
	var _f = __nce_fileOf(aCfg, anEntry)
	if (isDef(_f)) _f.dirty = true
}

// Sets one value inside an entry's descriptor
// ----------------------------------------
// aCfg   = config model
// anId   = entry id
// aPath  = dot path inside the descriptor (e.g. "execArgs.key")
// aValue = value to set
// Returns the modified entry
// ----------------------------------------
nConfigEngine.prototype.set = function(aCfg, anId, aPath, aValue) {
	var _e = this.get(aCfg, anId)
	if (isUnDef(_e)) throw "Unknown configuration entry '" + anId + "'."
	$$(_e.descriptor).set(aPath, aValue)
	__nce_touch(aCfg, _e)
	if (aPath == "name") __nce_reindex(aCfg)
	return _e
}

// Merges a partial descriptor into an entry
// ----------------------------------------
// aCfg    = config model
// anId    = entry id
// aPartial = descriptor fields to merge
// Returns the modified entry
// ----------------------------------------
nConfigEngine.prototype.patch = function(aCfg, anId, aPartial) {
	var _e = this.get(aCfg, anId)
	if (isUnDef(_e)) throw "Unknown configuration entry '" + anId + "'."
	_$(aPartial, "aPartial").isMap().$_()

	Object.keys(aPartial).forEach(k => {
		if (k == "execArgs" && isMap(aPartial.execArgs) && isMap(_e.descriptor.execArgs)) {
			Object.keys(aPartial.execArgs).forEach(ak => { _e.descriptor.execArgs[ak] = aPartial.execArgs[ak] })
		} else {
			_e.descriptor[k] = aPartial[k]
		}
	})
	__nce_touch(aCfg, _e)
	if (isString(aPartial.name)) __nce_reindex(aCfg)
	return _e
}

// Removes an entry from the configuration
// ----------------------------------------
// aCfg = config model
// anId = entry id
// Returns true when removed
// ----------------------------------------
nConfigEngine.prototype.remove = function(aCfg, anId) {
	var _e = this.get(aCfg, anId)
	if (isUnDef(_e)) throw "Unknown configuration entry '" + anId + "'."
	var _f = __nce_fileOf(aCfg, _e)
	if (isUnDef(_f)) throw "Configuration entry '" + anId + "' has no backing file."

	var _doc = isDef(_e.docIndex) ? _f.parsed[_e.docIndex] : _f.parsed
	if (isDef(_e.listIndex)) {
		_doc[_e.kind].splice(_e.listIndex, 1)
		if (_doc[_e.kind].length == 0) delete _doc[_e.kind]
		// Later siblings in the same list shift down
		aCfg.entries.forEach(o => {
			if (o !== _e && o.file == _e.file && o.kind == _e.kind && o.docIndex === _e.docIndex && isDef(o.listIndex) && o.listIndex > _e.listIndex) o.listIndex--
		})
	} else {
		delete _doc[_e.kind]
	}

	_f.dirty = true
	aCfg.entries = aCfg.entries.filter(o => o !== _e)
	__nce_reindex(aCfg)
	return true
}

// Adds a new plug descriptor to the configuration
// ----------------------------------------
// aCfg        = config model
// aKind       = input | output | validation
// aDescriptor = descriptor map
// anOptions   = { file: relative path of the target file }
// Returns the new entry
// ----------------------------------------
nConfigEngine.prototype.add = function(aCfg, aKind, aDescriptor, anOptions) {
	anOptions = _$(anOptions, "anOptions").isMap().default({})
	_$(aDescriptor, "aDescriptor").isMap().$_()
	if (NCE_KINDS.indexOf(aKind) < 0) throw "Unknown component kind '" + aKind + "'."

	var _rel = _$(anOptions.file, "file").isString().default(aKind + "s/" + String(_$(aDescriptor.name).default("plug")).replace(/[^a-zA-Z0-9._-]/g, "_") + ".yaml")
	var _f = aCfg.files.filter(f => f.relPath == _rel)[0]

	if (isUnDef(_f)) {
		_f = { path: aCfg.configPath + "/" + _rel, relPath: _rel, format: (_rel.match(/\.json$/) ? "json" : "yaml"), raw: "", parsed: {}, dirty: true, docShape: "map" }
		aCfg.files.push(_f)
	}
	if (_f.format == "js") throw "Cannot add a descriptor to the JavaScript plug file '" + _rel + "'."
	if (isUnDef(_f.parsed)) throw "Cannot add a descriptor to the unparseable file '" + _rel + "'."

	var _docIndex = (_f.docShape == "array" ? 0 : __)
	if (_f.docShape == "array" && _f.parsed.length == 0) { _f.parsed.push({}) }
	var _doc = isDef(_docIndex) ? _f.parsed[_docIndex] : _f.parsed

	var _listIndex
	if (isUnDef(_doc[aKind])) {
		_doc[aKind] = aDescriptor
	} else if (isArray(_doc[aKind])) {
		_doc[aKind].push(aDescriptor)
		_listIndex = _doc[aKind].length - 1
	} else {
		_doc[aKind] = [ _doc[aKind], aDescriptor ]
		_listIndex = 1
		// The pre-existing single descriptor is now list element 0
		aCfg.entries.forEach(o => { if (o.file == _rel && o.kind == aKind && o.docIndex === _docIndex && isUnDef(o.listIndex)) o.listIndex = 0 })
	}

	var _e = { kind: aKind, file: _rel, docIndex: _docIndex, listIndex: _listIndex, descriptor: aDescriptor }
	aCfg.entries.push(_e)
	_f.dirty = true
	__nce_reindex(aCfg)
	return _e
}

// ---------------------------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------------------------

// Walks the query surfaces a component's metadata declares and validates each one
// ----------------------------------------
var __nce_validateQueries = function(aDiag, aComponent, aDescriptor, aPathPrefix) {
	if (isUnDef(aComponent) || !isMap(aDescriptor.execArgs)) return 0
	var _n = 0

	aComponent.parameters.forEach(p => {
		if (isUnDef(p.query) || !isMap(p.query)) return
		var _val = aDescriptor.execArgs[p.name]
		if (isUnDef(_val)) return

		Object.keys(p.query).forEach(sub => {
			var _dialect = p.query[sub]

			// sub is a path relative to the argument value: "." the value itself,
			// "[].x" each array element's x, "{}.x" each map value's x
			var _targets = []
			if (sub == "." || sub == "") {
				_targets.push({ path: p.name, value: _val })
			} else if (sub.indexOf("[].") == 0) {
				if (isArray(_val)) _val.forEach((el, i) => { if (isMap(el) && isDef(el[sub.substring(3)])) _targets.push({ path: p.name + "[" + i + "]." + sub.substring(3), value: el[sub.substring(3)] }) })
			} else if (sub.indexOf("{}.") == 0) {
				if (isMap(_val)) Object.keys(_val).forEach(k => { if (isMap(_val[k]) && isDef(_val[k][sub.substring(3)])) _targets.push({ path: p.name + "." + k + "." + sub.substring(3), value: _val[k][sub.substring(3)] }) })
			} else if (isMap(_val) && isDef(_val[sub])) {
				_targets.push({ path: p.name + "." + sub, value: _val[sub] })
			}

			_targets.forEach(t => {
				_n++
				var _p = aPathPrefix + ".execArgs." + t.path
				switch(_dialect) {
				case "jmespath":
				case "dotpath":
					if (!isString(t.value)) { __nce_add(aDiag, "errors", _p, "INVALID_QUERY", "Query: expected a " + _dialect + " expression string."); return }
					__nce_merge(aDiag, nQuery.validatePath(t.value, _dialect), _p)
					break
				case "nlinq":
					if (!isMap(t.value)) { __nce_add(aDiag, "errors", _p, "INVALID_QUERY", "Query: expected an nLinq query map."); return }
					__nce_merge(aDiag, nQuery.validateAST(t.value), _p)
					break
				case "nlinqText":
				case "nlinqAny":
					if (isMap(t.value)) { __nce_merge(aDiag, nQuery.validateAST(t.value), _p); return }
					if (!isString(t.value)) { __nce_add(aDiag, "errors", _p, "INVALID_QUERY", "Query: expected an nLinq query string or map."); return }
					var _parsed = nQuery.parse(t.value)
					if (isDef(_parsed.mode) && _parsed.mode == "raw") __nce_add(aDiag, "warnings", _p, "UNSUPPORTED_QUERY_EXPRESSION", "Query: '" + t.value + "' isn't structurally editable; it is preserved as written.")
					break
				default:
					__nce_add(aDiag, "warnings", _p, "INVALID_QUERY", "Query: unknown dialect '" + _dialect + "' declared in metadata.")
				}
			})
		})
	})

	return _n
}

// Validates one plug descriptor against the descriptor schema and its component metadata
// ----------------------------------------
// aDiag  = diagnostics to add to
// anEntry = config entry
// Returns { hasMetadata }
// ----------------------------------------
nConfigEngine.prototype._validateEntry = function(aDiag, anEntry) {
	var _p = anEntry.id
	var _d = clone(anEntry.descriptor)

	if (!isMap(_d)) {
		__nce_add(aDiag, "errors", _p, "MALFORMED_DESCRIPTOR", "Descriptor: expected a map for " + anEntry.kind + ".")
		return { hasMetadata: false, queries: 0 }
	}

	// Reuse the descriptor helpers nAttrMon itself uses, so there is a single definition of
	// what a valid descriptor is
	if (this._hasNMain()) {
		// nAttrMon.prototype.normalizeDescriptorLegacyKeys reports deprecations by logging, which
		// a validation API must not do. The compatibility map -- the actual source of truth -- is
		// reused, and the same normalization is applied here so legacy keys become diagnostics
		// instead of daemon log lines.
		var _legacy = this._callHelper("getDescriptorLegacyMap", [])
		Object.keys(_d).forEach(k => {
			if (!isString(k)) return
			var _target = _legacy[String(k).toLowerCase()]
			if (isDef(_target) && isUnDef(_d[_target])) {
				_d[_target] = _d[k]
				__nce_add(aDiag, "warnings", _p + "." + k, "LEGACY_KEY", "Descriptor: '" + k + "' is deprecated; use '" + _target + "'.")
			}
		})

		this._callHelper("validateDescriptorSchema", [ _d, anEntry.kind ])
			.forEach(m => __nce_add(aDiag, "errors", _p, "MALFORMED_DESCRIPTOR", m))
	}

	// A descriptor with an inline exec (or an oJob execJob) has no component to look up --
	// that is a valid, widely used form, not an unknown component
	if (isUnDef(_d.execFrom)) return { hasMetadata: false, queries: 0 }

	var _c = this.getComponent(anEntry.kind, _d.execFrom)
	if (isUnDef(_c)) {
		__nce_add(aDiag, "errors", _p + ".execFrom", "UNKNOWN_COMPONENT", "Component '" + _d.execFrom + "' isn't available to this installation.")
		return { hasMetadata: false, queries: 0 }
	}

	if (!_c.metadata.present || _c.parameters.length == 0) {
		__nce_add(aDiag, "info", _p, "LOW_METADATA_COVERAGE", "Component '" + _d.execFrom + "' has no parameter metadata; parameter checks were skipped.")
		return { hasMetadata: false, queries: 0 }
	}

	var _execArgs = isMap(_d.execArgs) ? _d.execArgs : {}
	var _declared = {}
	_c.parameters.forEach(p => { _declared[p.name] = p })

	_c.parameters.forEach(p => {
		var _v = _execArgs[p.name]
		var _pp = _p + ".execArgs." + p.name

		if (p.required && (isUnDef(_v) || isNull(_v))) {
			__nce_add(aDiag, "errors", _pp, "REQUIRED_PARAMETER", "Parameter '" + p.name + "' is required.")
			return
		}
		if (isUnDef(_v)) return

		if (isDef(p.deprecated)) __nce_add(aDiag, "warnings", _pp, "LEGACY_KEY", "Parameter '" + p.name + "' is deprecated.")

		var _t = __nce_checkType(_v, p.type)
		if (_t === false) __nce_add(aDiag, "errors", _pp, "PARAMETER_TYPE", "Parameter '" + p.name + "' should be of type '" + p.type.raw + "'.")

		if (isArray(p.enum) && p.enum.length > 0 && p.enum.indexOf(_v) < 0)
			__nce_add(aDiag, "errors", _pp, "PARAMETER_ENUM", "Parameter '" + p.name + "' should be one of: " + p.enum.join(", ") + ".")
	})

	// Almost all packaged metadata is generated boilerplate that doesn't list every argument a
	// constructor reads, so flagging undeclared parameters there would be noise, not signal
	if (_c.metadata.coverage == "full") {
		Object.keys(_execArgs).forEach(k => {
			if (isUnDef(_declared[k]) && k != "secKey" && k != "secOut")
				__nce_add(aDiag, "warnings", _p + ".execArgs." + k, "UNKNOWN_PARAMETER", "Parameter '" + k + "' isn't declared in metadata.")
		})
	}

	var _q = __nce_validateQueries(aDiag, _c, _d, _p)

	return { hasMetadata: true, queries: _q }
}

// Validates a configuration, returning structured diagnostics
// ----------------------------------------
// aCfg      = config model (or a directory path to load first)
// anOptions = { mode: "warn" | "strict" }
// Returns { valid, errors, warnings, info, stats }
// ----------------------------------------
nConfigEngine.prototype.validate = function(aCfg, anOptions) {
	anOptions = _$(anOptions, "anOptions").isMap().default({})
	var _mode = _$(anOptions.mode, "mode").isString().default(this.mode)
	if (isString(aCfg)) aCfg = this.load(aCfg)

	var _d = __nce_diag()
	var _withMeta = 0, _queries = 0

	_$(aCfg.files).isArray().default([]).forEach(f => {
		if (isDef(f.parseError)) __nce_add(_d, "errors", f.relPath, "STRUCTURAL_ERROR", "Couldn't parse configuration file: " + f.parseError)
	})

	var parent = this
	_$(aCfg.entries).isArray().default([]).forEach(e => {
		var _r = parent._validateEntry(_d, e)
		if (_r.hasMetadata) _withMeta++
		_queries += _r.queries
	})

	this.getMetadataIssues().forEach(i => __nce_add(_d, "warnings", "", "METADATA_ISSUE", i))

	_d.stats = {
		files          : _$(aCfg.files).isArray().default([]).length,
		entries        : _$(aCfg.entries).isArray().default([]).length,
		withMetadata   : _withMeta,
		withoutMetadata: _$(aCfg.entries).isArray().default([]).length - _withMeta,
		queriesChecked : _queries
	}

	// Strict mode makes every advisory finding a failure
	if (_mode == "strict" && _d.warnings.length > 0) {
		_d.errors = _d.errors.concat(_d.warnings.map(w => merge(clone(w), { severity: "error" })))
		_d.warnings = []
		_d.valid = false
	}

	return _d
}

// ---------------------------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------------------------

// Explains one configuration entry by combining it with its component metadata. Everything in
// the result is derived deterministically -- nothing is inferred or generated.
// ----------------------------------------
// aCfg = config model
// anId = entry id
// Returns explanation map
// ----------------------------------------
nConfigEngine.prototype.explainComponent = function(aCfg, anId) {
	var _e = this.get(aCfg, anId)
	if (isUnDef(_e)) throw "Unknown configuration entry '" + anId + "'."

	var _d = _e.descriptor
	var _r = {
		id         : _e.id,
		name       : _e.name,
		type       : _e.kind,
		file       : _e.file,
		object     : _d.execFrom,
		inline     : isUnDef(_d.execFrom) && isDef(_d.exec),
		description: _d.description,
		trigger    : {}
	}

	if (isDef(_d.cron))         _r.trigger.cron = _d.cron
	if (isDef(_d.timeInterval)) _r.trigger.timeInterval = _d.timeInterval
	if (isDef(_d.chSubscribe))  _r.trigger.chSubscribe = _d.chSubscribe

	var _c = isDef(_d.execFrom) ? this.getComponent(_e.kind, _d.execFrom) : __
	if (isDef(_c)) {
		_r.title = _c.title
		if (isUnDef(_r.description)) _r.description = _c.description
		_r.metadata = clone(_c.metadata)
		_r.examples = clone(_c.examples)
	}

	_r.parameters = {}
	var _execArgs = isMap(_d.execArgs) ? _d.execArgs : {}
	var _declared = {}
	if (isDef(_c)) _c.parameters.forEach(p => { _declared[p.name] = p })

	Object.keys(_execArgs).sort().forEach(k => {
		var p = _declared[k]
		var _entry = { value: (isDef(p) && p.secret === true ? "(secret)" : clone(_execArgs[k])) }
		if (isDef(p)) {
			_entry.type        = p.type.raw
			_entry.description = p.description
			_entry.required    = p.required
			if (isDef(p.default)) _entry.default = clone(p.default)
			if (isDef(p.unit))    _entry.unit = p.unit
			if (isDef(p.enum))    _entry.enum = clone(p.enum)
			if (isDef(p.secret))  _entry.secret = p.secret
			if (isDef(p.query))   _entry.query = clone(p.query)
		} else {
			_entry.declared = false
		}
		_r.parameters[k] = _entry
	})

	// Only stated where the configuration actually says so
	if (isString(_execArgs.attrTemplate)) _r.produces = [ _execArgs.attrTemplate ]

	return _r
}

// Explains a whole configuration
// ----------------------------------------
// aCfg = config model (or a directory path to load first)
// Returns { configPath, files, components: [...] }
// ----------------------------------------
nConfigEngine.prototype.explain = function(aCfg) {
	if (isString(aCfg)) aCfg = this.load(aCfg)
	var parent = this
	return {
		configPath: aCfg.configPath,
		files     : aCfg.files.map(f => ({ path: f.relPath, format: f.format, entries: aCfg.entries.filter(e => e.file == f.relPath).length })),
		components: aCfg.entries.map(e => parent.explainComponent(aCfg, e.id))
	}
}

// ---------------------------------------------------------------------------------------------
// serialization
// ---------------------------------------------------------------------------------------------

// True when a file's original text relies on YAML anchors, aliases or merge keys
// ----------------------------------------
var __nce_hasAnchors = function(aRaw) {
	return isString(aRaw) && (!isNull(aRaw.match(/(^|\s)&[A-Za-z0-9_-]+\s*$/m)) || !isNull(aRaw.match(/<<\s*:/)) || !isNull(aRaw.match(/:\s*\*[A-Za-z0-9_-]+/)))
}

// Serializes a configuration back to file contents.
//
// Unmodified files are returned exactly as they were read. Modified files are re-emitted from
// the model, which loses YAML anchors, comments and block-scalar formatting -- reported as a
// FORMATTING_LOSS warning rather than applied silently.
// ----------------------------------------
// aCfg = config model
// Returns { files: [ { path, content, dirty, formattingLoss } ], warnings: [...] }
// ----------------------------------------
nConfigEngine.prototype.toYAML = function(aCfg) {
	var _r = { files: [], warnings: [] }

	aCfg.files.forEach(f => {
		if (!f.dirty) {
			_r.files.push({ path: f.relPath, content: f.raw, dirty: false, formattingLoss: false })
			return
		}

		var _content = (f.format == "json" ? stringify(f.parsed, __, "  ") : af.toYAML(f.parsed))
		// A '#' only starts a YAML comment at the start of a line or after whitespace, so a '#'
		// inside a quoted string or a URL fragment isn't treated as one
		var _loss = (f.format != "json") && (__nce_hasAnchors(f.raw) || !isNull(f.raw.match(/(^|\s)#/)))
		if (_loss) {
			_r.warnings.push({
				path: f.relPath, code: "FORMATTING_LOSS", severity: "warning",
				message: "Rewriting '" + f.relPath + "' doesn't preserve its YAML anchors, comments or block scalars."
			})
		}
		_r.files.push({ path: f.relPath, content: _content, dirty: true, formattingLoss: _loss })
	})

	return _r
}

// Serializes a configuration to JSON
// ----------------------------------------
// aCfg = config model
// Returns { files: [ { path, content } ] }
// ----------------------------------------
nConfigEngine.prototype.toJSON = function(aCfg) {
	return {
		files: aCfg.files.filter(f => f.format != "js").map(f => ({
			path   : f.relPath.replace(/\.ya?ml$/, ".json"),
			content: stringify(f.parsed, __, "  ")
		}))
	}
}

// Writes a configuration back to disk, touching only modified files.
//
// Refuses by default when a modified file relies on YAML anchors: rewriting it would expand
// them across every entry that shared them, so that is made a caller decision.
// ----------------------------------------
// aCfg      = config model
// aPath     = target directory (defaults to the configuration's own path)
// anOptions = { allowFormattingLoss: false }
// Returns { written: [...], skipped: [...], warnings: [...] }
// ----------------------------------------
nConfigEngine.prototype.save = function(aCfg, aPath, anOptions) {
	anOptions = _$(anOptions, "anOptions").isMap().default({})
	aPath = _$(aPath, "aPath").isString().default(aCfg.configPath)
	var _allow = _$(anOptions.allowFormattingLoss, "allowFormattingLoss").isBoolean().default(false)

	var _ser = this.toYAML(aCfg)
	var _r = { written: [], skipped: [], warnings: _ser.warnings }

	_ser.files.forEach(f => {
		if (!f.dirty) return
		if (f.formattingLoss && !_allow) { _r.skipped.push(f.path); return }
		var _target = aPath + "/" + f.path
		io.mkdir(String(_target).replace(/\/[^\/]+$/, ""))
		io.writeFileString(_target, f.content)
		_r.written.push(f.path)
	})

	return _r
}

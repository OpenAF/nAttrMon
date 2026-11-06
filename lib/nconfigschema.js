// Shared, side-effect-free descriptor and metadata helpers.
// Loading this module never reads daemon configuration or starts runtime services.
var nConfigSchema = {}

nConfigSchema.validateObjectMeta = function(aMeta) {
	var issues = []
	if (nConfigSchema.unresolved(aMeta).length > 0) return [ "Object metadata: executable YAML tags are not allowed." ]
	if (!isMap(aMeta)) return [ "Object metadata: expected a map." ]

	if ([ "input", "output", "validation" ].indexOf(aMeta.kind) < 0)
		issues.push("Object metadata: 'kind' must be input, output or validation.")
	if (!isString(aMeta.constructor) || String(aMeta.constructor).trim() == "")
		issues.push("Object metadata: 'constructor' must be a non-empty string.")
	if (!isString(aMeta.title) || String(aMeta.title).trim() == "")
		issues.push("Object metadata: 'title' must be a non-empty string for '" + _$(aMeta.constructor).default("unknown") + "'.")
	if (!isString(aMeta.description) || String(aMeta.description).trim() == "")
		issues.push("Object metadata: 'description' must be a non-empty string for '" + _$(aMeta.constructor).default("unknown") + "'.")
	if (isDef(aMeta.examples) && (!isArray(aMeta.examples) || aMeta.examples.some(p => !isString(p))))
		issues.push("Object metadata: 'examples' must be an array of strings for '" + _$(aMeta.constructor).default("unknown") + "'.")
	if (!isArray(aMeta.arguments)) {
		issues.push("Object metadata: 'arguments' must be an array for '" + _$(aMeta.constructor).default("unknown") + "'.")
	} else {
		aMeta.arguments.forEach((arg, idx) => {
			if (!isMap(arg)) {
				issues.push("Object metadata: argument #" + idx + " must be a map for '" + _$(aMeta.constructor).default("unknown") + "'.")
				return
			}
			if (!isString(arg.name) || String(arg.name).trim() == "") issues.push("Object metadata: argument #" + idx + " needs a non-empty 'name'.")
			if (!isString(arg.type) || String(arg.type).trim() == "") issues.push("Object metadata: argument '" + _$(arg.name).default(idx) + "' needs a non-empty 'type'.")
			if (!isString(arg.description) || String(arg.description).trim() == "") issues.push("Object metadata: argument '" + _$(arg.name).default(idx) + "' needs a non-empty 'description'.")
			if (isUnDef(arg.example)) issues.push("Object metadata: argument '" + _$(arg.name).default(idx) + "' needs an 'example'.")
			if (isDef(arg.required) && !isBoolean(arg.required)) issues.push("Object metadata: argument '" + _$(arg.name).default(idx) + "' has non-boolean 'required'.")
			if (isDef(arg.secret) && !isBoolean(arg.secret)) issues.push("Object metadata: argument '" + _$(arg.name).default(idx) + "' has non-boolean 'secret'.")
		})
	}
	return issues
}

nConfigSchema.getDescriptorLegacyMap = function() {
	return {
		execfrom: "execFrom",
		timeinterval: "timeInterval",
		waitforfinish: "waitForFinish",
		onlyonevent: "onlyOnEvent",
		killafterminutes: "killAfterMinutes",
		chsubscribe: "chSubscribe",
		chhandlesetall: "chHandleSetAll",
		execargs: "execArgs"
	}
}

nConfigSchema.validateDescriptorSchema = function(yy, type) {
	var _issues = []
	if (nConfigSchema.isUnresolved(yy)) return _issues
	if (!isMap(yy)) {
		_issues.push("Descriptor schema: expected a map for " + type + ", got '" + typeof yy + "'.")
		return _issues
	}

	if (!nConfigSchema.isUnresolved(yy.name) && (!isString(yy.name) || String(yy.name).trim() == "")) _issues.push("Descriptor schema: 'name' should be a non-empty string for " + type + ".")
	if (isUnDef(yy.exec) && isUnDef(yy.execFrom)) _issues.push("Descriptor schema: either 'exec' or 'execFrom' must be provided for " + type + " plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.exec) && isDef(yy.execFrom)) _issues.push("Descriptor schema: both 'exec' and 'execFrom' are set for " + type + " plug '" + _$(yy.name).default("unnamed") + "'; this is ambiguous.")

	if (isDef(yy.timeInterval) && !nConfigSchema.isUnresolved(yy.timeInterval) && !isNumber(yy.timeInterval)) _issues.push("Descriptor schema: 'timeInterval' should be a number for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.cron) && !nConfigSchema.isUnresolved(yy.cron) && !isString(yy.cron)) _issues.push("Descriptor schema: 'cron' should be a string for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.waitForFinish) && !nConfigSchema.isUnresolved(yy.waitForFinish) && !isBoolean(yy.waitForFinish)) _issues.push("Descriptor schema: 'waitForFinish' should be boolean for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.onlyOnEvent) && !nConfigSchema.isUnresolved(yy.onlyOnEvent) && !isBoolean(yy.onlyOnEvent)) _issues.push("Descriptor schema: 'onlyOnEvent' should be boolean for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.killAfterMinutes) && !nConfigSchema.isUnresolved(yy.killAfterMinutes) && !isNumber(yy.killAfterMinutes)) _issues.push("Descriptor schema: 'killAfterMinutes' should be a number for plug '" + _$(yy.name).default("unnamed") + "'.")
	if (isDef(yy.chSubscribe) && !nConfigSchema.isUnresolved(yy.chSubscribe) && !(isString(yy.chSubscribe) || isArray(yy.chSubscribe))) _issues.push("Descriptor schema: 'chSubscribe' should be string or array for plug '" + _$(yy.name).default("unnamed") + "'.")

	return _issues
}

// Normalization is shared; callers choose how to report compatibility diagnostics.
nConfigSchema.normalizeDescriptorLegacyKeys = function(yy, onLegacy) {
	yy = _$(yy, "yy").isMap().default({})
	var mapping = nConfigSchema.getDescriptorLegacyMap()
	Object.keys(yy).forEach(k => {
		var target = mapping[String(k).toLowerCase()]
		if (isDef(target) && isUnDef(yy[target])) {
			yy[target] = yy[k]
			if (isFunction(onLegacy)) onLegacy(k, target)
		}
	})
	return yy
}

// The marker is data (and survives clone/patch), never a callable JavaScript value.
nConfigSchema.isUnresolved = function(value) {
	return isMap(value) && value.__nattrmonYamlTag === "tag:yaml.org,2002:js/eval" && isString(value.value)
}

nConfigSchema.unresolved = function(value) {
	var found = [], seen = []
	var visit = function(v, path) {
		if (nConfigSchema.isUnresolved(v)) { found.push({ path: path, expression: v.value }); return }
		if (!(isMap(v) || isArray(v)) || seen.indexOf(v) >= 0) return
		seen.push(v)
		Object.keys(v).forEach(k => visit(v[k], path + (isArray(v) ? "[" + k + "]" : (path.length ? "." : "") + k)))
	}
	visit(value, "")
	return found
}

// Each schema belongs to this module. OpenAF's global YAML flags/schema stay untouched.
nConfigSchema._yamlSchema = function() {
	loadJSYAML()
	if (isUnDef(nConfigSchema.__yamlSchema)) {
		var tag = new jsyaml.Type("tag:yaml.org,2002:js/eval", {
			kind: "scalar", resolve: function() { return true },
			construct: function(value) { return { __nattrmonYamlTag: "tag:yaml.org,2002:js/eval", value: String(isNull(value) ? "" : value) } },
			predicate: nConfigSchema.isUnresolved,
			represent: function(value) { return value.value }
		})
		nConfigSchema.__yamlSchema = jsyaml.DEFAULT_SCHEMA.extend([tag])
	}
	return nConfigSchema.__yamlSchema
}

nConfigSchema.parseYAML = function(text, rejectExecutable) {
	var schema = nConfigSchema._yamlSchema()
	var docs = jsyaml.loadAll(String(text), { schema: schema })
	var value = docs.length == 1 ? docs[0] : docs
	if (rejectExecutable && nConfigSchema.unresolved(value).length > 0) throw "Executable YAML tags are not allowed in declarative metadata."
	return value
}

nConfigSchema.toYAML = function(value) {
	var schema = nConfigSchema._yamlSchema()
	return jsyaml.dump(value, { schema: schema, indent: __flags.YAML.indent, noArrayIndent: !__flags.YAML.arrayIndent, lineWidth: __flags.YAML.lineWidth })
}

nConfigSchema.toJSON = function(value) {
	if (nConfigSchema.unresolved(value).length > 0) throw "Cannot convert unresolved YAML expressions to JSON; retain YAML or replace each expression with an explicit value."
	return stringify(value, __, "  ")
}

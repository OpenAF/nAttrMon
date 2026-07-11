// nAttrMon output plug functionality
// Copyright 2023 Nuno Aguiar

// Output plug wrapper
// ----------------------------------------
// aFunction = function to execute for the plug
// ----------------------------------------
var nOutput = function(aFunction) {
	this.aFunction = aFunction
	this.count = 0
	this.lastSeen = {}
}

// Bound on the number of keys tracked by lastSeen (see below); prevents
// unbounded growth for outputs that see an ever-growing set of attribute names
nOutput.prototype.MAX_LASTSEEN_ENTRIES = 8192

// Execute output plug
// ----------------------------------------
// scope = plug scope
// args  = plug arguments
// meta  = plug metadata
// Returns map with produced outputs
// ----------------------------------------
nOutput.prototype.exec = function(scope, args, meta) {
	var ret
	try {
		ret = this.aFunction(scope, args, meta)
	} catch(e) {
		logErr(meta.aName + " | " + __nam_err(e, true, true, this.aFunction.toString()))
	}
	this.count++
	return { outputs: ret }
}

// Track last seen attribute timestamps per key
// ----------------------------------------
// aKey         = attribute key
// anAttribute  = attribute metadata (expects date)
// Returns true if attribute was seen before with different timestamp
// ----------------------------------------
nOutput.prototype.see = function(aKey, anAttribute) {
	var newTime = isDef(anAttribute.date) ? (new Date(anAttribute.date)).getTime() : undefined
	var found = false
	var isNewKey = !isDefined(this.lastSeen[aKey])
	if (!isNewKey && this.lastSeen[aKey] != newTime) {
		found = true
	} else {
		found = false
	}

	if (isNewKey) {
		var _keys = Object.keys(this.lastSeen)
		if (_keys.length >= this.MAX_LASTSEEN_ENTRIES) {
			var _lastSeen = this.lastSeen
			_keys.sort((a, b) => (_lastSeen[a] || 0) - (_lastSeen[b] || 0))
			var toEvict = Math.ceil(_keys.length * 0.25)
			for (var i = 0; i < toEvict; i++) delete _lastSeen[_keys[i]]
		}
	}

	this.lastSeen[aKey] = newTime
	return found
}

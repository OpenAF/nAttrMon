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
	this.__lastSeenMap = this.lastSeen
	this.__lastSeenSize = 0
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
	var ret = this.aFunction(scope, args, meta)
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
	var parent = this
	return syncFn(function() {
		if (parent.__lastSeenMap !== parent.lastSeen) {
			parent.__lastSeenMap = parent.lastSeen
			parent.__lastSeenSize = Object.keys(parent.lastSeen).length
		}
		var newTime = isDef(anAttribute.date) ? (new Date(anAttribute.date)).getTime() : undefined
		var isNewKey = !isDefined(parent.lastSeen[aKey])
		var found = !isNewKey && parent.lastSeen[aKey] != newTime
		if (isNewKey && parent.__lastSeenSize >= parent.MAX_LASTSEEN_ENTRIES) {
			var keys = Object.keys(parent.lastSeen), lastSeen = parent.lastSeen
			keys.sort((a, b) => (lastSeen[a] || 0) - (lastSeen[b] || 0))
			var toEvict = Math.ceil(keys.length * 0.25)
			for (var i = 0; i < toEvict; i++) delete lastSeen[keys[i]]
			parent.__lastSeenSize -= toEvict
		}
		var wasOwn = Object.prototype.hasOwnProperty.call(parent.lastSeen, aKey)
		parent.lastSeen[aKey] = newTime
		if (!wasOwn && Object.prototype.hasOwnProperty.call(parent.lastSeen, aKey)) parent.__lastSeenSize++
		return found
	}, this)
}

// nAttrMon plug functionality
// Copyright 2023 Nuno Aguiar

// Plug wrapper storing metadata and execution statistics
// ----------------------------------------
// aInputMeta = plug metadata map
// args       = plug arguments
// aObject    = executable plug object (nInput/nOutput/nValidation)
// ----------------------------------------
var nPlug = function(aInputMeta, args, aObject) {
	this.aName            = (isUnDef(aInputMeta.name)) ? "untitled" : aInputMeta.name
	this.aDescription     = (isUnDef(aInputMeta.description)) ? "" : aInputMeta.description
	this.type             = (isUnDef(aInputMeta.type)) ? "system" : aInputMeta.type
	this.aCategory        = (isUnDef(aInputMeta.category)) ? "uncategorized" : aInputMeta.category
	this.aCron            = (isUnDef(aInputMeta.cron)) ? void 0 : aInputMeta.cron
	this.chSubscribe      = (isUnDef(aInputMeta.chSubscribe)) ? void 0: aInputMeta.chSubscribe
	this.chHandleSetAll   = (isUnDef(aInputMeta.chHandleSetAll)) ? void 0 : aInputMeta.chHandleSetAll
	this.aTime            = (isUnDef(aInputMeta.timeInterval)) ? -1 : aInputMeta.timeInterval
	this.waitForFinish    = (isUnDef(aInputMeta.waitForFinish)) ? true : aInputMeta.waitForFinish
	this.onlyOnEvent      = (isUnDef(aInputMeta.onlyOnEvent)) ? false : aInputMeta.onlyOnEvent
	this.killAfterMinutes = (isUnDef(aInputMeta.killAfterMinutes)) ? __NAM_MAXPLUGEXECUTE_TIME : aInputMeta.killAfterMinutes
	this.help             = (isUnDef(aInputMeta.help)) ? void 0 : aInputMeta.help
	this.attrPattern      = (isUnDef(aInputMeta.attrPattern)) ? void 0 : aInputMeta.attrPattern
	this.toArray          = _$(aInputMeta.toArray).default(void 0)
	this.aStamp           = _$(aInputMeta.stamp).default(void 0)
	this.aMerge           = _$(aInputMeta.merge).default(void 0)
	this.aSort            = _$(aInputMeta.sort).default(void 0)	
	this.aExecPre         = _$(aInputMeta.execPre).default(void 0)
	this.aExecPos         = _$(aInputMeta.execPos).default(void 0)
	this.created          = new Date()
	this.aObject = aObject
	this.args = args

	this.lastExecTimeInMs = -1
	this.numberOfExecs = 0
	this.numberOfExecsInError = 0
	this.numberOfRunning = 0
	this.avgExecTimeInMs = 0

	this.chPlugs = "nattrmon::plugs"
	$ch(this.chPlugs).create(1, "simple")
	this.touch()

	if (isDef(this.help) && isObject(this.help)) {
		for(var attr in this.help) {
			nattrmon.setAttribute(attr, this.help[attr])
		}
	}
}

/**
 * <odoc>
 * <key>nattrmon.getCh() : Channel</key>
 * Retrieves the current openaf channel for plugs.
 * </odoc>
 */
nPlug.prototype.getCh = function() {
	return $ch(this.chPlugs)
}

// Execute wrapped plug object
// ----------------------------------------
// aScope    = execution scope
// extraArgs = additional arguments to merge
// Returns plug execution result or throws
// ----------------------------------------
nPlug.prototype.exec = function(aScope, extraArgs) {
	var argsToSend = {}
	argsToSend.aTime = this.aTime
	argsToSend.waitForFinish = this.waitForFinish
	argsToSend.onlyOnEvent = this.onlyOnEvent
	for (var i in this.args) {
		argsToSend[i] = this.args[i]
	}
	argsToSend = merge(argsToSend, extraArgs)

	this.numberOfRunning++
	this.touch(true)
	var init = now(), res, excep, inError = false
	try {
		if (isDef(this.aExecPre)) {
			if (nattrmon.debugFlag && isDef(ow.loadDebug)) {
				this.aExecPre = ow.debug.debug(this.aExecPre)
			}
			var ret = (new Function("scope", "args", this.aExecPre))(aScope, argsToSend)
			if (isDef(ret)) argsToSend = ret
		}
		res = this.aObject.exec(aScope, argsToSend, this)
		if (isDef(this.aExecPos)) {
			var ret = (new Function("value", "scope", "args", this.aExecPos))(res, aScope, argsToSend)
			if (isDef(ret)) res = ret
		}
		this.lastExecTimeInMs = now() - init
		this.numberOfExecs++
		this.avgExecTimeInMs = (this.numberOfExecs <= 1) ? 
								this.lastExecTimeInMs : 
								(((this.numberOfExecs - 1) * this.avgExecTimeInMs) + this.lastExecTimeInMs) / this.numberOfExecs	
		this.numberOfRunning--								
	} catch(e) {
		inError = true
		excep = e
		this.numberOfExecsInError++
		this.numberOfRunning--
		this.touch(true)
	}
	
	if (inError) throw excep
	return res
}

// Attempt to close wrapped plug object
// ----------------------------------------
// Returns close error or undefined
// ----------------------------------------
nPlug.prototype.close = function() {
	try {
		this.aObject.close()
	} catch(e) {
		return e
	}
}

// Update plug bookkeeping channel entry
// ----------------------------------------
// dontTouchLast = keep previous last execution timestamp if true
// ----------------------------------------
nPlug.prototype.touch = function(dontTouchLast) {
	var last = new Date()

	if (dontTouchLast) {
		var prev = $ch(this.chPlugs).get({ name: this. aName })
		if (isDef(prev)) last = prev.last
	}

	$ch(this.chPlugs).set({ 
		name: this.aName
	}, { 
		meta: {
			name: this.aName,
			description: this.aDescription,
			type: this.type,
			category: this.aCategory,
			cron: this.aCron,
			chSubscribe: this.chSubscribe,
			timeInterval: this.aTime,
			waitForFinish: this.waitForFinish,
			killAfterMinutes: this. killAfterMinutes,
			onlyOnEvent: this.onlyOnEvent,
			stamp: this.aStamp,
			toArray: this.toArray,
			merge: this.aMerge,
			sort: this.aSort
		},
		args: (isUnDef(this.args) ? {} : this.args),
		last: last,
		created: this.created,
		stats: {
			lastExecTimeInMs: this.lastExecTimeInMs,
			avgExecTimeInMs: this.avgExecTimeInMs,
			numberOfExecs: this.numberOfExecs,
			numberOfExecsInError: this.numberOfExecsInError,
			numberOfRunning: this.numberOfRunning
		}
	})
}

// Retrieve plug name
// ----------------------------------------
// Returns configured name
// ----------------------------------------
nPlug.prototype.getName = function() { return this.aName; }

// Retrieve plug category
// ----------------------------------------
// Returns configured category
// ----------------------------------------
nPlug.prototype.getCategory = function() { return this.aCategory; }

// Retrieve plug execution interval
// ----------------------------------------
// Returns interval in ms
// ----------------------------------------
nPlug.prototype.getTime = function() { return this.aTime; }

// Retrieve wait-for-finish flag
// ----------------------------------------
// Returns boolean flag
// ----------------------------------------
nPlug.prototype.getWaitForFinish = function() { return this.waitForFinish; }

// Retrieve only-on-event flag
// ----------------------------------------
// Returns boolean flag
// ----------------------------------------
nPlug.prototype.getOnlyOnEvent = function() { return this.onlyOnEvent; }

// Retrieve cron expression
// ----------------------------------------
// Returns cron string
// ----------------------------------------
nPlug.prototype.getCron = function() { return this.aCron; }

// Retrieve plug description
// ----------------------------------------
// Returns description text
// ----------------------------------------
nPlug.prototype.getDescription = function() { return this.description; }

// Retrieve attribute pattern
// ----------------------------------------
// Returns regex/pattern string
// ----------------------------------------
nPlug.prototype.getAttrPattern = function() { return this.attrPattern; }

// Retrieve stamp configuration
// ----------------------------------------
// Returns stamp config
// ----------------------------------------
nPlug.prototype.getStamp = function() { return this.stamp; }

// Retrieve toArray configuration
// ----------------------------------------
// Returns toArray flag
// ----------------------------------------
nPlug.prototype.getToArray = function() { return this.toArray; }

// Retrieve merge configuration
// ----------------------------------------
// Returns merge config
// ----------------------------------------
nPlug.prototype.getMerge = function() { return this.aMerge; }

// Retrieve sort configuration
// ----------------------------------------
// Returns sort details
// ----------------------------------------
nPlug.prototype.getSort = function() { return this.aSort; }

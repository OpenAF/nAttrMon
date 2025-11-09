// nAttrMon monitoried object functionality
// Copyright 2023 Nuno Aguiar

/**
 * Monitors an object that probably is a connection to another service/server
 *
 * Given a createFunction and a testFunction, if the test function throws an exception
 * this will trigger the automatic recreation of the object using the createFunction
 *
 */
// Monitored object wrapper
// ----------------------------------------
// aKey          = monitored object key
// createFunction = factory that produces the object
// testFunction   = optional custom tester
// ----------------------------------------
var nMonitoredObject = function(aKey, createFunction, testFunction) {
	this.key = aKey
	this.func = createFunction
	try {
		this.obj = this.func()
	} catch(e) {
		logErr("Can't create monitored object '" + aKey + "'")
		this.obj = undefined
	}
	this.type = this.determineType(this.obj)
	this.testFunction = (isUndefined(testFunction)) ? this.getTestFunction() : testFunction
	this.dirty = false
}

// Get monitored object key
// ----------------------------------------
// Returns object key
// ----------------------------------------
nMonitoredObject.prototype.getKey = function() {
	return this.key
}

// Get monitored object instance
// ----------------------------------------
// Returns underlying object
// ----------------------------------------
nMonitoredObject.prototype.getObject = function() {
	return this.obj
}

// Flag monitored object as dirty
// ----------------------------------------
// No parameters
// ----------------------------------------
nMonitoredObject.prototype.setDirty = function() {
	this.dirty = true
}

// Determine monitored object type
// ----------------------------------------
// Returns detected type string
// ----------------------------------------
nMonitoredObject.prototype.determineType = function() {
	if (this.anObject instanceof AF) { return "AF"; }
	if (this.anObject instanceof DB) { return "DB"; }
	try { if (this.anObject instanceof HTTPd) { return "HTTPd"; } } catch(e) { }
	try { if (this.anObject instanceof SSH) { return "SSH"; } } catch(e) { }
	try { if (this.anObject instanceof JMXServer) { return "JMXServer"; } } catch(e) { }
	try { if (this.anObject instanceof SNMPServer) { return "SNMPServer"; } } catch(e) { }
	try { if (this.anObject instanceof SVN) { return "SVN"; } } catch(e) { }
}

// Test monitored object health and recreate when needed
// ----------------------------------------
// No parameters
// ----------------------------------------
nMonitoredObject.prototype.test = function() {
	if (this.dirty) {
		try {
			this.testFunction(this.obj)
			this.dirty = false
		} catch(e) {
			log("Trying to recreate monitored object '" + this.key + "'")
			try {
				try { this.tryToClose(obj) } catch(ee) {}
				this.obj = this.func()
				log("Monitored object '" + this.key + "' recreated.")
			} catch(eee) {
				logErr("Can't recreate '" + this.key + "': " + __nam_err(eee, false, true))
			}
		}
	}
}

// Get default test function for the detected type
// ----------------------------------------
// Returns tester function
// ----------------------------------------
nMonitoredObject.prototype.getTestFunction = function() {
	switch(this.type) {
	case "AF":
		return function(obj) { var res = obj.exec("Ping", {"a":1}); if(compare(res, {"a":1})) return true; else throw false; }
	case "DB":
		return function(obj) { obj.q("select 1 from dual"); }
	case "HTTPd":
		return function(obj) { throw true; }
	case "SSH":
		return function(obj) { throw true; }
	case "JMXServer":
		return function(obj) { throw true; }
	case "SNMPServer":
		return function(obj) { throw true; }
	case "SVN":
		return function(obj) { throw true; }
	default: return function(obj) { throw true; }
	}
}

// Attempt to close monitored object respecting its type
// ----------------------------------------
// obj = object instance to close
// ----------------------------------------
nMonitoredObject.prototype.tryToClose = function(obj) {
	switch(this.type) {
        case "AF":
                obj.close()
		break
        case "DB":
                obj.close() 
		break
        case "HTTPd":
		break
        case "SSH":
                obj.close()
		break
        case "JMXServer":
                obj.close() 
                break
        case "SNMPServer":
                break 
        case "SVN":
                break 
        default: return true 
        }
}

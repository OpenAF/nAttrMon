// check version
af.getVersion() >= "20170101" || (print("Version " + af.getVersion() + ". You need OpenAF version 20170101 to run.")) || exit(-1);

var params = processExpr();
var NATTRMON_HOME = getEnv("NATTRMON_HOME");
if (isUnDef(NATTRMON_HOME)) NATTRMON_HOME = getOPackPath("nAttrMon") || ".";
var NATTRMON_SUBHOME = getEnv("NATTRMON_DIR");
if (isUnDef(NATTRMON_SUBHOME)) NATTRMON_SUBHOME = params.withHome || NATTRMON_HOME;

loadLib(NATTRMON_HOME + "/lib/nmain.js");

// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------

var nattrmon;

if (isUnDef(params.withDirectory)) {
	nattrmon = new nAttrMon(NATTRMON_SUBHOME + "/config", params.__NAM_DEBUG || __NAM_DEBUG);
} else {
	nattrmon = new nAttrMon(params.withDirectory, params.__NAM_DEBUG || __NAM_DEBUG);
}

var __sleepperiod = 60000; // less aggressive
var __stuckfactor = 500;

// Option stop
if (isDef(params.stop)) {
	pidKill(ow.server.getPid(NATTRMON_SUBHOME + "/nattrmon.pid"));
	exit(1);
}

ow.server.checkIn(NATTRMON_SUBHOME + "/nattrmon.pid", function(aPid) {
	if (isDef(params.restart)) {
		log("Killing process " + ow.server.getPid(aPid));
                if (!pidKill(ow.server.getPid(aPid), false)) 
		   pidKill(ow.server.getPid(aPid), true);
		return true;
	} else {
 		if (isDef(params.stop)) {
			exit(0);	
 		}
		if (isDef(params.status)) {
 			var pid = ow.server.getPid(aPid);
			if (isDef(pid)) log("Running on pid = " + pid);
                }
		return false;
	}
}, function() {
	nattrmon.stop();
	log("nAttrMon stopped.");	
});

if (isDef(params.status)) {
   log("Not running");
   exit(0);
}

nattrmon.start();
log("nAttrMon started (main=" + NATTRMON_HOME + "; home=" + NATTRMON_SUBHOME + ").");

ow.server.daemon(__sleepperiod, function() {
	// Check main health
	if ( (now() - nattrmon.count) >= (nattrmon.countCheck * __stuckfactor) ) {
		log("nAttrmon seems to be stuck.");
		log("nAttrMon restarting process!!");
		nattrmon.stop();
		restartOpenAF();
	}

	// Check all threads
	for(var uuid in nattrmon.threadsSessions) {
		if ( isUnDef(nattrmon.threadsSessions[uuid].entry.getCron()) && 
			 nattrmon.threadsSessions[uuid].entry.aTime > 0 && 
			 (now() - nattrmon.threadsSessions[uuid].count) >= (nattrmon.threadsSessions[uuid].entry.aTime * __stuckfactor) ) {
			log("nAttrmon found a stuck thread (" + uuid + " for '" + nattrmon.threadsSessions[uuid].entry.getName() + "')");
			log("nAttrMon restarting process!!");
			nattrmon.stop();
			restartOpenAF();
		}
	}
});
nattrmon.stop();

log("nAttrMon stopped.");
print(new Date() + " | Stopping.");

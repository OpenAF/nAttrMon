/**
 * <odoc>
 * <key>nattrmon.nInput_OSInfo(aMap)</key>
 * Provides the current load, load average, free swap memory, free memory and commited memory of the operating system.
 * On aMap you can provide:\
 * \
 *    - attrTemplate (a template for the name of the attribute)\
 * \
 * </odoc>
 */
var nInput_OSInfo = function(aMap) {
	if (isObject(aMap)) {
		this.params = aMap;
	} else {
		this.params = {};
	}

	if (isUnDef(this.params.attrTemplate)) this.params.attrTemplate = "Server status/OS";
}

nInput_OSInfo.prototype.exec = function(scope, args) {
	var ret = {};
	var load = -1;
	var loadAvg  = -1;
	var freeSwap   = -1;
	var freeMem = -1;
	var commitMem = -1;
	var osbean, load, loadAvg, freeSwap, freeMem, commitMem;

	try {
		osbean = java.lang.management.ManagementFactory.getPlatformMXBean(Packages.com.sun.management.OperatingSystemMXBean);
		load = Math.round(Number(osbean.getSystemCpuLoad()*100))+"%";
		loadAvg = Math.round(Number(osbean.getSystemLoadAverage()*100))+"%";	
		freeSwap = Math.round(osbean.getFreeSwapSpaceSize()/1024/1024*10)/10;
		freeMem  = Math.round(osbean.getFreePhysicalMemorySize()/1024/1024*10)/10;
		commitMem = Math.round(osbean.getCommittedVirtualMemorySize()/1024/1024*10)/10;
	} catch(e) {
		logErr("Error while retrieving os info: " + e.message);
	}

	ret[templify(this.params.attrTemplate)] = {
            "Free Swap (MB)": freeSwap,
            "Free Memory (MB)": freeMem,
            "Commit Memory (MB)": commitMem,
            "System load": load,
            "System load average": loadAvg
        };

	return ret;
}

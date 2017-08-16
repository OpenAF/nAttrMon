var nInput_OSInfo = function(attributePrefix) {
	this.attributePrefix = (isUndefined(attributePrefix)) ? "Server status/OS " : attributePrefix;
}

nInput_OSInfo.prototype.exec = function(scope, args) {
	var ret = {};
	var load = -1;
	var loadAvg  = -1;
	var freeSwap   = -1;
	var freeMem = -1;
	var commitMem = -1;

	try {
		var osbean = java.lang.management.ManagementFactory.getPlatformMXBean(Packages.com.sun.management.OperatingSystemMXBean);
                var load = Math.round(Number(osbean.getSystemCpuLoad()*100))+"%";
                var loadAvg = Math.round(Number(osbean.getSystemLoadAverage()*100))+"%";	
                var freeSwap = Math.round(osbean.getFreeSwapSpaceSize()/1024/1024*10)/10;
                var freeMem  = Math.round(osbean.getFreePhysicalMemorySize()/1024/1024*10)/10;
                var commitMem = Math.round(osbean.getCommittedVirtualMemorySize()/1024/1024*10)/10;
	} catch(e) {
		logErr("Error while retrieving os info: " + e.message);
	}

	ret[this.attributePrefix] = {
            "Free Swap (MB)": freeSwap,
            "Free Memory (MB)": freeMem,
            "Commit Memory (MB)": commitMem,
            "System load": load,
            "System load average": loadAvg
        };

	return ret;
}

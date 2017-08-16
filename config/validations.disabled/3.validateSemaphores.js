nattrmon.addValidation(
   { "name"         : "Semaphore validation",
     "timeInterval" : 2000,
     "waitForFinish": true,
     "onlyOnEvent"  : true
   },
   new nValidation(function(warns, scope, args) {
     var ret = [];

     var vals = scope.getCurrentValues();
     for(var i in vals) {
        if(i.match(/^Semaphores /)) {
	   if (vals[i].val == "red") {
	      ret.push(new nWarning(nWarning.LEVEL_HIGH, "RED " + i, "A RED semaphore for " + i + " was detected. This might stop RAID flows from running as expected. Please check more details on <a href=\"http://192.168.40.110\">Allura</a>"));
           } else {
              this.closeWarning("RED " + i);
           }
        }
     }

     return ret; 
   }) 
);

loadUnderscore();

var VAL_SEMGLOBAL_HIGH = 180;
var VAL_SEMGLOBAL_MEDIUM = 60;
var VAL_SEMGLOBAL_EXPLAIN = "<a href='http://1.2.3.4/nac:projects:aproject:ops:nattrmon:semglobal'>(more information)</a>";

nattrmon.addValidation(
   { "name"         : "Yellow semaphore validation",
     "timeInterval" : 30000,
     "waitForFinish": true,
     "onlyOnEvent"  : true
   },
   new nValidation(function(warns, scope, args) {
     var ret = [];

     include = [
        "Semaphores Global Correlation semaphore",
        "Semaphores Global Detection semaphore"
     ];

     var vals = scope.getCurrentValues();
     for(var i in include) {
        var ii = include[i];

        var tt = ow.format.dateDiff.inMinutes(new Date(vals[ii].date), new Date());

	      if (vals[ii].val == "yellow" && tt >= VAL_SEMGLOBAL_HIGH) {
           ret.push(new nWarning(
              nWarning.LEVEL_HIGH, 
              "Global Fraud " + ii, 
              "A global control Fraud " + ii + " is still in yellow since " + ow.format.timeago(new Date(vals[ii].date)) + "." + VAL_SEMGLOBAL_EXPLAIN)); 
        } else {
           if (vals[ii].val == "yellow" && tt >= VAL_SEMGLOBAL_MEDIUM) {
              ret.push(new nWarning(
                nWarning.LEVEL_MEDIUM, 
                "Global Fraud " + ii, 
                "A global control Fraud " + ii + " is still in yellow since " + ow.format.timeago(new Date(vals[ii].date)) + "." + VAL_SEMGLOBAL_EXPLAIN)); 
           } else {
              this.closeWarning("Global Fraud " + ii);
           }
        }
     }

     return ret; 
   }) 
);

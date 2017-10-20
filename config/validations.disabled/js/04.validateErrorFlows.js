nattrmon.addValidation(
   { "name"         : "Error flows validation",
     "timeInterval" : 2000,
     "waitForFinish": true,
     "onlyOnEvent"  : true
   },
   new nValidation(function(warns, scope, args) {
     var ret = [];

     // Check if servers are alive
     var vals = scope.getCurrentValues();
     for(var i in vals) {
        if(i.match(/^Server status\/.+in error flows/)) {
          var table = vals[i].val;

          for(var row in table) {
            var flowDate = new Date(table[row].Date);

            var since = Math.round(((new Date()) - flowDate) / 1000);
            var flowname = table[row].Category + " - " + table[row].Flow + " (" + table[row].Version + ")";
            var warningName = "Flow " + flowname + " error!";

            // aTime off by 1000  on propose. We want to ensure that even if nAttrMon was down for some time, the flow error is detected.
            if (since <= args.aTime) {
              ret.push(new nWarning(nWarning.LEVEL_HIGH, warningName, "The flow " + flowname + " ended in error at " + table[row].Date + " with run id " + table[row]["Run ID"] + ", started by the user '" + table[row].User + "'."));
            } else {
              // After one day, close it
              if (since >= (60 * 24)) {
                this.closeWarning(warningName);
              }
            }
          }
        }
     }
     return ret;
   })
);

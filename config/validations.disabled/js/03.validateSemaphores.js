nattrmon.addValidation(
   { "name"         : "Semaphore validation",
     "timeInterval" : 2000,
     "waitForFinish": true,
     "onlyOnEvent"  : true
   },
   new nValidation_Semaphores("Semaphores ", "RED {{name}}", "A RED semaphore for {{name}} was detected. This might stop RAID flows from running as expected.")
);

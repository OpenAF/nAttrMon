var FRAUD_SNAPSHOTS_DAYS = 3;

nattrmon.addInput(
     { "name"          : "FMS ADM database",
       "cron"          : "*/5 * * * *",
       "waitForFinish" : true,
       "onlyOnEvent"   : true,
     },
     new nInput_DB("ADMAPP", {
        "Fraud/Snapshots": "select snapshot_id, instance_id, max(created_date) created_date from rdtnsbase_fmsadm.fraud_t_snapshot where created_date > (sysdate - " + FRAUD_SNAPSHOTS_DAYS + ") group by snapshot_id, instance_id order by snapshot_id desc"
     })
);

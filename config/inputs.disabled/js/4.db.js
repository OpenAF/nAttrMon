nattrmon.addInput(
     { "name"          : "Some Database",
       "timeInterval"  : 30000,
       "waitForFinish" : true,
       "onlyOnEvent"   : true,
     },
     new nInput_DB("Some_ADMAPP", {
        "Database/Tablespaces": "SELECT tablespace_name \"Tablespace name\", ROUND((tablespace_size - used_space)*(SELECT value FROM v$parameter WHERE name = 'db_block_size') / (1024*1024*1024)) \"Free GB\", ROUND(tablespace_size * (SELECT value FROM v$parameter WHERE name = 'db_block_size') / (1024*1024*1024)) \"Total GB\", ROUND((100 - used_percent)) \"Percentage\" FROM DBA_TABLESPACE_USAGE_METRICS WHERE (tablespace_name LIKE '%IND' OR tablespace_name LIKE '%TAB') and (tablespace_name like 'RDUSCS2B%')",
     })
);

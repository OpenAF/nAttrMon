# nInput CBPMDebugChecks <a href="/"><img align="right" src="images/logo.png"></a>

This input will retrieve the database and memory debug levels for CBPM flows. It's intended to be used to alert for full debug situations.

Example of use of the execArgs:

```yaml
input: 	
  name         : Flow debug 
  cron         : "*/12 * * * *"
  waitForFinish: true
  onlyOnEvent  : true
  execFrom     : nInput_CBPMDebugChecks
  execArgs     : 
    chKeys      : raidServers
    attrTemplate: "Server/{{key}} CBPM debug flags"
    #includes    :
    #   - Flow A
    #   - 18e81e5c-5519-8b95-31a6-e2271b2339b4
    #excludes    :
    #   - Flow B
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| includes | Array | No | A list of flow names or UUIDs to be the only included of the returned list. |
| excludes | Array | No | A list of flow names or UUIDs to be excluded of the returned list.
| keys | Array | No | A list of string keys of RAID AF object pools to be queried. The output will be an array with the list of flows, corresponding numeric dbLevel & memLevel and corresponding description "DB Level" & "Mem Level". One attribute will be created for each key. |
| chKeys | Channel | No | Similar to keys but uses an OpenAF channel to dynamically determine the keys. |

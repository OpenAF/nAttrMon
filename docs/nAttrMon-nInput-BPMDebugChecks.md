# nInput BPMDebugChecks <a href="/"><img align="right" src="images/logo.png"></a>

This input will retrieve the database & memory debug levels and any trace executiong for BPM flows. It's intended to be used to alert for full debug situations.

Example of use of the execArgs:

```yaml
input: 	
  name         : Flow debug flags BPM
  cron         : "*/12 * * * *"
  waitForFinish: true
  onlyOnEvent  : true
  execFrom     : nInput_BPMDebugChecks
  execArgs     : 
    chKeys      : raidServers
    attrTemplate: "Server/{{key}} BPM debug flags"
    #includes    :
    #   - Flow A
    #   - 123
    #excludes    :
    #   - Flow B      
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| includes | Array | No | A list of flow names or flow ids to be the only included of the returned list. |
| excludes | Array | No | A list of flow names or flow ids to be excluded of the returned list.
| keys | Array | No | A list of string keys of RAID AF object pools to be queried. The output will be an array with the list of flows, corresponding numeric dbLevel & memLevel, corresponding description "DB Level" & "Mem Level" and number of trace executions found. One attribute will be created for each key. |
| chKeys | Channel | No | Similar to keys but uses an OpenAF channel to dynamically determine the keys. |

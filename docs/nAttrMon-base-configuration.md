# Base Configuration <a href="/"><img align="right" src="images/logo.png"></a>

nAttrMon is composed of a core (the files that get installed and updated through opack) + configuration (the plugs that determine the inputs, outputs and validations). The following sub-chapters concern the settings available for the core part.

## nattrmon.yaml

On the main folder there is a nattrmon.yaml.sample that you can copy to nattrmon.yaml to set different settings. The file contains some sample entries that are described on the following table:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| **CONFIG** | String | *config* | The file path to the config folder structure with the inputs, outputs, objects and validations plugs. |
| **LOGCONSOLE** | Boolean | *false* | Determines if the nAttrMon log should be created and stored in log files under [CONFIG]/log or if it should just be output to the current console (e.g. if running on a docker container). |
| **LOGAUDIT** | Boolean | *true* | Determines if an audit log should be produced for every external HTTP(s) access for output plugs that respect this global setting (e.g. nOutput_HTTP, nOutput_HTTP_JSON, nOutput_Channels) |
| **LOGAUDIT_TEMPLATE** | String | *check the nattrmon.yaml.sample file* | A handlebars template string used when LOGAUDIT = true (available entries *tbc*) |
| **LOGHK_HOWLONGAGOINMINUTES** | Number | *43200* | Specifies how long the log files should be kept before being removed from the filesystem. |
| **NUMBER_WORKERS** | Number | *2 times number of cores* | Number of base threads (workers) that nAttrMon should use. Change this if you have a less than 2 cores (it's suggested to have a minimum of 4 workers) or more than 4 cores (it's suggested not to have too many workers (~8) if there is other processes on the same machine to keep load controlled) |
| **LOG_ASYNC** | Boolean | *true* | Determines if logging is asynchronous (default) or not. Turn it off if you need to see logging immediately even with a small global performance penality.|
| **JAVA_ARGS** | String | | The extra java arguments (e.g. minimum and maximum memory) to be used in case of automatic restart. **NOTE:** *Changing this doesn't affect the normal startup java arguments. Usually OpenAF can automatically figure out the java arguments you used during the normal startup and reuse them. This setting just forces them.* |
| **BUFFERCHANNELS** | Boolean | *false* | Turns on or off the extra buffer channels nattrmon::cvals::buffer and nattrmon::warns::buffer. When a plug subscribes theses channels instead of the original one the rate of execution will be paced by the parameters BUFFERBYNUMBER and BUFFERBYTIME. This is usefull for nAttrMon configurations with lots of attributes and constant output and validations. |
| **BUFFERBYNUMBER** | Number | 100 | When BUFFERCHANNELS is turned on the buffer channels will only execute plugs that subscribe it when this number of changes is reached (or BUFFERBYTIME if the condition is true first). |
| **BUFFERBYTIME** | Number | 1000 | When BUFFERCHANNELS is turned on the buffer channels will only execute plugs that subscribe it when this number of ms is reached (or BUFFERBYNUMBER if the condition is true first). |
| **DEBUG** | Boolean | *false* | Turns debug on producing a lot more logging to help debug a plug configuration. |


## command-line 

There are some parameters that you can provide when starting nAttrMon from the command line. You should include these parameters on a similar form to:

````bash
openaf --script nattrmon.js -e 'parameterA=valueA;parameterB=valueB;...'
````

*Note: in Windows replace the ' by "*

The available parameters are:

| Parameter | Description |
|-----------|-------------|
| withDirectory | The file path to the config folder structure with the inputs, outputs, objects and validations plugs. |
| debug | Turns on debug (e.g. debug=true) |
| stop | Checks if there is any existing nAttrMon running (using nattrmon.pid) and tries to stop it. |
| restart | Checks if there is any existing nAttrMon running (using nattrmon.pid), tries to stop it and starts a new instance. |
| status | Checks if there is any existing nAttrMon running (using nattrmon.pid) returning the result. |
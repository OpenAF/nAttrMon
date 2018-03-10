# Current objects <a href="/"><img align="right" src="images/logo.png"></a>

The following is a list of the current objects base for Inputs, Outputs and Validations:

| Type | Name | Category | Description |
|-----:|------|----------|-------------|
| Input | nInput_AFPing | RAID | Executes the RAID Ping AF operation to determine if an instance is responsive. |
| Input | nInput_CBPMSemaphores | RAID | Checks the values of RAID's instance semaphores. |
| Input | nInput_DB | DB | Executes a SQL query and returns the result as input. |
| Input | [nInput_EndPoints](nAttrMon-nInput-EndPoints) | OS | Test for reachability/expected availability of HTTP(s) URLs or TCP ports. |
| Input | nInput_FMSRuleStatus | RAID | Gets each RAID FMS engine rule status (active, inactive, inactive by anti-flooding) |
| Input | nInput_Filesystem | OS | Per unix mount point gets the total, used, free and % used space and inode totals (locally or remotely). |
| Input | nInput_FilesystemCount | OS | Per filepath and filename regular expression filter, returns the total count and size, the min, max and avg size of existing files, the date of the newest file and oldest file (locally or remotely). |
| Input | nInput_IMMemory | RAID | Returns the current RAID instance reported IM memory. |
| Input | nInput_LogErrorAgg | OS | Given a regular expression pattern returns the number of occurrences of that pattern in specific files (useful to aggregate the count of Java exceptions on a log file, for example).  |
| Input | nInput_OSInfo | OS | Returns the operating system load, load average, free, swap and commit memory. |
| Input | nInput_RAIDMemory | RAID | Returns the current RAID instance reported memory. |
| Input | nInput_RunningFlows | RAID | Returns the current BPM running flows. |
| Input | nInput_Semaphores | RAID | Returns the current BPM semaphores values. |
| Input | nInput_Sessions | RAID | Returns the current sessions list for a RAID instance. |
| Input | [nInput_Shell](nAttrMon-nInput-Shell) | OS | Executes (locally or remotely) and returns the output of a shell command (parsing or not the output as JSON). |
| Output | [nOutput_DSV](nAttrMon-nOutput-DSV) | Output DSV | Outputs a specific set of attributes or warnings to DSV/CSV files per date with automatic housekeeping. | 
| Output | [nOutput_EmailWarnings](nAttrMon-nOutput-EmailWarnings) | Output Warning | If there is any new level HIGH warning (or any other combination) it will send an email with it. |
| Output | nOutput_H2 | Output History | Records the attribute values and warnings on a H2 database. |
| Output | nOutput_HTTP | Output HTTP | Provides a minimal HTTP interface to check attribute values, warnings and output history (if activated). |
| Output | nOutput_HTTP_JSON | Output HTTP | Provides a JSON full dump of the current attribute, attribute values and warnings. |
| Output | nOutput_Log | Output Log | Outputs the current attribute values into a text log file. |
| Output | nOutput_Oracle | Output History | Records the attribute values and warnings on a Oracle database. |
| Output | nOutput_Stdout | Output Log | Outputs the current attribute values into the stdout. |
| Output | [nOutput_Channels](nAttrMon-nOutput-Channels) | Output Channels | Exposes several OpenAF channels with attributes, values, warnings and plugs plus access to operational functionality. |
| Output | [nOutput_Notifications](nAttrMon-nOutput-Notifications) | Output Warnings | Sends push notifications triggered by warnings. |
| Validation | [nValidation_Generic](nAttrMon-nValidation-Generic) | Validation Generic | Simple generic validation for an attribute or any set of attribute patterns. |

## Object templates

### Input object 

To build an input object follow the following javascript template:

````javascript
/**
 * <odoc>
 * <key>nattrmon.nInput_MyInput(aMap)</key>
 * aMap is composed of:\
 *   - keys  (the key of the objects to refer to)
 *   - chKey (the channel name for the keys of objects to refer to)
 *   - attrTemplate (a string template for the name of the attribute using {{name}})
 * </odoc>
 */
var nInput_MyInput = function(aMap) {
    this.params = aMap;
	if (isUnDef(this.params.myMandatoryArg)) this.params.myMandatoryArg = "something";

	nInput.call(this, this.input);
}
inherit(nInput_MyInput, nInput);

nInput_MyInput.prototype.input = function(scope, args) {
    var ret = {};
    var attrname = templify(this.params.attrTemplate, { name: this.params.name });

    ret[attrname] = runSomething();

    return ret;
}
````

### Validation object

To build a validation object follow the following javascript template:

````javascript
/**
 * <odoc>
 * <key>nattrmon.nValidation_MyValidation(aMap)</key>
 * aMap is composed of:\
 *   - warnTemplate (a string template for the warning title using {{title}})
 *   - warnDescTemplate (a string template for the warning description {{title}})
 * </odoc>
 */
var nValidation_MyValidation = function(aMap) {
    this.params = aMap;
	if (isUnDef(this.params.myMandatoryArg)) this.params.myMandatoryArg = "something";

	nValidation.call(this, this.validation);
}
inherit(nValidation_MyValidation, nValidation);

nValidation_MyValidation.prototype.validate = function(scope, args) {
    var ret = [];
    var title = templify(this.params.warnTemplate);
    var description = templify(this.params.warnDescTemplate);

    if (somethingIsWrong)
        ret.push(new nWarning(nWarning.LEVEL_HIGH, title, descripiton));
    else
        this.closeWarning(title);

    ret.push(new nWarning(nWarning.LEVEL_INFO, "A information", "Just for fyi..."));

    return ret;
}
````

### Output object

To build an output object follow the following javascript template:

````javascript
/**
 * <odoc>
 * <key>nattrmon.nOutput_MyOutput(aMap)</key>
 * aMap is composed of:\
 *   - inclusionList (a list of attributes to include)
 *   - chInclusionList (a channel name with attributes to include)
 * </odoc>
 */
var nOutput_MyOutput = function(aMap) {
    this.params = aMap;
	if (isUnDef(this.params.myMandatoryArg)) this.params.myMandatoryArg = "something";

	nOutput.call(this, this.output);
}
inherit(nOutput_MyOutput, nOutput);

nOutput_MyOutput.prototype.output = function(scope, args) {
    for(key in scope.getCurrentValues()) {
        ...
    }
}
````
# Examples <a href="/"><img align="right" src="images/logo.png"></a>
nAttrMon YAML/JSON based Inputs, Output or Validations can be created in the same folders as the regular JS based Inputs, Outputs and Validations.

## Some basic examples comparing YAML, JSON and Javascript:

### INPUT: Adding SQL queries

The following are three ways of implementing the same Input in YAML, JSON and Javascript:

#### YAML 

````yaml
input:
  name         : Test input
  cron         : "*/10 * * * * *"
  waitForFinish: true
  onlyOnEvent  : true
  execFrom     : nInput_DB
  execArgs     :
     key: MYAPP_DAT
     sqls:
        Database/Test 1  : >
           SELECT user FROM dual

        Database/Test 2  : >
           SELECT level "My level"
           FROM dual connect by level <= 5
````

#### JSON

````javascript
{
  input: {
    name: "Test input",
    cron: "*/10 * * * * *",
    waitForFinish: true,
    onlyOnEvent: true,
    execFrom: "nInput_DB",
    execArgs: {
      key: "MYAPP_DAT",
      sqls: {
        "Database/Test 1": "SELECT user FROM dual",
        "Database/Test 2": "SELECT level \"My level\" FROM dual connect by level <= 5"
      }
    }
  }
}
````

#### Javascript

````javascript
nattrmon.addInput({
  name: "Test input",
  cron: "*/10 * * * * *",
  waitForFinish: true,
  onlyOnEvent: true
}, new nInput_DB({
  key: "MYAPP_DAT",
  sqls: {
    "Database/Test 1": "SELECT user FROM dual",
    "Database/Test 2": "SELECT level \"My level\" FROM dual connect by level <= 5"
  }
}));
````

----

### INPUT: Using Shell (simple example)

The following example builds a json string to provide, as Input, the current number of processes and files vs the current limitations.

#### YAML

````YAML
input:
  name         : Processes and files limits
  cron         : "*/5 * * * *"
  waitForFinish: true
  onlyOnEvent  : true
  execFrom     : nInput_Shell
  execArgs     :
     name        : Processes and files limits
     attrTemplate: Server/Status processes and files limits
     cmd         : "echo \"{ \\\"maxFilesPerUser\\\": \"`ulimit -n`\", \\\"currentFilesPerUser\\\": \"`lsof -u myuser | wc -l`\", \\\"numberOfProcesses\\\": \"`ps h -u myuser  | wc | awk '{print $1}'`\", \\\"maxNumberOfProcesses\\\": `bash -c 'ulimit -u'` }\""
     parseJson   : true
````

#### JSON

````javascript
{
  input: {
    name: "Processes and files limits",
    cron: "*/5 * * * *",
    waitForFinish: true,
    onlyOnEvent: true,
    execFrom: "nInput_Shell",
    execArgs: {
      name: "Processes and files limits",
      attrTemplate: "Server/Status processes and files limits",
      cmd: "echo \"{ \\\"maxFilesPerUser\\\": \"`ulimit -n`\", \\\"currentFilesPerUser\\\": \"`lsof -u myuser | wc -l`\", \\\"numberOfProcesses\\\": \"`ps h -u myuser  | wc | awk '{print $1}'`\", \\\"maxNumberOfProcesses\\\": `bash -c 'ulimit -u'` }\"",
      parseJson: true
    }
  }
}
````

#### Javascript

````javascript
nattrmon.addInput({
  name: "Processes and files limits",
  cron: "*/5 * * * *",
  waitForFinish: true,
  onlyOnEvent: true
}, new nInput_Shell({
  name: "Processes and files limits",
  attrTemplate: "Server/Status processes and files limits",
  cmd: "echo \"{ \\\"maxFilesPerUser\\\": \"`ulimit -n`\", \\\"currentFilesPerUser\\\": \"`lsof -u myuser | wc -l`\", \\\"numberOfProcesses\\\": \"`ps h -u myuser  | wc | awk '{print $1}'`\", \\\"maxNumberOfProcesses\\\": `bash -c 'ulimit -u'` }\"",
  parseJson: true
}));
````

----

## Basic templates for custom inputs, outputs or validations:

### INPUT template

#### YAML

````YAML
input:
  name         : Test input unique name
  timeInterval : 10000
  waitForFinish: true
  onlyOnEvent  : true
  exec         : |
     var attrName = "Category examples/My new example";
     var res = {};
 
     // Get the input info you need
 
     // res[attrName] = a map or array of info collected to be added/updated on the attribute
     return res;
````
#### JSON

````javascript
{
  input: {
    name: "Test input unique name",
    timeInterval: 10000,
    waitForFinish: true,
    onlyOnEvent: true,
    exec: "var attrName = \"Category examples/My new example\"; var res = {}; /* Get the input info you need */ /* res[attrName] = a map or array of info collected to be added/updated on the attribute */ return res;"
  }
}
````

#### Javascript

````javascript
nattrmon.addInput({
  name: "Test input unique name",
  timeInterval: 10000,
  waitForFinish: true,
  onlyOnEvent: true
}, new nInput(function(scope, args) {
  var attrName = "Category examples/My new example";
  var res = {};

  // Get the input info you need

  // res[attrName] = a map or array of info collected to be added/updated on the attribute
  return res;
}));
````

### VALIDATION template

#### YAML

````YAML
validation:
  name         : Test validation unique name
  timeInterval : 10000
  waitForFinish: true
  onlyOnEvent  : true
  exec         : |
     var attrName = "Category examples/My new example";
     var res = [];
 
     var attrs = nattrmon.getCurrentValues();
     var lastAttrs = nattrmon.getLastValues();
     var warns = nattrmon.getWarnings();
 
     if (isUnDef(attrs[attrName])) return res;
 
     // if (attrs[attrName] ... and test what you need. If it should alert:
        // Alerts levels can be LEVEL_HIGH, LEVEL_MEDIUM and LEVEL_LOW
        res.push(new nWarning(nWarning.LEVEL_HIGH, "A simple unique alert title", "An alert description")); 
     // else ... don't forget to close the warning if it's no longer occurring:
        this.closeWarning("A simple unique alert title");
 
     // You can also add informative warnings:
     res.push(new nWarning(nWarning.LEVEL_INFO, "A simple unique alert title", "An alert description"));
 
     return res;
````

#### JSON

````javascript
{
  "validation": {
    "name": "Test validation unique name",
    "timeInterval": 10000,
    "waitForFinish": true,
    "onlyOnEvent": true,
    "exec": "var attrName = \"Category examples/My new example\"; var res = []; var attrs = nattrmon.getCurrentValues(); var lastAttrs = nattrmon.getLastValues(); var warns = nattrmon.getWarnings(); if (isUnDef(attrs[attrName])) return res; /* if (attrs[attrName] ... and test what you need. If it should alert: Alerts levels can be LEVEL_HIGH, LEVEL_MEDIUM and LEVEL_LOW */ res.push(new nWarning(nWarning.LEVEL_HIGH, \"A simple unique alert title\", \"An alert description\")); /* else ... don't forget to close the warning if it's no longer occurring:*/ this.closeWarning(\"A simple unique alert title\"); /* You can also add informative warnings:*/ res.push(new nWarning(nWarning.LEVEL_INFO, \"A simple unique alert title\", \"An alert description\")); return res;"
  }
}
````

#### Javascript

````javascript
nattrmon.addValidation({
  name: "Test validation unique name",
  timeInterval: 10000,
  waitForFinish: true,
  onlyOnEvent: true
}, new nVaidation(function(warns, scope, args) {
  var attrName = "Category examples/My new example";
  var res = [];

  var attrs = nattrmon.getCurrentValues();
  var lastAttrs = nattrmon.getLastValues();
  var warns = nattrmon.getWarnings();

  if (isUnDef(attrs[attrName])) return res;

  // if (attrs[attrName] ... and test what you need. If it should alert:
    // Alerts levels can be LEVEL_HIGH, LEVEL_MEDIUM and LEVEL_LOW
    res.push(new nWarning(nWarning.LEVEL_HIGH, "A simple unique alert title", "An alert description")); 
  // else ... don't forget to close the warning if it's no longer occurring:
    this.closeWarning("A simple unique alert title");

  // You can also add informative warnings:
  res.push(new nWarning(nWarning.LEVEL_INFO, "A simple unique alert title", "An alert description"));

  return res;
}));
````

### OUTPUT template

#### YAML

````YAML
output:
  name         : Test output unique name
  timeInterval : 10000
  waitForFinish: true
  onlyOnEvent  : true
  exec         : |
     var attrs = nattrmon.getCurrentValues();
     var lastAttrs = nattrmon.getLastValues();
     var warns = nattrmon.getWarnings();
 
     // Do something with attrs, lastAttrs and warns
````

#### JSON

````javascript
{
  "output": {
    "name": "Test output unique name",
    "timeInterval": 10000,
    "waitForFinish": true,
    "onlyOnEvent": true,
    "exec": "var attrs = nattrmon.getCurrentValues(); var lastAttrs = nattrmon.getLastValues(); var warns = nattrmon.getWarnings();";
  }
}
````

#### Javascript

````javascript
nattrmon.addOutput({
  name: "Test output unique name",
  timeInterval: 10000,
  waitForFinish: true,
  onlyOnEvent: true
}, new nInput(function(scope, args) {
  var attrs = nattrmon.getCurrentValues();
  var lastAttrs = nattrmon.getLastValues();
  var warns = nattrmon.getWarnings();

  // Do something with attrs, lastAttrs and warns
}));
````
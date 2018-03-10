# nOutput Channels <a href="/"><img align="right" src="images/logo.png"></a>
This output exposes nAttrMon internal channels and data externally (configurable to what should be read-only or read-write/execution permissions). 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| port | Number | No | Forces the channels expose port. If omitted defaults to the current httpd object (e.g. usually port 8090) or creates a new one in port 17878. |
| local | Map | No | Provides a list of login, password and corresponding permissions to access the channels | 
| cAuth | Map | No | Equal no local (to be deprecated in the future) |
| custom | String | No | Function that receives 4 arguments: u (user), p (password), s (HTTPd server object) and r (request map). If it returns true the user is authenticated, if returns false or fails the user is not authenticated. |

Example of use of the execArgs:

```yaml
output:
   name    : Output Channels
   execFrom: nOutput_Channels
   execArgs:
      port : 17878
      cAuth:
         nattrmon:
            p: nattrmon
            m: r
         change:
            p: me
            m: rw
output:
   name         : Output Channels
   description  : >
    Provides, on the same nOutput_HTTPJSON or nOutput_HTTP port or other, access to the nAttrMon specific OpenAF channels like: /chs/ops,
    /chs/cvals, /chs/pvals and /chs/attr.
   execFrom     : nOutput_Channels
   execArgs     :
      local:
        nattrmon: 
          p: nattrmon
          m: r
        change:
          p: me 
          m: rw
#      custom: |
#        // Custom has priority over local. Comment the entry you won't use.
#        //
#        // u - user
#        // p - password
#        // s - server object
#        // r - request object (e.g. uri, method, header["remote-addr"], header["user-agent"], ...)
#         
#        if (u == "nattrmon" && p == "nattrmon") return true;
#
#        try {
#          new ow.server.ldap("ldap://my.auth.ldap:389", u + "@my.domain", p);
#          return true;
#        } catch(e) {
#          tlogErr("AUDIT | {{user}} authentication refused ({{message}}).", { user: u, message: e.message });
#        }
#
#        return false;
``` 

*Note 1: As usual, passwords can be encrypted.*
*Note 2: In the custome function r.uri can be used to determine which channel is being accessed.*

# Ops channel

| URL | Permissions | Example | 
|:--- |:----------- |:------- |
| http://my.host:8090/chs/ops | You will need "rw" permissions to use this channel | ``` $ch("ops").createRemote("http://my.host:8090/chs/ops"); ``` | 

This channel provides access useful operational operations to manage a running nAttrMon:

* **List** existing active plugs (similar to the plugs channel)
* **Reload** a specific plug (within certain limitations)
* Ad-hoc **test** or **run** of a single plug. 
* **Clear an attribute** from nAttrMon.
* **Close a warning** or force it's deletition. 
* **Close all warnings** or force there deletition.

## List

| Permissions | Example |
|:----------- |:------- | 
| "r"         | ```$ch("ops").get("list");``` |

This operation will return a map with: inputs, outputs and validations. Each entry has an associated array with the sorted list of active plugs.

## Reload

| Permissions | Example |
|:----------- |:------- |
| "rw"        | ```$ch("ops").set("reload", { file: "inputs/12.myInput.yaml" });``` |

This operation will allow you to reload a plug within certain limitations (listed below). The plug file can, of course, be in yaml/json or javascript formats.

Limitations to which plugs can be reloaded:

* Only already loaded plugs should be loaded again.
* *.init.js or any other plug that provides global object initialization should _not_ be reloaded since this operation won't close existing definitions.
* Only plug file definitions from the config folder can be reloaded.
* Only reload for testing proposes. On production configurations it's safer to just restart nAttrMon.
* timePeriod, cron, waitForFinish and onlyOnEvent of a plug won't change until a restart is performed.

## Test/Run

| Permissions | Example |
|:----------- |:------- |
| "rw"        | ```$ch("ops").set("test", { type: "inputs", name: "My test input" });```<br>```$ch("ops").set("run", { type: "validations", name: "My test validation" });``` |

These operations let you test or run any plug ad-hoc without considering the schedule time to run. The *test* operation will run the plug in nAttrMon and just return the generated output without affecting the current/last attribute values or warnings. The *run* operation will go a step forward and will affect the current & last attributes values (if an input) or warnings (if a validation).

Use the *list* operation to get a list of the names you case with these operations for each type.

## Clear an attribute

| Permissions | Example | 
|:----------- |:------- |
| "rw"        | ```$ch("ops").set("clearAttribute", { name: "My attribute" });``` | 

This operation will clear the corresponding attribute from the current list of attributes, current values and last values. Use this to clear any old attribute that you no longer want nAttrMon to keep track. If the attribute is returned again by an input plug it will be registered again.

## Close a warning

| Permissions | Example | 
|:----------- |:------- | 
| "rw" | ```$ch("ops").set("closeWarning", { title: "Warning title", force: false });``` |

The close warning operation will do one of two things depending of the value of the parameter force:

* If **true** the warning with the provided title will be completely deleted from the nAttrMon warnings.
* If **false** or not provided the warning level will be classified as *closed* in nAttrMon warnings.

## Close all warnings

| Permissions | Example |
|:----------- |:------- | 
| "rw" | ```$ch("ops").set("closeAllWarnings", { force: false });``` |

This operation is equivalent to the close warning operation but will apply to all existing warnings in nAttrMon.

# Current values 

| URL | Permissions | Example | 
|:--- |:----------- |:------- |
| http://my.host:8090/chs/cvals | "r" or "rw" | ``` $ch("cvals").createRemote("http://my.host:8090/chs/cvals"); ``` | 

This channel provides access to the current attribute values.

# Last values 

| URL | Permissions | Example | 
|:--- |:----------- |:------- |
| http://my.host:8090/chs/lvals | "r" or "rw" | ``` $ch("cvals").createRemote("http://my.host:8090/chs/lvals"); ``` | 

This channel provides access to the last attribute values.

# Attributes

| URL | Permissions | Example | 
|:--- |:----------- |:------- |
| http://my.host:8090/chs/attrs | "r" or "rw" | ``` $ch("cvals").createRemote("http://my.host:8090/chs/attrs"); ``` | 

This channel provides access to the current attributes list.
[TOC]

# Warnings

| URL | Permissions | Example | 
|:--- |:----------- |:------- |
| http://my.host:8090/chs/warns | "r" or "rw" | ``` $ch("cvals").createRemote("http://my.host:8090/chs/warns"); ``` | 

This channel provides access to the current warnings list.

# Plugs

| URL | Permissions | Example | 
|:--- |:----------- |:------- |
| http://my.host:8090/chs/plugs | "r" | ``` $ch("cvals").createRemote("http://my.host:8090/chs/plugs"); ``` | 

This channel provides access to the current plugs list.


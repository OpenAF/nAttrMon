<a href="/"><img align="right" src="images/logo.png"></a>
Welcome to the nAttrMon

# Introduction

nAttrMon (*n-Attribute-Monitor*) is basically a small monitoring tool using [OpenAF](https://github.com/openaf/openaf). It's extensible through plugs (small editable files) divided into three categories: inputs, outputs and validations:
   * The *inputs* are responsible to gather unique attribute values.
   * The *validations* are responsible to analyze the attribute values and generate warnings and/or perform actions (e.g. self-healing).
   * The *outputs* are responsible to make attribute values and warnings available (e.g. HTTP, Email, Notification, etc...).

These plugs are loaded (by alphanumeric order from their corresponding folder) upon nAttrMon start and run in parallel on specific time intervals, internal cron schedule or triggered by changes (e.g. changes on attribute values, creation/update/close of warnings, etc...). These plugs can inherit most of their functionality from available existing objects (to promote reusability) or be totally customized.

At all times plugs have access to the current warnings, current atribute values and previous attribute values that are stored in memory either by time or by the last different value. These values can be simple types (e.g. strings, numbers, booleans, ...) or maps/arrays. nAttrMon keeps track of when an attribute was last checked and when it's value last changed. 

nAttrMon is designed to be "killed" and restarted whenever needed so all relevant memory information is persisted automatically in snapshot files.

Available to plugs are also object pools to globally manage access to databases, application servers, ssh connections, etc. These object pools are accessed by keys (either static or dynamic) that can have associations between them (e.g. application server A (key "APP1") is associated with database server connection B (key "DAT1")). Since the list of keys and corresponding object pools can be dynamic, plugs can automatically adapt to changes in sources (e.g., adding/removing application servers, adding/removing database connections, adding/removing docker containers).

To install nAttrMon you will need to first install OpenAF and then simply execute:

````bash
opack install nattrmon
````
This will install a nAttrMon opack folder on your OpenAF installation. Check the following topics for more details regarding the folder structure and base configuration:

* [nAttrMon folder structure](nAttrMon-folder-structure)
* [nAttrMon base configuration](nAttrMon-base-configuration)

Afterwards you will need to add some input, output and validation plugs covered below under "Adding plugs". Then you can start by executing:

````bash
openaf --script nattrmon.js
````

Alternatevily you can create a start script be executing:

````bash
opack script nattrmon
````

# Adding plugs

* [Generic plugs parameters](nAttrMon-Plugs)
* [Examples of adding Inputs, Outputs or Validations](Examples)
* [Existing base Inputs, Outputs or Validations (also known as objects)](nAttrMon-Objects)

# Operational topics

* [Managing warnings](nAttrMon-Warnings)
* [Interconnecting several nAttrMon's instances](nAttrMon-Interconnect)
* [Auditing](nAttrMon-Auditing)
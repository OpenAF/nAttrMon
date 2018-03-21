# Interconnect nAttrMon's instances <a href="/"><img align="right" src="images/logo.png"></a>

Althought nAttrMon can be operated in an "agent-less" mode (for most of the inputs) on installed directly or directly on a single server it's possible also to operate it on a "agent" mode where nAttrMon instances are deploy across several servers with output plugs to send the attribute values to other nAttrMon instances.

Attribute values can be either pushed from a nAttrMon instance to another or retrieved.

## Remote instance pushing attributes to another nAttrMon instance

To have a remote instance "push" attribute values to a local nAttrMon instance you can use an output

## Retriving attributes from a remote nAttrMon instance

Note: althought it's possible for warnings to be pushed/retrieved from other nAttrMon instances you should implement local validations of "remote" attributes or convert the warnings into attribute values (e.g. x high alarms, y medium alarms, etc...)

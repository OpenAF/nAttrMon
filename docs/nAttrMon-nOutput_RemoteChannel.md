# nOutput RemoteChannel <a href="/"><img align="right" src="images/logo.png"></a>

Pushes attributes to a remote channel (for example, to another nAttrMon's nInput_Channel). The attributes will be pushed using attrTemplate (that, by default, is the channel key idKey value). Additionally you can filter the attributes to include and/or exclude otherwise all attributes will be consider.

Example of use of the execArgs:

```yaml
input:
   name         : Push to remote nAttrMon
   execFrom     : nOutput_RemoteChannel
   execArgs     :
      url          : https://user:pass@some.other.nattrmon:8090/remote
      #idKey       : name
      #valueKey    : val
      #include     :
      #   - Attribute 1
      #   - Attribute 2
      #exclude     :
      #   - Attribute 3
      #   - ATtribute 4
      attrTemplate: Remote/{{id}}
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| **url** | String | Yes | The full URL (including authentication if needed) to access the remote channel. |
| **idKey** | String | No | Defines the map path where the attribute name will be set. Defaults to "name". |
| **valueKey** | String | No | Defines the map path where the attribute value will be set. Defaults to "val". |
| **include** | Array | No | An array of attribute names to include. If not specified all channel entries will be consider. |
| **exclude** | Array | No | An array of attribute names to exclude. |
| **attrTemplate** | String | No | A Handlebars template to build the attribute name. You can use {{id}} (the original attribute name), {{value}} (the identified value object) and {{originalValue}} the raw value received. Defaults to "{{id}}". |

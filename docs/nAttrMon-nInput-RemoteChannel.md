# nInput RemoteChannel <a href="/"><img align="right" src="images/logo.png"></a>

Retrieves attribute values from a remote channel (for example, from another nAttrMon's cvals channel). Each channel key should contain the name of the attribute (using the parameter idKey (by default "name")) and each channel value should contain the value of the attribute (defaults to "val"). The attributes will be added using attrTemplate (that, by default, is the channel key idKey value). Additionally you can filter the attributes to include and/or exclude otherwise all channel entries will be consider.

Example of use of the execArgs:

```yaml
input:
   name         : Remote nAttrMon
   execFrom     : nInput_RemoteChannel
   execArgs     :
      url          : https://user:pass@some.other.nattrmon:8090/chs/cvals
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
| **idKey** | String | No | Defines the map path to find the attribute name on the channel value and/or key *set* operation. Defaults to "name". |
| **valueKey** | String | No | Defines the map path to find the attribute value on the channel value. Defaults to "val". |
| **include** | Array | No | An array of attribute names to include. If not specified all channel entries will be consider. |
| **exclude** | Array | No | An array of attribute names to exclude. |
| **attrTemplate** | String | No | A Handlebars template to build the local attribute name. You can use {{id}} (the original attribute name), {{value}} (the identified value object) and {{originalValue}} the raw value received. Defaults to "{{id}}". |

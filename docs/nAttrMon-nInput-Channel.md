# nInput Channel <a href="/"><img align="right" src="images/logo.png"></a>

Creates and/or exposes a provided channel and then subscribe that channal for modifications. Once a modification is received an attribute value is created or updated. The channel key should contain the name of the attribute (using the parameter idKey (by default "name")) and the channel value should contain the value of the attribute (if only part of the map, as in the case of using nOutput_RemoteChannel the parameter valueKey should indicate the path to find it (e.g. "val")). The attribute will be added using attrTemplate (that, by default, is the channel key idKey value).

Example of use of the execArgs:

```yaml
input:
   name         : Channel input endpoint
   chSubscribe  : remoteVals
   execFrom     : nInput_Channel
   execArgs     :
      # ch should be equal to chSubscribe
      ch          : remoteVals 
      port        : 7878
      #host        : 127.0.0.1
      #path        : /chs/remoteVals
      #idKey       : name
      #httpSession : myhttpd
      valueKey    : val
      attrTemplate: Remote/{{id}}
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| **ch** | String | Yes | This is the name of the channel to create and/or expose. If the channel is already created it will only be exposed. If it wasn't created it will be created as a dummy channel (to save memory) but still keeping all functionality needed. |
| **port** | Number | No | The port on which the channel should be exposed. You can alternatively create a httpd object (on an init plug) and store it on nAttrMon's session data (see httpSession) |
| **host** | String | No | If *port* was used you can also specify the host network address to bind the network listener to. |
| **path** | String | No | Either if you have used *port* or *httpSession* you can use path to define the uri where the channel will be exposed on. |
| **httpSession** | String | No | If a httpd object was created previously and stored on nAttrMon's session data you can specify it here to be used (defaults to httpd if port is not used effectively binding to the same listener as nOutput_HTTP or nOutput_HTTP_JSON or nOutput_Channels). |
| **idKey** | String | No | Defines the map path to find the attribute name on the channel value and/or key *set* operation. Defaults to "name". |
| **valueKey** | String | No | Defines the map path to find the attribute value on the channel value. If you are using nOutput_RemoteChannel or similar you should use "val" on this parameter to ensure the attribute value is picked up. |
| **attrTemplate** | String | No | A Handlebars template to build the local attribute name. You can use {{id}} (the original attribute name), {{value}} (the identified value object) and {{originalValue}} the raw value received. Defaults to "{{id}}". |

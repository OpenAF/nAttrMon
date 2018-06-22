# Plugs <a href="/"><img align="right" src="images/logo.png"></a>

nAttrMon plugs are a basic unit to add inputs, outputs and validations to nAttrMon. Plugs have a common set of parameters to affect their behavior:

| Parameter | Type | Mandatory? | Description |
|-----------|------|------------|-------------|
| _name_ | String | Yes | Unique name of the plug independently of type (e.g. input, output, validation) |
| _category_ | String | No | Parameter to group plugs into a category (defaults to 'uncategorized'). In some cases the category is inferred from the name when "/" is used. |
| _timeInterval_ | Number | No | The time interval, in ms, for which this plug will be executed. If not provided it won't be executed unless a chSubscribe or a cron is provided. |
| _cron_ | String | No | Restricts when a plug execution should occur given a cron like expression (supporting minutes (5 entries) and seconds (6 entries). This can be used together with timeInterval (although not recommended for versions >= 20180119). |
| _chSubscribe_ | String | No | Subscribes the provided channel name so that this plug will only execute upon changes on that channel. Upon execution, on the arguments provided, the arguments ch (channel name), op (channel operation), k (key), v (value) will be provided. |
| _waitForFinish_ | Boolean | No | Determines if the next execution of a plug should wait for the end of the previous thus effectively not permitting concurrent execution (defaults to true) |
| _onlyOnEvent_ | Boolean | No | For input plugs determines if the value should always be changed on execution (onlyOnEvent = false) or if it should only be changed if the value itself it's different from the previous execution (onlyOnEvent = true). This can be useful to have less attribute values changes on outputs. |
| _sort_ | Map | No | Some attribute values are arrays that can be generated with a different order. To ensure that the attribute value is always sorted the 'sort' parameter can be defined where each key represents a possible attribute (whose value should be an array) that an input plug could generate. The value associated to each key should be an array of keys to sort by (for desc order add a '-' as a prefix).<br> For example if attribute 'attr1' outputs ````[ { i: 'Z', a: 123 }, { i: 'B', a: 321 }]```` the sort parameter could sort automatically the value of the attribute if defined as ````sort: { attr1: [ "i" ] }```` | 
| _merge_ | Map | No | Some attribute values are maps or array of maps that different input plugs can contribute to (e.g. input system A, input system B and input system C contribuing all for the same attribute 'System status'). If 'merge' is not defined each input plug overrides the result of the previous input but if defined the output can be merged. The 'merge' parameter should be defined as a map, in each input plug that contributes, where each key represents the possible generated attribute (either a map or array of maps) from each input plug. The value associated to each key should be a map indicating the key and value that defines an unique attribute and value for each input plug definition ````merge: { 'System status': { i: 'B' } }````. |
| _type_ | String | No | Defines the type of this plug. It can be system, input, output and validation (defaults to system). |
| _help_ | Map | No | Each map entry will be interpreted as a full attribute name to which you can associate a description value |
| _exec_ | String | No | The OpenAF execution code to execute this plug. This should be a function (if in JSON format) or it will be wrapped on a function (if in YAML/JSON format) with the arguments scope and args (for validations warns is also provided). | 
| _execArgs_ | Map | No | A custom arguments map to be passed to the execution. Usually used with execFrom when the execution is not included on the plug. |
| _execFrom_ | String | No | Name of nAttrMon object to be used for execution. Do control the necessary arguments with execArgs | 

Check out some examples of use in the [examples](Examples) page.
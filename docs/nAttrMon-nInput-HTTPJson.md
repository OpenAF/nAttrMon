# nInput HTTPJson <a href="/"><img align="right" src="images/logo.png"></a>

This input retrieves a json parsed content from a HTTP/HTTPs external URL and makes it the content of the corresponding attribute. It allows to apply a selector or even a function to filter the results to be stored on the attribute.

Example of use of the execArgs:

```yaml
input: 	
  name         : Get public IP info
  cron         : "*/5 * * * * *"
  waitForFinish: true
  onlyOnEvent  : false
  execFrom     : nInput_HTTPJson
  execArgs     :

    requests: 

      ifconfig service/Current public IP:
        url : https://ifconfig.com/json
        path: ip
      
      ifconfig service/Details:
        url : https://ifconfig.co/json
        fn  : |
          delete json.user_agent;
          return json;

      ifconfig service/User agent:
        url : https://ifconfig.co/json
        path: user_agent

      test service/Echo:
        url    : https://httpbin.org/post
        method : post
        options:
          urlEncode: true
          uriQuery : true
        data   :
          hello: world
        idx    :
          a: 123
````

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| requests | Map | No | A map of attribute names, each with a mandatory url and other optional arguments |
| requests.[attr].url | String | Yes | The url to where it should connect. |
| requests.[attr].method | String | No | The http verb to use (e.g. get, post, put, delete or patch). (defaults to "get"). |
| requests.[attr].options | Map | No | Options equivalent to the options provided on the OpenAF $rest function. |
| requests.[attr].data | Map | No | Optional options to pass to the $rest command. |
| requests.[attr].idx | Map | No | Optional, depending on the method used, index options to pass to the $rest command. |
| requests.[attr].path | String | No | Optional, limit the json result to the result of applying ow.obj.getPath. |
| requests.[attr].fn | String | No | The contents of an OpenAF function that receives as input (json) the json result and returns the filtered attribute content. |
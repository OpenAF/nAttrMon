This input tests a HTTP/HTTPs endpoint or a TCP port for reachability/expected availability. Each defined attribute will be a map with a boolean result and a errorMessage string (defaults to "n/a" if result = false).

Example of use of the execArgs:

```yaml
input: 	
   name         : Input EndPoints test
   cron         : @hourly
   waitForFinish: true
   onlyOnEvent  : true
   execFrom     : nInput_EndPoints
   execArgs     :

      urls  :

        APIs/Weather location:
           url                : http://www.metaweather.com/api/location/search/?query=Lisbon
           responseCode       : 200
           responseContentType: application/json
           responseRegExp     : Lisbon

        APIs/Test put:
           debug              : true
           url                : https://httpbin.org/put
           method             : put
           responseCode       : 200
           responseJsonMatch  : 
              headers:
                Connection: close

      ports  :

        APIs/Weather API port:
           address            : www.metaweather.com
           port               : 80
           timeout            : 2000

        APIs/Test port:
           address            : httpbin.org
           port               : 443

      chPorts: myPorts
      chUrls : myUrls
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| urls | Map | No | A map of attribute names, each with a mandatory url and optional method (e.g. GET, PUT, POST, ...), expected responseCode (e.g. 200, 401, ...), expected responseContentType (e.g. text/plain, ...), expected responseRegExp (content regular expression match), expected responseJsonMatch and debug boolean flag. |
| urls.[attr].url | String | Yes | The HTTP/HTTPs url to test. |
| urls.[attr].method | String | No | The HTTP(s) method to use to test the url (defaults to "GET"). |
| urls.[attr].responseCode | Number | No | If defined tests if the HTTP response was the provided value. |
| urls.[attr].responseContentType | String | No | If defined tests if the HTTP response content type was the provided value. |
| urls.[attr].responseRegExp | RegExp | No | If defined tests if the HTTP response content matches the provided regular expression. |
| urls.[attr].responseJsonMatch | Map | No | If defined tests if the provided map matches any entry of the JSON parsed HTTP response. |
| urls.[attr].debug | Boolean | No | If true will output to stdout the result of testing the provided url. |
| ports | Map | No | A map of attribute names, each with a mandatory address and port and optionally a timeout. |
| ports.[attr].address | String | Yes | The TCP address to test for reachability. |
| ports.[attr].port | Number | Yes | The TCP port to test for reachability. |
| ports.[attr].timeout | Number | No | The timeout, in ms, for the TCP connection test (defaults to 1500ms). |
| chUrls | String | No | A channel name for the urls argument equivalent entries on a channel. |
| chPorts | String | No | A channel name for the ports argument equivalent entries on a channel. |

*Note: As usual, passwords can be encrypted.*
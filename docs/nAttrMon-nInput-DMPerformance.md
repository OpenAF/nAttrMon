# nInput DMPerformance <a href="/"><img align="right" src="images/logo.png"></a>

This input retrieves the time elapsed to fully execute a set of DataModel queries (for the first 100 records) vs executing the corresponding SQL queries on the database to measure performance downgrades overtime. Use it for DataModel queries that you identify that will be a performance worry (e.g. main land page, heavy query, important indicatores, etc...). The queries can be executed just one time or in a series of n executions to select the best results (e.g. with caching).

Example of use of the execArgs:

```yaml
input:
  name    : DM performance
  cron    : "0 */1 * * *"
  execFrom: nInput_DMPerformance
  execArgs:
    keys   :
      - Server A
    bestOf : 3
    queries:
      Chart 1: 
        SelectedFields:
          - '({Key}) as "Key"'
          - 'sum({Total Charges}) as "Total Charges (sum)"'
          - 'sum({Voice Charge}) as "Voice Charge (sum)"'
          - 'sum({SMS Charges}) as "SMS Charges (sum)"'
          - 'sum({Data Charges}) as "Data Charges (sum)"'
        Filters:
          - ''
        OrderClauses:
          - '{Date} asc'
        BindValues: {}
        Options:
          Context: Chart (1)
          FetchMethod: FirstRows
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| attrTemplate | String | No | The template to determine the attribute name. Defaults to "Performance/{{key}} datamodel" |
| keys | Array | Yes or chKeys | A list of string keys of AF object pools to use to execute the DataModel query. The query to the database will be performed over the corresponding associated DB object pool (so be sure to add adm, app and dat). |
| chKeys | Channel | Yes or keys | Similar to keys but uses an OpenAF channel to dynamically determine the keys. |
| bestOf | Number | No | The number of times to repeat both DataModel and database queries to ensure cache is used (default to 1). |
| queries | Map | Yes | A map of queries to perform. Each query entry should correspond to a DataModel query map. Tip: use the JSON params entry from the corresponding DM.PrepareQuery directly (if you want to convert to YAML just copy+paste to an OpenAF console and execute ```af.toYAML([copy+paste])```) |

*To Do: adding query execution in parallel to better mimic the eventual performance issues in some cases.*
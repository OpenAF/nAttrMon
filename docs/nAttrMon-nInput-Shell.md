# nInput Shell <a href="/"><img align="right" src="images/logo.png"></a>

This input executes a shell command locally or remotely (via ssh) and can parse the output if JSON (otherwise will create an attribute with the stdout text).

Example of use of the execArgs:

```yaml
input: 	
   name         : Input shell test
   cron         : @hourly
   waitForFinish: true
   onlyOnEvent  : true
   execFrom     : nInput_Shell
   execArgs     :
      name        : myCmd
      attrTemplate: Commands/Script
      cmd         : /some/shell/command -status -someOtherArg
      parseJson   : false
      # chKeys     : sshObjPoolChannel
      # keys       :
      #    - sshObjPool1
      #    - sshObjPool2
``` 

| execArgs | Type | Mandatory | Description | 
| -------- | ---- | --------- |:----------- |
| cmd | String | Yes | The shell command (and corresponding arguments) to be executed locally or remotely. |
| parseJson| Boolean | No | Determine if the shell stdout output should be interpreted as JSON and converted as the attribute value or not (default is false). |
| name | String | No | A description name for the command being executed (if not provided defaults to cmd). |
| attrTemplate | String | No | The template to determine the attribute name. Defaults to "Server status/{{name}}" |
| keys | Array | No | A list of string keys of SSH object pools to use to remotely execute the cmd. The output will be a map with the entries key and result (if more than one key is provided). If only one key is provided "key" will be available also for attrTemplate. | 
| chKeys | Channel | No | Similar to keys but uses an OpenAF channel to dynamically determine the keys. |


*Note: As usual, users and passwords can be encrypted.*
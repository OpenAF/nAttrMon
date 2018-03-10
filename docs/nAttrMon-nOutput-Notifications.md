# nOutput Notifications <a href="/"><img align="right" src="/images/logo.png"></a>

This output sends push notifications (using https://pushover.net) upon match with a specific warning or warnings. 

**Note:** this plug requires the Notifications opack. Install it using "opack install notifications"

## Example of use of the execArgs

````yaml
consts:
   apitoken: &APITOKEN abc123abc123
   userid  : &USERID   123abc123abc

output:
   name       : Test output
   chSubscribe: nattrmon::warnings
   execFrom   : nOutput_Notifications
   execArgs   :
      APIToken     : *APITOKEN
      notifications:
         - warnLevel: HIGH
           warnTitle: Test warning
           userID   : *USERID
           message  : This is a test message for '{{warn.title}}' - '{{warn.description}}'
````

## Description of execArgs

| execArgs | Type | Mandatory | Description |
|:---------|:----:|:---------:|:------------|
| APIToken | String | Yes | The API token provided by pushover.net |
| notifications | Array | Yes | An array of warnings descriptions that will trigger a notification (once successfully sent the warning will be set to indicate that) |
| notifications.warnLevel | String | No | The warning level to match an existing warning (if not defined defaults to HIGH) |
| notifications.warnTitle | RegExp | No | A regular expression to match existing warning titles (if not defined defaults to all titles) |
| notifications.userID | String | Yes | The user id provided by pushover.net |
| notifications.message | String | Yes | A template (using handlebars) of the notification message to send. The entry "warn" is provided for the matching warning (e.g. warn.title, warn.description, ...) |

You can also use [nAttrMon generic template helpers](nAttrMon-template-helpers) to access other attribute values, previous attribute values, etc... for the notifications.message argument.
# nOutput EmailWArnings <a href="/"><img align="right" src="images/logo.png"></a>

This output sends email notifications whenever a specific type or types of warnings (usually 'High' level) are created. The email will follow the template in object.assets/noutputemailwarnings displaying all the current warnings for all warning levels (e.g. High, Medium, Low and Info).

## Example of use of the execArgs

````yaml
output:
   name         : Output EMail warning
   chSubscribe  : nattrmon::warnings
   wairForFinish: true
   onlyForEvent : true
   execFrom     : nOutput_EmailWarnings
   execArgs     : 
      to         : 
        - email1@openaf.io
        - email2@openaf.io
      subject    : "[nattrmon] My monitoring"
      from       : nattrmon@openaf.io
      server     : smtp.openaf.io
      #port       : 465
      #credentials:
      #  user    : mylogin
      #  password: mypassword
      #debug      : false
      #warnTypes  :
      #  - High
      #  - Medium
      #include    :
      #  - Warning to include
      #exclude    :
      #  - Warning to exclude
````

## Description of execArgs

| execArgs | Type | Mandatory | Description |
|:---------|:----:|:---------:|:------------|
| to       | Array/String | Yes | An array or string containing the email address to send the email to |
| subject  | String | Yes | The email subject |
| from     | String | Yes | The email from address |
| server   | String | Yes | The email SMTP server |
| port     | Number | No | The specific email SMTP server port |
| credentials.user | String | No | The user credential to access an email SMTP server |
| credentials.password | String | No | The password credential to access an email SMTP server (can be encrypted) |
| debug    | Boolean | No | If true it will output all the communication with the email SMTP server |
| warnTypes | Array | No | Defines a list of warning levels/types for which to trigger an email | 
| include | Array | No | An array of warning titles to restrict which warnings should be displayed on the email and trigger the email |
| exclude | Array | No | An array of warning titles to exclude from displaying on the email and triggering the email | 


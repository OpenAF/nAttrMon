# nAttrMon's .nattrmonignore <a href="/"><img align="right" src="images/logo.png"></a>

There are two mechanisms in nAttrMon to disable/enable objects, inputs, outputs and validations (or any kind of plug for that matter):

   1. moving the corresponding plug file to the folder _*.disabled_
   2. entering the plug file location on the file _[nAttrMon config]/.nattrmonignore_

Each mechanism has pros and cons:

| Mechanism | Pros | Cons |
|-----------|------|------|
| ***.disabled** | - File location determines if it's in use or not.<br>- Enables shipment of sample plugs. | - Harder to keep a source versioned config where only small disables/enables are required per environment.<br>- Can get messy between sample plugs and customized disabled plugs. |
| **.nattrmonignore** | - One file easy to ignore on source versioned configs.<br>- Textual description with comment/uncomment capability. | - Not immediately visible what is enabled and disabled.<br>- When using regular expressions can be powerfull and also "ambiguous". |

Both mechanisms co-exist and can be used when the pros/cons are right for each case.

## .nattrmonignore syntax

Each line is processed with the following steps:

1. Spaces are trimmed from the start and end of each line.
2. If the line starts with a "#" it's ignored and considered a comment.
3. Each line is matched with each folder name and filename exact name to ignore plugs or plug directories.
4. Each line is matched as a regular expression with each folder name and filename to ignore plugs or plugs directories.

Sample:

```` bash
###
# The main configuration should not be considered
# a plug but kept on the inputs folder
inputs/config.yaml

### 
# Uncomment the corresponding line to disable a system input
#
#inputs/systems/a.yaml
#inputs/systems/b.yaml
#inputs/systems/c.yaml

###
# Comment the following lines to disable testing
inputs/test                    # folder
validations/test\..+\.yaml     # regular expression
outputs/test/myTestOutput.yaml # file
````
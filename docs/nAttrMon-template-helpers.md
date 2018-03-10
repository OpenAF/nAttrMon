# Template helpers <a href="/"><img align="right" src="images/logo.png"></a>

Throughout nAttrMon you can use OpenAF's template functionality (ow.template based on Handlebars) for which nAttrMon registers some Handlebars helpers to access internal nAttrMon data as described on the following table:

| Helper | Usage example | Description |
|:-------|:--------------|:------------|
| **attr** | *{{attr 'Cat/Attr' 'name' 'default'}}*<br><br>*{{attr 'Cat/Attr' 'category[0]'}}* | Access any attribute entry by name (accessing the nattrmon::attrs channel). This will result in a map with: name, description, type, category, lastcheck, simplename and tags. As a second parameter its possible to access a specific entry. As a third parameter its possible to specify a default value in case an attribute value is not found. |
| **cval** | *{{cval 'Cat/Attr' 'val.region' 'default'}}*<br><br>*{{cval 'Cat/Attr' 'val[2].REGION'}}* | Access any current value attribute entry by name (accessing the nattrmon::cvals channel). This will result in a map with: name, val and date. As a second parameter its possible to access a specific entry. As a third parameter its possible to specify a default value in case an attribute current value is not found. |
| **lval** | *{{lval 'Cat/Attr' 'val.region' 'default'}}*<br><br>*{{lval 'Cat/Attr' 'val[2].REGION'}}* | Access any last value attribute entry by name (accessing the nattrmon::lvals channel). This will result in a map with: name, val and date. As a second parameter its possible to access a specific entry. As a third parameter its possible to specify a default value in case an attribute last value is not found. | 
| **warn** | *{{warn 'A warn title' 'level' 'default'}}* | Access any warning entry by title (accessing the nattrmon::warns channel). This will result in a map with: level, title, description, lastupdate, createdate and notified. As a second parameter its possible to access a specific entry. As a third parameter its possible to specify a default value in case an warning value is not found. |
| **debug** | *{{debug object}}* | Prints, to the stdout, a stringify representation of the provided object. |
| **stringify** | *{{stringify object}}* | Returns a string representing the stringify of the provided object. |
| **stringifyInLine** | *{{stringifyInLine object}}* | Similar to stringify but without returning any new lines. | 
| **toYAML** | *{{toYAML object}}* | Returns a YAML representation of the provided object. |

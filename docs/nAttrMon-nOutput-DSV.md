# nOutput DSV <a href="/"><img align="right" src="images/logo.png"></a>

This output will generate DSV/CSVs files writing a specific template (using attribute values or warnings) per a given date and performing automatic housekeeping to previous generated files.

## Example of use of the execArgs

````yaml
output:
   name       : Test output
   chSubscribe: nattrmon::cvals
   execFrom   : nOutput_DSV
   execArgs   :
     # filename         : myCSVFile.csv
     folder             : /myData/myCSVs
     # filenameTemplate   : "myCSV-{{timedate}}.csv"
     # fileDateFormat     : "myCSV\\d{4}-\\d{2}-\\d{2}\\.csv"
     # howLongAgoInMinutes: 7200
     # dontCompress       : true
     # include            :
     #    - Attr 1
     #    - Attr 2
     # exclude            :
     #    - Attr 3
     headerTemplate     : "Date Time; Attr 1; Attr 2"
     outputTemplate     : "{{datetime}}; {{values.[Attr 1].val}}: {{values.[Attr 2].val}}"
````

## Description of execArgs

| execArgs | Type | Mandatory | Description |
|:---------|:----:|:---------:|:------------|
| filename | String | Yes (if folder not present) | The DSV/CSV filename to write the file. Alternatively you can use folder to write more than one file per datetime. |
| folder | String| Yes (if filename not present) | The folder where the DSV/CSV filenames will be written to. Alternatively you can specify a single filename. |
| filenameTemplate | String | No | A Handlebars template where you can use {{timedate}} to have the current time & date to build the filename (only available if a folder is used). Defaults to "{{timedate}}.csv". Example: "data-{{timedate}}.csv". |
| fileDateFormat | String | No | The format for "timedate" used in filenameTemplate. Defaults to "yyyy-MM-dd" (check "help ow.format.toDate" on an openaf-console for more info). |
| howLongAgoInMinutes | Number | No | How long to keep files (compressed or not) on the specified folder in minutes. Defaults to 7200 minuts. |
| dontCompress | Boolean | No | Specifies if old files on folder should be compressed or note. Defaults to false. |
| headerTemplate | String | No | Defines a Handlebars template to be used as a DSV/CSV header. Available to the template are the generic template helpers plus: {{datetime}} the current date time; {{values}} a map of the current attribute values; {{warnings}} a map of warning Levels and an array, per each, of the corresponding warnings; {{lastvalues}} a map of the last attribute values; {{attributes}} a map of the current attributes defined. If not specified no header will be used. |
| outputTemplate | String | Yes | Defines a Handlebars template to be used as the DSV/CSV line. Available to the template are the generic template helpers plus: {{datetime}} the current date time; {{values}} a map of the current attribute values; {{warnings}} a map of warning Levels and an array, per each, of the corresponding warnings; {{lastvalues}} a map of the last attribute values; {{attributes}} a map of the current attributes defined. |
| include | Array | No | An array of attribute names to include. |
| exclude | Array | No | An array of attribute names to exclude. |

You can also use [nAttrMon generic template helpers](nAttrMon-template-helpers) to access other attribute values, previous attribute values, etc... for the DSV.headerTemplate and DSV.outputTemplate arguments.
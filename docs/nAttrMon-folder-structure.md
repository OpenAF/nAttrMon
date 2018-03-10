# Folders <a href="/"><img align="right" src="images/logo.png"></a>

| Folder | Description |
|--------|-------------|
|Root folder| The main folder where the main script resides.|
|Config| All the specific configuration of a nAttrMon installation (the only folder that should have any changes). |
|Lib| All the generic javascript objects used in nAttrMon (e.g. inputs, warnings, etc...) |
|Tests| Scripts and examples to execute unit-testing when adding new inputs, outputs and validations. |
|Util| Utilitary scripts and oJobs. |

## Root folder

The main thing of interest here is the main *nattrmon.js* script. You should start or create any init.d (see the initd opack) from this folder. 

## Config

This is where all the configuration of a nAttrMon installation is. It's possible to provide a different config folder by using the withDirectory parameter (e.g. "openaf --script nattrmon.js -e withDirectory=/some/other/config").

The config folders as the following main sub-folders:

| Sub-folder | Description |
|------------|-------------|
| inputs | Where all the **active** input *plugs* files (either yaml, json or js) exist. |
| inputs.disabled | Where all the **inactive** input *plugs* files (either yaml, json or js) exist. This is a good place to check-out the distributed examples to copy to the inputs folder and adapt to your monitoring objectives. |
| outputs| Where all the **active** output *plugs* files (either yaml, json or js) exist. |
| outputs.disabled | Where all the **inactive** output *plugs* files (either yaml, json or js) exist. This is a good place to check-out the distributed examples to copy to the outputs folder and adapt to your monitoring objectives. |
| validations| Where all the **active** validation *plugs* files (either yaml, json or js) exist. |
| validations.disabled | Where all the **inactive** validation *plugs* files (either yaml, json or js) exist. This is a good place to check-out the distributed examples to copy to the validations folder and adapt to your monitoring objectives. 
| objects | This is the place for reusable inputs, outputs and validations. They can be used with execFrom (in yaml and json plug files) or instantiating the javascript object (in javascript plug files) |
| objects.assets | This is where objects on the *objects* folder refer to their corresponding assets (for example css for HTTP output) |

## Lib

This is where all the basic and essential javascript objects used by nAttrMon exist. It's recommended to keep it as distributed. 

## Tests

This folder as files that you can use directly on another server or your PC (installing the nattrmon opack locally) to perform unit tests of input, output and validation plugs against a running nAttrMon instance. This is particularly useful when creating outputs and validations using the existing inputs. Keep in mind that you still need to create any object pool (for example: db connections pool) that you use in nattrmon so you might need to change the files.

### unitTest.js

This is the main unit test script to javascript plugs (including internally nattrmonTester.js. Then edit unitTest.js and configure the NATTRMON_SERVER_IP and NATTRMON_CHS_PORT. The nAttrMon that you will unit testing against needs to have the channels output active and you need to use the correct channel user and password. 

To test an input, output or validation plug just uncomment the corresponding section in unitTest.js and execute it as any other OpenAF script.

### unitTestYAML.js

This is similar to *unitTest.js* but was made for you to unit test yaml input, output and validation plugs. It will automatically scan your local config folder (the default one provided on the opack) for objects and any inputs, outputs or validations ending in ".init.js" to initialize any necessary objects. Then you just need to execute *openaf --script unitTestYAML.js -e withYAML=myFile.yaml* and your yaml plug will be executed together with some metrics about processing time and probable/potential memory used.

## Util

This contains several utility scripts and oJobs:

| Script or oJob | Description |
|----------------|-------------|
| backupConfig.yaml | oJob to create a zip of the relevant configuration input, output and validation plugs files and any existing snapshots. You can invoke it executing *ojob backupConfig.yaml filename=myConfig.zip* |
| clean.yaml | This oJob will clean all files produced after running a nAttrMon instance. It should be use to reset nAttrMon to a clean status. |
| loadDB2Elastic.js | Example script to load a nOutput_H2 database file into an existing ElasticSearch cluster/node. |
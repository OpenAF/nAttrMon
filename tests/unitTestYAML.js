load("nattrmonTester.js");
let NATTRMON_SERVER_IP = "127.0.0.1";
let NATTRMON_CHS_PORT  = "8090";
let NATTRMON_CONFIG    = "../config";

// INITs
// -----
var nattrmon = new nAttrMon("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT, NATTRMON_CONFIG);
$ch("pres").createRemote("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "/chs/pres");
$ch("pros").createRemote("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "/chs/pros");
$ch("ldap").createRemote("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "/chs/ldap");

log("Connecting to nAttrMon on " + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "...");
$ch("cvals").size();
var params = processExpr();

if (isUnDef(params.withYAML)) throw "Please provide an input or output or validation yaml executing \"openaf --script unitTestYAML.js -e withYAML=myFile.yaml\"";
try {
   $from(listFilesRecursive(NATTRMON_HOME + "/config/objects")).equals("isFile", true).ends("filename", ".js").select(function(r) { log("Loading " + r.filepath); af.load(r.filepath); });
   $from(listFilesRecursive(NATTRMON_HOME + "/config/inputs")).equals("isFile", true).ends("filename", ".init.js").select(function(r) { log("Loading " + r.filepath); af.load(r.filepath); });
   $from(listFilesRecursive(NATTRMON_HOME + "/config/outputs")).equals("isFile", true).ends("filename", ".init.js").select(function(r) { log("Loading " + r.filepath); af.load(r.filepath); });
   $from(listFilesRecursive(NATTRMON_HOME + "/config/validations")).equals("isfile", true).ends("filename", ".init.js").select(function(r) { log("Loading " + r.filepath); af.load(r.filepath); });
} catch(e) {
   logErr(stringify(e));
}

ow.loadTest().setMemoryProfile(true);
print("Results:\n" + stringify(ow.test.test(params.withYAML, function() {
   var nattrmonYAMLFile = io.readFileYAML(params.withYAML, true);

   if (isDef(nattrmonYAMLFile.input)) return nattrmon.loadObject(nattrmonYAMLFile.input, "input").exec.exec(nattrmon, nattrmonYAMLFile.input.execArgs);
   if (isDef(nattrmonYAMLFile.output)) return nattrmon.loadObject(nattrmonYAMLFile.output, "output").exec.exec(nattrmon, nattrmonYAMLFile.output.execArgs);
   if (isDef(nattrmonYAMLFile.validation)) return nattrmon.loadObject(nattrmonYAMLFile.validation, "validation").exec.exec(nattrmon, nattrmonYAMLFile.validation.execArgs);
})));

var execInfo = ow.test.getChannel().get(params.withYAML);
log("Stats: executed in " + execInfo.executions[0].elapsedTime + "ms ; probable memory used = " + ow.loadFormat().toBytesAbbreviation(Math.abs(execInfo.executions[0].diffMem)));


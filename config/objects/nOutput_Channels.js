// Author: nuno.aguiar@wedotechnologies.com

// Channel permissions
// [BEGIN] -----------
var cauth_perms = {
	"nattrmon": {
		p: "nattrmon",  // password
		m: "r"          // permissions (r, rw)
    }
};
// [END] -------------

var nOutput_Channels = function (aMap) {
    // Set server if doesn't exist
    if (!nattrmon.hasSessionData("httpd")) {
        plugin("HTTPServer");
        nattrmon.setSessionData("httpd", new HTTPd(isUnDef(aMap.port) ? 8090 : aMap.port));
    }

    // Get server
    var httpd;
    if (isDef(aMap.port)) {
      httpd = ow.loadServer().httpd.start(aMap.port);
    } else {
      httpd = nattrmon.getSessionData("httpd");
    }

    if (isDef(aMap.cAuth)) cauth_perms = aMap.cAuth;

    if (isDef(httpd)) {
        // Channel authentication
        var chAuth = function(u, p, s, r) {
            if (isDef(cauth_perms[u])) {
                if (p == cauth_perms[u].p) {
                    r.channelPermission = (isDef(cauth_perms[u].m) ? cauth_perms[u].m : "r");
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    
        $ch("nattrmon::ops").create(1, "ops", {
            "help": function() {
              return {
                "list": "List all plug types with the corresponding array of plugs definitions.",
                "reloadPlug": "Tries to reload a plug. Use only for debug proposes (see documentation for limitations). Provide as arguments { file: \"plugTypeDir/aFileNameAndExtension\" }",
                "clearAttribute": "Tries to delete all references to an attribute ({ name: 'attribute name' }).",
                "closeWarning": "Tries to close a warning. Use, as argument, { title: \"The warning title\" }",
                "clearAllWarnings": "Tries to delete all warnings. You will need to provide as argument { force: true }",
                "test": "Use 'list' to find out the plug type you need and plug name and build the arguments { type: 'inputs', name: 'name', args: { ... }}. The result will be error or the result of running the corresponding plug. Even if successull nAttrMon will NOT consider the result.",      
                "run" : "Use 'list' to find out the plug type you need and plug name and build the arguments { type: 'inputs', name: 'name', args: { ... }}. The result will be error or the result of running the corresponding plug. If successfull nAttrMon will consider the result."
              };
            },

            "list": function() {
              if (isDef(nattrmon.plugs)) {
                return {
                  inputs     : (isDef(nattrmon.plugs.inputs)) ? $stream(nattrmon.plugs.inputs).map("aName").toArray().sort() : [],
                  outputs    : (isDef(nattrmon.plugs.outputs)) ? $stream(nattrmon.plugs.outputs).map("aName").toArray().sort() : [],
                  validations: (isDef(nattrmon.plugs.validations)) ? $stream(nattrmon.plugs.validations).map("aName").toArray().sort() : []
                };
              } else {
                return {};
              }
            },

            "closeWarning": function(value) {
              if (isUnDef(value.title)) {
                return {
                  error: "Incorrect parameters."
                };
              }

              if (value.force) {
                var warn = nattrmon.listOfWarnings.getCh().get({ title: value.title });
                if (isDef(warn)) {
                  nattrmon.listOfWarnings.getCh().unset({ title: value.title });
                  logWarn("OPS | Warning '" + value.title + "' forced deleted!");
                  return { successfull: true };
                } else {
                  return { error: "The warning with title '" + value.title + "' wasn't found." };
                }
              } else {
                var warn = nattrmon.listOfWarnings.getCh().get({ title: value.title });
                if (isDef(warn)) {
                  warn.level = nWarning.LEVEL_CLOSED;
                  nattrmon.listOfWarnings.getCh().set({ title: value.title }, warn);
                  logWarn("OPS | Warning '" + value.title + "' forced close.");
                  return { successfull: true };
                } else {
                  return { error: "The warning with title '" + value.title + "' wasn't found." };
                }
              }
            },

            "closeAllWarnings": function(value) {
              // Ensure force is implicitly declared
              if (isUnDef(value.force)) {
                return {
                  error: "Incorrect parameters."
                };
              }

              if (value.force) {
                var warns = nattrmon.listOfWarnings.getCh().getKeys();
                var c = 0;
                for(var warn in warns) {
                  nattrmon.listOfWarnings.getCh().unset({ title: warns[warn].title });
                  logWarn("OPS | Warning '" + warns[warn].title + "' forced deleted!");
                  c++;
                } 
                return { successfull: true, warningsClosed: c };
              } else {
                var warns = nattrmon.listOfWarnings.getCh().getAll();
                var c = 0;
                for(var warn in warns) {
                  warns[warn].level = nWarning.LEVEL_CLOSED;
                  nattrmon.listOfWarnings.getCh().set({ title: warns[warn].title }, warns[warn]);
                  logWarn("OPS | Warning '" + warns[warn].title + "' forced close.");
                  c++;
                }
                return { successfull: true, warningsClosed: c };
              }
            },

            "clearAttribute": function(value) {
              if (isUnDef(value.name)) return {};
              try {
                var atr = nattrmon.listOfAttributes.getCh().get({ name: value.name });
                if (isDef(atr)) {
                  nattrmon.listOfAttributes.getCh().unset({ name: value.name });
                  nattrmon.currentValues.unset({ name: value.name });
                  nattrmon.lastValues.unset({ name: value.name });
                  logWarn("OPS | Attribute '" + value.name + "' forced clear from attributes, current values and last values.");
                  return {
                    name: value.name
                  };
                } else {
                  logErr("OPS | Error: " + stringify(e));
                  return {
                    error: "Attribute '" + value.name + "' not found"
                  };
                }
              } catch (e) { 
                logErr("OPS | Error " + stringify(e));
              }              
              return {};
            },

            "reloadPlug": function(value) {
                if (isUnDef(value.file)) {
                  return {
                    error: "Incorrect parameters.",
                    params: value
                  };
                }

                var truePath;
                try {
                  truePath = (new java.io.File(nattrmon.configPath + "/" + value.file)).getCanonicalPath();
                  if (!(truePath.startsWith((new java.io.File(nattrmon.configPath).getCanonicalPath())))) {
                    throw "Only files under " + nattrmon.configPath + " can be reloaded (" + truePath + ")";
                  }
                } catch(e) {
                  return {
                    error: "Incorrect path: " + e,
                    params: value
                  }
                }

                try {
                    nattrmon.loadPlug(String(truePath));
                    return { successfull: true };
                } catch(e) {
                    logErr("OPS | Reloading plug " + value.file + " error: " + stringify(e));
                    return { error: e };
                }
            },

            "test": function(value) {
              var resOp;
          
              if (isUnDef(value.type) || isUnDef(value.name)) {
                return {
                  error: "Incorrect parameters.",
                  params: value
                };
              }
          
              if ($from(nattrmon.plugs[value.type]).equals("aName", value.name).none()) {
                logWarn("OPS | Request for plug type '" + value.type + "' with name '" + value.name + "' not found.");
                return {
                  error: "Not found. Please use list to find the appropriate values."
                };
              }
          
              logWarn("OPS | " + value.type + "::" + value.name + " | START | Test execution, ignoring result");
              try {
                var plug = $from(nattrmon.plugs[value.type]).equals("aName", value.name).at(0);
                resOp = { testResult: plug.exec(nattrmon, merge({ __dontCommit: true }, value.args)) };
                logWarn("OPS | " + value.type + "::" + value.name + " | END | Test execution, ignoring result");      
              } catch(e) {
                logErr("OPS | " + value.type + "::" + value.name + " | Error executing plug: " + stringify(resOp));
                resOp = { 
                  error: e
                };
              }
              return resOp;
            },

            "run": function(value) {
              var resOp;
          
              if (isUnDef(value.type) || isUnDef(value.name)) {
                return {
                  error: "Incorrect parameters.",
                  params: value
                };
              }
          
              if ($from(nattrmon.plugs[value.type]).equals("aName", value.name).none()) {
                logWarn("OPS | Request for plug type '" + value.type + "' with name '" + value.name + "' not found.");
                return {
                  error: "Not found. Please use list to find the appropriate values."
                };
              }
          
              logWarn("OPS | " + value.type + "::" + value.name + " | START | Test execution, ignoring result");
              try {
                var plug = $from(nattrmon.plugs[value.type]).equals("aName", value.name).at(0);
                resOp = { runResult: plug.exec(nattrmon, value.args) };
                logWarn("OPS | " + value.type + "::" + value.name + " | END | Test execution, ignoring result");      
                nattrmon.addValues(plug.onlyOnEvent, resOp.runResult);
                logWarn("OPS | " + value.type + "::" + value.name + " | RESULT CONSIDERED | Executing and considering values");      
              } catch(e) {
                logErr("OPS | " + value.type + "::" + value.name + " | Error executing plug: " + stringify(resOp));
                resOp = { 
                  error: e
                };
              }
              return resOp;
            }
        });

        nattrmon.currentValues.expose(httpd, "/chs/cvals", chAuth);
        nattrmon.lastValues.expose(httpd, "/chs/lvals", chAuth);
        $ch("nattrmon::attributes").expose(httpd, "/chs/attrs", chAuth);
        $ch("nattrmon::warnings").expose(httpd, "/chs/warns", chAuth);
        $ch("nattrmon::plugs").expose(httpd, "/chs/plugs", chAuth);  
        $ch("nattrmon::ops").expose(httpd, "/chs/ops", chAuth);
        
    } else {
        throw "Need a http output defined.";
    }

	nOutput.call(this, this.output);
};
inherit(nOutput_Channels, nOutput);

nOutput_Channels.prototype.output = function (scope, args) {
};
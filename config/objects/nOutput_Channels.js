// Author: nuno.aguiar@wedotechnologies.com

// Channel permissions
// [BEGIN] -----------
var cauth_perms = {
	"nattrmon": {
		p: "nattrmon",  // password
		m: "r"          // permissions (r, rw)
    },
    "change": {
        p: "me", 
        m: "rw"
    }
};
// [END] -------------

var nOutput_Channels = function (aMap) {
    // Set server if doesn't exist
    if (!nattrmon.hasSessionData("httpd")) {
        plugin("HTTPServer");
        nattrmon.setSessionData("httpd", new HTTPd(isUnDef(aMap.port) ? 17878 : aMap.port));
    }

    // Get server
    var httpd = nattrmon.getSessionData("httpd");

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
                //"reloadPlug": "Tries to reload a plug. Use only for debug proposes. Use 'list' to find out the plug type you need and plug name and build the arguments { type: 'inputs', name: 'name'}.",
                //"clearAttribute": "Tries to delete all references to an attribute.",
                //"closeWarning": "Tries to close a warning.",
                //"clearAllWarnings": "Tries to delete all warnings.",
                "test": "Use 'list' to find out the plug type you need and plug name and build the arguments { type: 'inputs', name: 'name'}. The result will be error or the result of running the corresponding plug. Even if successull nAttrMon will NOT consider the result.",      
                "run" : "Use 'list' to find out the plug type you need and plug name and build the arguments { type: 'inputs', name: 'name'}. The result will be error or the result of running the corresponding plug. If successfull nAttrMon will consider the result."
              };
            },
            "list": function() {
              return nattrmon.plugs;
            },
            "clearAttribute": function(attrName) {
              var atr = $("nattrmon::attrs").get({ name: attrName });
              if (isDef(atr)) {
                $("nattrmon::attrs").unset({ name: attrName });
                $("nattrmon::cvals").unset({ name: attrName });
                $("nattrmon::lvals").unset({ name: attrName });
              } else {
                logErr("OPS | Error: " + stringify(e));
                return {
                  error: "Atribute '" + attrName + "' not found"
                }
              }
            },
            "reloadPlug": function(value) {
                if (isUnDef(value.type) || isUnDef(value.name)) {
                  return {
                    error: "Incorrect parameters.",
                    params: value
                  };
                }

                try {
                    var plug = $from(nattrmon.plugs[value.type]).equals("aName", value.name).at(0);
                    logWarn("OPS | " + value.type + "::" + value.name + " | Stopping plug");
                    //plug.close();
                    logWarn("OPS |  " + value.type + "::" + value.name + " | Reloading plug");
                    //nattrmon.loadPlugs();
                    return { successfull: true };
                } catch(e) {
                    logErr("OPS | " + value.type + "::" + value.name + " | Error: " + stringify(e));
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
                resOp = plug.exec(nattrmon);
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
                resOp = plug.exec(nattrmon);
                logWarn("OPS | " + value.type + "::" + value.name + " | END | Test execution, ignoring result");      
                nattrmon.addValues(plug.onlyOnEvent, resOp);
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
}
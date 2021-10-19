/**
 * <odoc>
 * <key>nattrmon.nInput_Sessions(aMap) : nInput</key>
 * You can create an input to check for sessions using a map composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template)\
 * \
 * </odoc>
 */
var nInput_Sessions = function(aMap) {
	if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
	}
	
	if (isObject(aMap)) {
		this.params = aMap;

		// If keys is not an array make it an array.
		if (!(isArray(this.params.keys))) this.params.keys = [ this.params.keys ];
	} 

	if (isDef(this.attributePrefix)) {
		this.params.attrTemplate = this.attributePrefix;
	}
    if (isUnDef(this.params.attrTemplate)) {        
		this.params.attrTemplate = "RAID Server status/Sessions";
	}

	nInput.call(this, this.input);
}
inherit(nInput_Sessions, nInput);

nInput_Sessions.prototype.__getSessions = function(aKey, scope) {
	var retSes = {};
    var ses, parseResult = false;
	var parent = this;

	try {
		if (isDef(aKey)) {
			if (isString(parent.params.useCache)) {
				var res = $cache("nattrmon::" + parent.params.useCache + "::" + aKey).get({ op: "StatusReport", args: { } });
				if (isMap(res) && isDef(res.__error)) throw res.__error;
				ses = res.Services["wedo.jaf.services.sessions.SessionManagerBase"];
				ses = (isDef(ses) ? ses = ses.SessionManager.Sessions : []);
				parseResult = true;
			} else {
				nattrmon.useObject(aKey, s => {
					try {
						ses = s.exec("StatusReport", {});
						if (isMap(ses) && isDef(ses.Services) && isDef(ses.Services["wedo.jaf.services.sessions.SessionManagerBase"])) {
							ses = ses.Services["wedo.jaf.services.sessions.SessionManagerBase"];
							ses = (isDef(ses) ? ses = ses.SessionManager.Sessions : []);
							parseResult = true;
							return true;
						} else {
							return false;
						}
					} catch(e) {
						logErr("Error while retrieving sessions using '" + aKey + "': " + e.message);
						return false;
					}
				});
			}
		} else {
			try {
				ses = s.exec("StatusReport", {}).Services["wedo.jaf.services.sessions.SessionManagerBase"];
				if (isMap(ses) && isDef(ses.Services) && isDef(ses.Services["wedo.jaf.services.sessions.SessionManagerBase"])) {
					ses = ses.Services["wedo.jaf.services.sessions.SessionManagerBase"];
					ses = (isDef(ses) ? ses = ses.SessionManager.Sessions : []);
					parseResult = true;
				}
			} catch(e) {
				logErr("Error while retrieving sessions: " + e.message);
			}
		}
		
		if (parseResult) {
			retSes = $from(ses).select(r => {
				r["Name"] = aKey; 
			    r["Start Time"] = ow.format.fromWeDoDateToDate(r["Start Time"]);
				return {
				  "Name": aKey,
				  "Username": r.Username,
				  "Id": r.Id,
				  "Start Time": r["Start Time"]
			   };
		   });
		} else {
			throw "can't parse results";
		}
	} catch(e) {
		logErr("Error while retrieving sessions using '" + aKey + "': " + e.message);
	}

	return retSes;
};

nInput_Sessions.prototype.input = function(scope, args) {
	var res = {};
	var arr = [];

	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

	for(var i in this.params.keys) {
		arr = arr.concat(this.__getSessions(this.params.keys[i], scope));
	}
   
    res[templify(this.params.attrTemplate)] = $from(arr).sort("Name", "Start Time", "Username").select();
	return res;
};


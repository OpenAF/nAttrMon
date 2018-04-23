/*
Example:

new nInput_LogErrorAgg([
	{"name": "Log 1", "file": "/my/folder/1.log", "pattern": ".+ERROR\\s+(\\S+).+"},
	{"name": "Log 2", "file": "/my/folder/2.log", "pattern": ".+ERROR\\s+(\\S+).+"}
])

 */
//anAttributeName, anArrayOfLogsAndPatterns
var nInput_LogErrorAgg = function(aMap) {
	if (isUnDef(aMap)) aMap = {};
	this.params = aMap;
	if (isDef(aMap.logs) && isArray(aMap.logs)) this.logsandpatterns = aMap.logs;
	if (isDef(aMap.chLogs)) this.chLogs = aMap.chLogs;
	if (isDef(aMap.attrTemplate)) this.attrTemplate = aMap.attrTemplate; else this.attrTemplate = "Filesystem/Logs";

	if (isUnDef(this.chLogs) && isUnDef(this.logsandpatterns)) 
		throw "You need to provide either a 'logs' array or a corresponding 'chLogs' channel";

	nInput.call(this, this.input);
};
inherit(nInput_LogErrorAgg, nInput);

nInput_LogErrorAgg.prototype.checkFile = function(ar, aSSHObj) {
	var errors = {};

	for(var i in ar) {
		var item = ar[i];

		try {
			var lines;
			if (isDef(aSSHObj)) {
				lines = aSSHObj.exec("grep -E '" + item.pattern + "' " + item.file).split(/\n/g);	
			} else {
				lines = sh("grep -E '" + item.pattern + "' " + item.file).split(/\n/g);
			}

			for(var j in lines) {
				var line = lines[j];

				try {
					var error = line.match(new RegExp(item.pattern));
					if (error != null) {
						if (isUnDef(errors[error[1]]))
							errors[error[1]] = 1;
						else
							errors[error[1]] += 1;
					}
				} catch(e) {
					logErr("Error parsing line in: '" + item.file + "' for '" + this.name + " - " + e.message);
				}
			}
		} catch(e) {
			logErr("Error checking file: '" + item.file + "' for '" + this.name + " - " + e.message);
		}
	}
	
	return errors;
};

nInput_LogErrorAgg.prototype.input = function(scope, args) {
	var ret = [];
	var attr = {};
	var errors = {};

	var ar = [];
	if (isDef(this.logsandpatterns)) ar = this.logsandpatterns;
	if (isDef(this.chLogs)) ar = $ch(this.chLogs).getAll();

	if (isDef(this.params.chKeys) || isDef(this.params.keys)) {
		var res = [], attrname;

		if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

		for(var i in this.params.keys) {
			nattrmon.useObject(this.params.keys[i], (ssh) => {
				errors = merge(errors, this.checkFile(ar, ssh));
			});
		}
	} else {
		errors = merge(errors, this.checkFile(ar));
	}

	attr[templify(this.attrTemplate)] = errors;
	return attr;
};
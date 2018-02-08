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
	if (isDef(aMap.logs) && isArray(aMap.logs)) this.logsandpatterns = aMap.logs;
	if (isDef(aMap.chLogs)) this.chLogs = aMap.chLogs;
	if (isDef(aMap.attrTemplate)) this.attrTemplate = aMap.attrTemplate; else this.attrTemplate = "Filesystem/Logs";

	if (isUnDef(this.chLogs) && isUnDef(this.logsandpatterns)) 
		throw "You need to provide either a 'logs' array or a corresponding 'chLogs' channel";

	nInput.call(this, this.input);
}
inherit(nInput_LogErrorAgg, nInput);

nInput_LogErrorAgg.prototype.input = function(scope, args) {
	var ret = [];
	var attr = {};
	var errors = {};

	var ar = [];
	if (isDef(this.logsandpatterns)) ar = this.logsandpatterns;
	if (isDef(this.chLogs)) ar = $ch(this.chLogs).getAll();

	for(var i in ar) {
		var item = ar[i];

		try {
			var lines = io.readFileAsArray(item.file);

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

	attr[templify(this.attrTemplate)] = errors;
	return attr;
};
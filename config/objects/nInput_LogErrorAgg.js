/*
Example:

new nInput_LogErrorAgg([
	{"name": "Log 1", "file": "/my/folder/1.log", "pattern": ".+ERROR\\s+(\\S+).+"},
	{"name": "Log 2", "file": "/my/folder/2.log", "pattern": ".+ERROR\\s+(\\S+).+"}
])

 */
var nInput_LogErrorAgg = function(anAttributeName, anArrayOfLogsAndPatterns) {
	this.logsandpatterns = anArrayOfLogsAndPatterns;
	this.attributename = anAttributeName;

	nInput.call(this, this.input);
}
inherit(nInput_LogErrorAgg, nInput);

nInput_LogErrorAgg.prototype.input = function(scope, args) {
	var ret = [];
	var attr = {};
	var errors = {};

	for(var i in this.logsandpatterns) {
		var item = this.logsandpatterns[i];

		try {
			var lines = af.readFileAsArray(item.file);

			for(var j in lines) {
				var line = lines[j];

				try {
					var error = line.match(new RegExp(item.pattern));
					if (error != null) {
						if (isUndefined(errors[error[1]]))
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

	attr[this.attributename] = errors;
	return attr;
}
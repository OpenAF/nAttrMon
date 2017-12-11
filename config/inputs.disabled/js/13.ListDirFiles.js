nattrmon.addInput(
{ 	"name": "Directory Name",
	"timeInterval": 1000,
	"waitForFinish": true,
	"onlyOnEvent": true
},
new nInput(function(scope, args) {
    var ret = {};
    ret["Directory Name"] = $from(io.listFiles("/path/to/dir").files).equals("isFile", true).select(function(r)
    {
        return { "filename": r.filename,
				 "size": ow.format.toBytesAbbreviation(r.size),
				 "lastModified": ow.format.timeago(new Date(r.lastModified))
				}
	});

    return ret;
}));
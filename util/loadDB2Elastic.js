let ELASTICSEARCH_URL  = "http://127.0.0.1:9200";
let ELASTICSEARCH_USER = "elastic";
let ELASTICSEARCH_PASS = "changeme";
let JDBC_URL           = "jdbc:h2:d:/databaseFile";
let JDBC_USER          = "nattrmon";
let JDBC_PASS          = "nattrmon";
let BUFFER_SIZE        = 5000;
let CH                 = "ES";

log("init");
ow.loadFormat();
loadLib("elasticsearch.js");

var es = new ElasticSearch(ELASTICSEARCH_URL, ELASTICSEARCH_USER, ELASTICSEARCH_PASS);
es.createCh(CH);

var db = new DB("org.h2.Driver", JDBC_URL, JDBC_USER, JDBC_PASS);
var rs = db.qsRS("select * from attribute_values", []);

var c = 0; 
var d = 0;
var data = [];
while(rs.next()) {
	var obj;
	var val = jsonParse(rs.getString("VAL"));

	obj = {
		name        : String(rs.getString("NAME")).replace(/[\/ ]/g, "_"),
		dateModified: ow.format.toDate(rs.getString("DATE_MODIFIED"), 'yyyy-MM-dd HH:mm:ss.SSS'),
		dateChecked : ow.format.toDate(rs.getString("DATE_CHECKED"), 'yyyy-MM-dd HH:mm:ss.SSS')
	}

	try {
		if (isArray(val)) {
			for(var i in val) {
				obj.id = sha1(obj.name + obj.dateModified + i);
				obj[obj.name] = val[i];
				traverse(obj, function(k, v, p, o) {
					if (v == null || v == "n/a") { 
						delete o[k];
					} else {
						if (k.match(/[\/ ]/)) {
							o[k.replace(/[\/ ]/g, "_")] = o[k];
							delete o[k];
						}
					}
				});
				data.push(clone(obj));
				c++; d++;
			}
		} else {
			obj.id = sha1(obj.name + obj.dateModified);
			obj[obj.name] = val;
			traverse(obj, function(k, v, p, o) {
				if (v == null) { 
					delete o[k];
				} else {
					if (k.match(/[\/ ]/)) {
						o[k.replace(/[\/ ]/g, "_")] = o[k];
						delete o[k];
					}
				}
			});
			data.push(clone(obj));
			c++; d++;
		}
	} catch(e) {
		logErr(e + " - " + stringify(obj));
	}

	if (d > 5000) {
		printnl(ow.loadFormat().addNumberSeparator(c) + " records\r");
		$ch(CH).setAll(["id"], clone(data));
		data = [];
		d = 0;
	}
}

$ch(CH).setAll(["id"], clone(data));
log("Loaded " + ow.loadFormat().addNumberSeparator(c) + " records");
rs.close();

log("done");
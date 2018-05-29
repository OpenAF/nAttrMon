// Setting up logging
//
$ch("__es").create(void 0, "elasticsearch", {
    url  : "http://127.0.0.1:9200",
    //user : "myuser",
    //pass : "mypass",
    idKey: "id",
    index: ow.ch.utils.getElasticIndex("nattrmon-logs","yyyy.MM.dd") //Check getElasticIndex function, If a specific format is needed you can provide it as aFormat (see ow.format.fromDate)"
 });
 
 // Setting all nAttrmon logging to elastic
 var esSubs = ow.ch.utils.getLogStashSubscriber("__es", "stdin", "nattrmon", function(e) { sprintErr(e); }, void 0, { region: "US" });
 $ch("__log").subscribe(esSubs);

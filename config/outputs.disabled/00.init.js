// FILL HERE BEGIN -----------------------------------------------
var NATTRMON_HTTP_PORT   = 8090;
var NATTRMON_HTTP_PERIOD = 1000;
var NATTRMON_HTTP_TITLE  = "Some example";
// FILL HERE END -------------------------------------------------

plugin("HTTPServer");
nattrmon.setSessionData("httpd", new HTTPd(NATTRMON_HTTP_PORT));

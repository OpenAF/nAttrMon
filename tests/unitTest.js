load("nattrmonTester.js");
let NATTRMON_SERVER_IP = "1.2.3.4";
let NATTRMON_CHS_PORT  = "17878";

// INITs
// -----
var nattrmon = new nAttrMon("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT);

//$ch("pres").createRemote("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "/chs/pres");
//$ch("pros").createRemote("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "/chs/pros");
//$ch("ldap").createRemote("http://nattrmon:nattrmon@" + NATTRMON_SERVER_IP + ":" + NATTRMON_CHS_PORT + "/chs/ldap");

// TEST VALIDATIONS
// ================

/*
// Validation function
// ------------------------------------------
var v = new nValidation(function(warns, scope, args) {
    var ret = [];

    var vals = scope.getCurrentValues();
    
    // ...

    ret.push(new nWarning(nWarning.LEVEL_HIGH, aTitle, aDescription));

    // ...

    this.closeWarning(aTitle);

	// ...

    return ret;
});

// ------------------------------------------
v.exec(nattrmon, {});

// Validation output
sprint(nattrmon.getWarnings());
*/

// TEST INPUTS
// ===========

// Input function
// --------------
// nattrmon.addObjectPool("DAT", ow.obj.pool.DB("jdbc:oracle:thin:@1.2.3.4:1521:abc", "USER", "PASS"));

// var i = new nInput(function(scope, args) {
// 	var ret = {};

// 	// ....
	
//     return ret;
// });

// sprint(i.exec(nattrmon, {}));


// TEST OUTPUTS
// ============

// Output function
// ---------------

// var o = new nOutput(function(scope, args, meta) {
//    var vals  = scope.getCurrentValues();
//    var warns = scope.getWarnings();
//    // ....
// });
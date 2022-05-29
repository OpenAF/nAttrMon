/** 
 * Author: Surya Kalyan Jaddu
 * 
 * <odoc>
 * <key>nAttrmon.nOutput_SNMPServer(aMap)</key>
 * Provide some explanation of the objective of your output object.\
 * On aMap expects:\
 *    - snmpAddress(string) IpAddress of snmp server.\
 *    - baseOID((string) Base Oid is used to send traps.\
 *    - snmpVersion(string) it defines version of SNMP server.\
 *    - oidMapping(Map) it contains keys mapped with OID values to send traps.\
 *
 * </odoc>
 */

var nOutput_SNMPServer = function (aMap) {

    plugin("SNMP");
    if (isUnDef(aMap) || !isObject(aMap)) aMap = {}

    snmpAddress = _$(aMap.snmpAddress, "var aMap.snmpAddress").regexp(/^udp:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\/[0-9]{3}/).default("something")
    snmpEngineID = _$(aMap.snmpEngineID, "var aMap.snmpEngineID").isString().regexp(/[0-9]{1,18}/).default("something")
    baseOID = _$(aMap.baseOID, "var aMap.baseOID").isString().regexp(/([0-9]{1,4}\.)/).$_("something")
    snmpVersion = _$(aMap.snmpVersion, "snmpVersion").oneOf([1, 2, 3]).isNumber().default(2)
    oidMapping = _$(aMap.oidMapping, "oidMapping").isObject().$_("Please Map the oid's")

    snmpAuthPassPhrase = _$(aMap.snmpAuthPassPhrase, "snmpAuthPassPhrase").isString().$_("Please provide snmpAuthPhrase")
    snmpPrivPassPhrase = _$(aMap.snmpPrivPassPhrase, "snmpPrivPassPhrase").isString().$_("Please Provoide snmpPrivPassPhrase")

    if (isUnDef(aMap.snmpCommunity) || aMap.snmpCommunity === null) aMap.snmpCommunity = "MD5";
    if (isUnDef(aMap.snmpAuthProtocol) || aMap.snmpAuthProtocol === null) aMap.snmpAuthProtocol = "MD5";
    if (isUnDef(aMap.snmpPrivProtocol) || aMap.snmpPrivProtocol === null) aMap.snmpPrivProtocol = "AES128";
    if (isUnDef(aMap.snmpSecurityName) || aMap.snmpSecurityName === null) aMap.snmpSecurityName = "NMS";
    if (isUnDef(aMap.timeOut) || aMap.timeOut === null) aMap.timeOut = 5000;
    if (isUnDef(aMap.numOfRetries) || aMap.timeOut === null) aMap.numOfRetries = 3;

    this.IDMapping = aMap.oidMapping
    this.params = {
        "snmpIPAddress": snmpAddress,
        "snmpCommunity": aMap.snmpCommunity,
        "snmpTimeout": aMap.timeOut,
        "numOfRetries": aMap.numOfRetries,
        "snmpVersion": snmpVersion,
        "snmpEngineID": snmpEngineID,
        "snmpBaseOID": baseOID
    }

    this.snmpProtocols = {
        "engineId": snmpEngineID,
        "authPassphrase": snmpAuthPassPhrase,
        "privPassphrase": aMap.nmpPrivPassPhrase,
        "authProtocol": aMap.snmpAuthProtocol,
        "privProtocol": aMap.snmpPrivProtocol,
        "securityName": aMap.snmpSecurityName
    }

    nOutput.call(this, this.output);
};

inherit(nOutput_SNMPServer, nOutput);


nOutput_SNMPServer.prototype.typeCasting = function (value) {
    try {
        if (isNumber(value)) {
            if (value > -2147483648 && value > 2147483647) response = { "type": "s", "value": String(value) }; else response = { "type": "i", "value": Number(value) };
            return response
        }
        if (isString(value)) {
            response = { "type": "s", "value": String(value) }
            return response
        }
    } catch (e) {
        logErr(e)
    }
}

nOutput_SNMPServer.prototype.stringMapping = function (nAttrbuteName, nAttrNameValues, IDMapping, args) {

    try {
        sMap = {}
        response = this.typeCasting(nAttrNameValues)
        sMap[nAttrbuteName] = { "OID": IDMapping[nAttrbuteName], "value": nAttrNameValues }
        return {
            "mapping": sMap,
            "trapArr": [{ "OID": IDMapping[nAttrbuteName], "type": response.type, "value": response.value }]
        }
    } catch (e) {
        logErr(e)
    }
}

nOutput_SNMPServer.prototype.arrayMapping = function (flag, nAttrbuteName, nAttrNameValues, IDMapping, args) {
    try {
        oIDMapping = {}
        trapArr = []
        nAttrValueKeys = Object.keys(nAttrNameValues)
        index = 0
        while (index < nAttrValueKeys.length) {
            var response = this.typeCasting(nAttrNameValues[nAttrValueKeys[index]])
            if (!(flag)) {
                userDefKeys = Object.keys(IDMapping[nAttrbuteName])
                if (userDefKeys.includes(nAttrValueKeys[index])) {
                    oIDMapping[nAttrValueKeys[index]] = {
                        "OID": IDMapping[nAttrbuteName][nAttrValueKeys[index]],
                        "value": nAttrNameValues[nAttrValueKeys[index]]
                    }
                    trapArr.push({
                        "OID": IDMapping[nAttrbuteName][nAttrValueKeys[index]],
                        "type": response.type,
                        "value": response.value
                    })
                }
            }
            if (flag) {
                if (isNumber(nAttrNameValues[nAttrValueKeys[index]])) var type = "i"; else var type = "s";
                oIDMapping[nAttrValueKeys[index]] = { "OID": IDMapping[nAttrbuteName], "value": nAttrNameValues[nAttrValueKeys[index]] }
                trapArr.push({ "OID": IDMapping[nAttrbuteName], "type": response.type, "value": response.value })
            }
            index++
        }
        return { "mapping": oIDMapping, "trapArr": trapArr }
    } catch (e) {
        logErr(e)
    }
}

nOutput_SNMPServer.prototype.entitiesExtraction = function (args, IDMapping) {

    try {
        var userDefnAttrbuteNames = Object.keys(IDMapping)
        var nAttrbuteName = args.name
        if (userDefnAttrbuteNames.includes(nAttrbuteName)) {
            var nAttrNameValues = args.val
            if (isArray(nAttrNameValues)) {

                if (!(isObject(IDMapping[nAttrbuteName]))) var flag = true; else var flag = false;
                var response = this.arrayMapping(flag, nAttrbuteName, nAttrNameValues[0], IDMapping, args)
                return response
            }

            if (isMap(nAttrNameValues)) {

                if (!(isObject(IDMapping[nAttrbuteName]))) var flag = true; else var flag = false;
                var response = this.arrayMapping(flag, nAttrbuteName, nAttrNameValues, IDMapping, args)
                return response
            }

            if (isString(nAttrNameValues) || isNumber(nAttrNameValues || isBoolean(nAttrNameValues))) {

                var response = this.stringMapping(nAttrbuteName, nAttrNameValues, IDMapping, args)
                return response
            }
        }
    } catch (e) {
        logErr(e)
    };
}



nOutput_SNMPServer.prototype.sendTrap = function (argsValue, params, snmpProtocols, IDMapping) {

    try {
        if (params.snmpVersion <= 2) var snmp = new SNMP(params.snmpIPAddress, params.snmpCommunity); else var snmp = new SNMP(params.snmpIPAddress, params.snmpCommunity, params.snmpTimeout, params.numOfRetries, params.snmpVersion, snmpProtocols);
        var response = this.entitiesExtraction(argsValue, IDMapping)
        log(stringify(response.trapArr))
        snmp.trap(params.snmpBaseOID, response.trapArr)
        log("Trap Sent Successfully")
    }
    catch (e) {
        if (isJavaException(e)) logErr(e.javaException.printStackTrace()); else (logErr(e));
    }
};



nOutput_SNMPServer.prototype.output = function (scope, args) {

    if (args.op != "setall" && args.op != "set") return;
    if (args.op == "setall" && !this.considerSetAll) return;

    var k, v, ch = args.ch;
    if (args.op == "set") {
        k = [args.k];
        v = [args.v];
    } else {
        k = args.k;
        v = args.v;

    }
    v.forEach(value => {
        var isok = isDef(this.include) ? false : true;
        var isWarns = (ch == "nattrmon::warnings" || ch == "nattrmon::warnings::buffer");
        var kk = (isWarns) ? value.title : value.name;
        if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0;
        if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0;
        if (isok) {
            if (isArray(v)) argsValue = v[0]; else argsValue = v
            mappingObject = this.sendTrap(argsValue, this.params, this.snmpProtocols, this.IDMapping)
        }
    });
};






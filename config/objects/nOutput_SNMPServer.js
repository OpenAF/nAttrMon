/** 
 * Author: Surya Kalyan Jaddu 
 * Changes: Andreia Brizida
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
    var vstep_aux = 'nOutput_SNMPServer.function ';
    var vstep = vstep_aux + "<1>";
    try {
        vstep = vstep_aux + "<2>";
        plugin("SNMP");
        vstep = vstep_aux + "<3>";
        if (isUnDef(aMap) || !isObject(aMap)) aMap = {}

        vstep = vstep_aux + "<4>";
        if (isUnDef(aMap.enabled) || aMap.enabled === null) aMap.enabled = true;

        vstep = vstep_aux + "<5>";
        if (aMap.enabled == true) { 
            vstep = vstep_aux + "<6>";
            this.enabled = true
            vstep = vstep_aux + "<7>";
            snmpAddress = _$(aMap.snmpAddress, "var aMap.snmpAddress").regexp(/^udp:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\/[0-9]{3}/).default("something")
            vstep = vstep_aux + "<8>";
            snmpEngineID = _$(aMap.snmpEngineID, "var aMap.snmpEngineID").isString().regexp(/[0-9]{1,18}/).default("something")
            vstep = vstep_aux + "<9>";
            baseOID = _$(aMap.baseOID, "var aMap.baseOID").isString().regexp(/([0-9]{1,4}\.)/).$_("Please provide a base OID")
            vstep = vstep_aux + "<10>";
            snmpVersion = _$(aMap.snmpVersion, "snmpVersion").oneOf([1, 2, 3]).isNumber().default(2)
            vstep = vstep_aux + "<11>";
            oidMapping = _$(aMap.oidMapping, "oidMapping").isObject().$_("Please Map the oid's")
            vstep = vstep_aux + "<12>";
            
            snmpAuthPassPhrase = null
            snmpPrivPassPhrase = null

            vstep = vstep_aux + "<13.0>";
            if (snmpVersion == 3) 
            {
                vstep = vstep_aux + "<13>";
                snmpAuthPassPhrase = _$(aMap.snmpAuthPassPhrase, "snmpAuthPassPhrase").isString().$_("Please provide snmpAuthPhrase")
                vstep = vstep_aux + "<14>";
                snmpPrivPassPhrase = _$(aMap.snmpPrivPassPhrase, "snmpPrivPassPhrase").isString().$_("Please provide snmpPrivPassPhrase")
                vstep = vstep_aux + "<15>";
            }
            else 
            {
                vstep = vstep_aux + "<16>";
                if (isDef(aMap.snmpAuthPassPhrase) && isDef(aMap.snmpPrivPassPhrase))
                {
                    vstep = vstep_aux + "<17>";
                    snmpAuthPassPhrase = aMap.snmpAuthPassPhrase
                    snmpPrivPassPhrase = aMap.snmpPrivPassPhrase
                    vstep = vstep_aux + "<18>";
                }
            }

            vstep = vstep_aux + "<19>";
            if (isUnDef(aMap.snmpCommunity) || aMap.snmpCommunity === null) aMap.snmpCommunity = "MD5";
            if (isUnDef(aMap.snmpAuthProtocol) || aMap.snmpAuthProtocol === null) aMap.snmpAuthProtocol = "MD5";
            if (isUnDef(aMap.snmpPrivProtocol) || aMap.snmpPrivProtocol === null) aMap.snmpPrivProtocol = "AES128";
            if (isUnDef(aMap.snmpSecurityName) || aMap.snmpSecurityName === null) aMap.snmpSecurityName = "NMS";
            if (isUnDef(aMap.timeOut) || aMap.timeOut === null) aMap.timeOut = 5000;
            if (isUnDef(aMap.numOfRetries) || aMap.timeOut === null) aMap.numOfRetries = 3;
            vstep = vstep_aux + "<20>";

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
            vstep = vstep_aux + "<21>";

            this.snmpProtocols = {
                "engineId": String(snmpEngineID),
                "authPassphrase": String(snmpAuthPassPhrase),
                "privPassphrase": String(snmpPrivPassPhrase),
                "authProtocol": String(aMap.snmpAuthProtocol),
                "privProtocol": String(aMap.snmpPrivProtocol),
                "securityName": String(aMap.snmpSecurityName)
            }
        }
        else this.enabled = false;
        vstep = vstep_aux + "<22>";

        nOutput.call(this, this.output);
        vstep = vstep_aux + "<23>";
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
};

inherit(nOutput_SNMPServer, nOutput);


nOutput_SNMPServer.prototype.typeCasting = function (value) {
    var vstep_aux = 'nOutput_SNMPServer.typeCasting ';
    var vstep = vstep_aux + "<1>";
    try {
        if (isNumber(value)) {
            vstep = vstep_aux + "<1>";
            if (value > -2147483648 && value > 2147483647) response = { "type": "s", "value": String(value) }; else response = { "type": "i", "value": Number(value) };
            vstep = vstep_aux + "<2>";
            return response
        }
        if (isString(value)) {
            vstep = vstep_aux + "<3>";
            response = { "type": "s", "value": String(value) }
            vstep = vstep_aux + "<4>";
            return response
        }
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
}

nOutput_SNMPServer.prototype.stringMapping = function (nAttrbuteName, nAttrNameValues, IDMapping, args) {
    var vstep_aux = 'nOutput_SNMPServer.stringMapping ';
    var vstep = vstep_aux + "<1>";

    try {
        sMap = {}
        vstep = vstep_aux + "<2>";
        response = this.typeCasting(nAttrNameValues)
        vstep = vstep_aux + "<3>";
        sMap[nAttrbuteName] = { "OID": IDMapping[nAttrbuteName], "value": nAttrNameValues }
        vstep = vstep_aux + "<4>";
        return {
            "mapping": sMap,
            "trapArr": [{ "OID": IDMapping[nAttrbuteName], "type": response.type, "value": response.value }]
        }
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
}

nOutput_SNMPServer.prototype.arrayMapping = function (flag, nAttrbuteName, nAttrNameValues, IDMapping, args) {
    var vstep_aux = 'nOutput_SNMPServer.arrayMapping ';
    var vstep = vstep_aux + "<1>";
    try {
        oIDMapping = {}
        trapArr = []
        vstep = vstep_aux + "<1>";
        nAttrValueKeys = Object.keys(nAttrNameValues)
        index = 0
        while (index < nAttrValueKeys.length) {
            vstep = vstep_aux + "<2>";
            var response = this.typeCasting(nAttrNameValues[nAttrValueKeys[index]])
            vstep = vstep_aux + "<3>";
            if (!(flag)) {
                vstep = vstep_aux + "<4>";
                userDefKeys = Object.keys(IDMapping[nAttrbuteName])
                vstep = vstep_aux + "<5>";
                if (userDefKeys.includes(nAttrValueKeys[index])) {
                    vstep = vstep_aux + "<6>";
                    oIDMapping[nAttrValueKeys[index]] = {
                        "OID": IDMapping[nAttrbuteName][nAttrValueKeys[index]],
                        "value": nAttrNameValues[nAttrValueKeys[index]]
                    }
                    vstep = vstep_aux + "<7>";
                    trapArr.push({
                        "OID": IDMapping[nAttrbuteName][nAttrValueKeys[index]],
                        "type": response.type,
                        "value": response.value
                    })
                    vstep = vstep_aux + "<8>";
                }
            }
            vstep = vstep_aux + "<9>";
            if (flag) {
                if (isNumber(nAttrNameValues[nAttrValueKeys[index]])) var type = "i"; else var type = "s";
                vstep = vstep_aux + "<10>";
                oIDMapping[nAttrValueKeys[index]] = { "OID": IDMapping[nAttrbuteName], "value": nAttrNameValues[nAttrValueKeys[index]] }
                vstep = vstep_aux + "<11>";
                trapArr.push({ "OID": IDMapping[nAttrbuteName], "type": response.type, "value": response.value })
                vstep = vstep_aux + "<12>";
            }
            vstep = vstep_aux + "<13>";
            index++
        }
        vstep = vstep_aux + "<14>";
        return { "mapping": oIDMapping, "trapArr": trapArr }
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
}

nOutput_SNMPServer.prototype.entitiesExtraction = function (args, IDMapping) {
    var vstep_aux = 'nOutput_SNMPServer.entitiesExtraction ';
    var vstep = vstep_aux + "<1>";
    var response = {};
    try {
        vstep = vstep_aux + "<2>";
        var userDefnAttrbuteNames = Object.keys(IDMapping)
        vstep = vstep_aux + "<3>";
        var nAttrbuteName = (isDefined(args.name))?args.name:args.title
        vstep = vstep_aux + "<4>";
        if (userDefnAttrbuteNames.includes(nAttrbuteName)) {
            vstep = vstep_aux + "<5>";
            var nAttrNameValues = (isDefined(args.val))?args.val:args.description
            vstep = vstep_aux + "<6>";
            if (isArray(nAttrNameValues)) {

                vstep = vstep_aux + "<7>";
                if (!(isObject(IDMapping[nAttrbuteName]))) var flag = true; else var flag = false;
                vstep = vstep_aux + "<8>";
                var response = this.arrayMapping(flag, nAttrbuteName, nAttrNameValues[0], IDMapping, args)
                vstep = vstep_aux + "<9>";
                return response
            }

            vstep = vstep_aux + "<10>";
            if (isMap(nAttrNameValues)) {

                vstep = vstep_aux + "<11>";
                if (!(isObject(IDMapping[nAttrbuteName]))) var flag = true; else var flag = false;
                vstep = vstep_aux + "<12>";
                var response = this.arrayMapping(flag, nAttrbuteName, nAttrNameValues, IDMapping, args)
                vstep = vstep_aux + "<13>";
                return response
            }

            vstep = vstep_aux + "<14>";
            if (isString(nAttrNameValues) || isNumber(nAttrNameValues || isBoolean(nAttrNameValues))) {
                vstep = vstep_aux + "<15>";

                var response = this.stringMapping(nAttrbuteName, nAttrNameValues, IDMapping, args)
                vstep = vstep_aux + "<16>";
                return response
            }
        }
        return response;
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    };
}

nOutput_SNMPServer.prototype.sendTrap = function (argsValue, params, snmpProtocols, IDMapping, sysUpTime) {
    var vstep_aux = 'nOutput_SNMPServer.sendTrap ';
    var vstep = vstep_aux + "<1>";

    try {
        vstep = vstep_aux + "<2>";     
        var response = this.entitiesExtraction(argsValue, IDMapping);
        
        vstep = vstep_aux + "<3>";
        if(isDefined(response.trapArr)) 
        {
            if (params.snmpVersion <= 2) var snmp = new SNMP(params.snmpIPAddress, params.snmpCommunity); else var snmp = new SNMP(params.snmpIPAddress, params.snmpCommunity, params.snmpTimeout, params.numOfRetries, params.snmpVersion, snmpProtocols);
            vstep = vstep_aux + "<4>";
            if (getVersion() > "20231221") {            
                vstep = vstep_aux + "<5>";
                snmp.trap(params.snmpBaseOID, sysUpTime, response.trapArr, {})
                vstep = vstep_aux + "<6>";
            } else {
                logWarn("nOutput_SNMPServer | sysUpTime functionality is not available on the current version " + getVersion() + ". Please upgrade to a more recent version.")
                snmp.trap(params.snmpBaseOID, response.trapArr, {})
                vstep = vstep_aux + "<7>";
            }
            log("nOutput_SNMPServer - Trap Sent Successfully: response.trapArr > " + stringify(response.trapArr))
        }
    }
    catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
        logErr("Params in step "+ vstep + ":: argsValue: " + stringify(argsValue))
        logErr("Params in step "+ vstep + ":: params: " + stringify(params))
        logErr("Params in step "+ vstep + ":: snmpProtocols: " + stringify(snmpProtocols))
        logErr("Params in step "+ vstep + ":: IDMapping: " + stringify(IDMapping))
        logErr("Params in step "+ vstep + ":: sysUpTime: " + stringify(sysUpTime))
    }
};



nOutput_SNMPServer.prototype.output = function (scope, args) {
    var vstep_aux = 'nOutput_SNMPServer.output ';
    var vstep = vstep_aux + "<1>";
    try 
    {        
        var vstep = vstep_aux + "<2>";
        if (this.enabled == false) return;
        var vstep = vstep_aux + "<3>";

        if (args.op != "setall" && args.op != "set") return;
        if (args.op == "setall" && !this.considerSetAll) return;
        var vstep = vstep_aux + "<4>";

        var k, v, ch = args.ch;
        if (args.op == "set") {
            k = [args.k];
            v = [args.v];
        } else {
            k = args.k;
            v = args.v;

        }
        var vstep = vstep_aux + "<5>";
        v.forEach(value => {
            var vstep = vstep_aux + "<6>";
            var isok = isDef(this.include) ? false : true;
            var isWarns = (ch == "nattrmon::warnings" || ch == "nattrmon::warnings::buffer");
            var kk = (isWarns) ? value.title : value.name;
            var vstep = vstep_aux + "<7>";
            
            if (isDef(this.include)) isok = this.include.filter(inc => kk.match(inc)).length > 0;
            if (isDef(this.exclude)) isok = this.exclude.filter(exc => kk.match(exc)).length <= 0;
            var vstep = vstep_aux + "<8>";
            if (isok) {
                if (isArray(v)) argsValue = v[0]; else argsValue = v
                var diff_now = 0
                var vstep = vstep_aux + "<9>";
                if (isWarns) {
                    var now_date = new Date();
                    diff_now = now_date - value.lastupdate;
                }
                var vstep = vstep_aux + "<10>";
                mappingObject = this.sendTrap(argsValue, this.params, this.snmpProtocols, this.IDMapping, diff_now)
                var vstep = vstep_aux + "<11>";
            }
        });
    }
    catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
};






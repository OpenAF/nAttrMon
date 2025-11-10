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
    var vstep = 'nOutput_SNMPServer.function ';
    try {
        plugin("SNMP");
        if (isUnDef(aMap) || !isObject(aMap)) aMap = {}

        if (isUnDef(aMap.enabled) || aMap.enabled === null) aMap.enabled = true;

        if (aMap.enabled == true) { 
            this.enabled = true
            snmpAddress = _$(aMap.snmpAddress, "var aMap.snmpAddress").regexp(/^udp:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\/[0-9]{3}/).default("something")            
            snmpEngineID = _$(aMap.snmpEngineID, "var aMap.snmpEngineID").isString().regexp(/[0-9a-zA-Z]{1,18}/).default("something")            
            baseOID = _$(aMap.baseOID, "var aMap.baseOID").isString().regexp(/^([0-9]{1,4}\.)+[0-9]{1,4}$/).$_("Please provide a base OID")            
            snmpVersion = _$(aMap.snmpVersion, "snmpVersion").oneOf([1, 2, 3]).isNumber().default(2)
            oidMapping = _$(aMap.oidMapping, "oidMapping").isObject().$_("Please Map the oid's")
            
            
            snmpAuthPassPhrase = null
            snmpPrivPassPhrase = null

            if (snmpVersion == 3) 
            {
                snmpAuthPassPhrase = _$(aMap.snmpAuthPassPhrase, "snmpAuthPassPhrase").isString().$_("Please provide snmpAuthPhrase")
                snmpPrivPassPhrase = _$(aMap.snmpPrivPassPhrase, "snmpPrivPassPhrase").isString().$_("Please provide snmpPrivPassPhrase")
            }
            else 
            {
                if (isDef(aMap.snmpAuthPassPhrase) && isDef(aMap.snmpPrivPassPhrase))
                {
                    snmpAuthPassPhrase = aMap.snmpAuthPassPhrase
                    snmpPrivPassPhrase = aMap.snmpPrivPassPhrase
                }
            }

            if (isUnDef(aMap.snmpCommunity) || aMap.snmpCommunity === null) {
                throw new Error("SNMP community string must be explicitly set in aMap.snmpCommunity for security reasons.");
            }
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
                "engineId": String(snmpEngineID),
                "authPassphrase": String(snmpAuthPassPhrase),
                "privPassphrase": String(snmpPrivPassPhrase),
                "authProtocol": String(aMap.snmpAuthProtocol),
                "privProtocol": String(aMap.snmpPrivProtocol),
                "securityName": String(aMap.snmpSecurityName)
            }
        }
        else this.enabled = false;

        nOutput.call(this, this.output);
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
};

inherit(nOutput_SNMPServer, nOutput);


nOutput_SNMPServer.prototype.typeCasting = function (value) {
    var vstep = 'nOutput_SNMPServer.typeCasting ';
    try {
        var response;
        if (isNumber(value)) {
            if (value < -2147483648 || value > 2147483647) response = { "type": "s", "value": String(value) }; else response = { "type": "i", "value": Number(value) };
            return response
        }
        if (isString(value)) {
            response = { "type": "s", "value": String(value) }
            return response
        }
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
}

nOutput_SNMPServer.prototype.stringMapping = function (nAttrbuteName, nAttrNameValues, IDMapping, args) {
    var vstep = 'nOutput_SNMPServer.stringMapping ';

    try {
        sMap = {}
        var trapArr = []
        if(isDefined(IDMapping[nAttrbuteName]["OIDList"]) && isArray(IDMapping[nAttrbuteName]["OIDList"]))
        {
            ow.loadTemplate()
            ow.loadTemplate().addOpenAFHelpers()
            ow.loadTemplate().addFormatHelpers()           

            trapArr = IDMapping[nAttrbuteName]["OIDList"];
            trapArr = $from(trapArr).select(a => ({OID: a.OID, type: a.type, value: templify(a.value, args)}))            
        }
        response = this.typeCasting(nAttrNameValues)
        sMap[nAttrbuteName] = { "OID": IDMapping[nAttrbuteName]["OID"], "value": nAttrNameValues }
        trapArr.push({ "OID": IDMapping[nAttrbuteName]["OID"], "type": response.type, "value": response.value })
        return {
            "mapping": sMap,
            "trapArr": trapArr
        }
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
}

nOutput_SNMPServer.prototype.arrayMapping = function (flag, nAttrbuteName, nAttrNameValues, IDMapping, args) {
    var vstep = 'nOutput_SNMPServer.arrayMapping ';
    try {
        oIDMapping = {}
        var trapArr = []
        if(isDefined(IDMapping[nAttrbuteName]["OIDList"]) && isArray(IDMapping[nAttrbuteName]["OIDList"])) 
        {
            ow.loadTemplate()
            ow.loadTemplate().addOpenAFHelpers()
            ow.loadTemplate().addFormatHelpers()           

            trapArr = IDMapping[nAttrbuteName]["OIDList"];
            trapArr = $from(trapArr).select(a => ({OID: a.OID, type: a.type, value: templify(a.value, args)}))
        }
        nAttrValueKeys = Object.keys(nAttrNameValues)
        index = 0
        while (index < nAttrValueKeys.length) {
            var response = this.typeCasting(nAttrNameValues[nAttrValueKeys[index]])
            if (!(flag)) {
                userDefKeys = Object.keys(IDMapping[nAttrbuteName]["OID"])
                if (userDefKeys.includes(nAttrValueKeys[index])) {
                    oIDMapping[nAttrValueKeys[index]] = {
                        "OID": IDMapping[nAttrbuteName]["OID"][nAttrValueKeys[index]],
                        "value": nAttrNameValues[nAttrValueKeys[index]]
                    }
                    trapArr.push({
                        "OID": IDMapping[nAttrbuteName]["OID"][nAttrValueKeys[index]],
                        "type": response.type,
                        "value": response.value
                    })
                }
            }
            if (flag) {
                oIDMapping[nAttrValueKeys[index]] = { "OID": IDMapping[nAttrbuteName]["OID"], "value": nAttrNameValues[nAttrValueKeys[index]] }
                trapArr.push({ "OID": IDMapping[nAttrbuteName]["OID"], "type": response.type, "value": response.value })
            }
            index++
        }
        return { "mapping": oIDMapping, "trapArr": trapArr }
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
}

nOutput_SNMPServer.prototype.entitiesExtraction = function (args, IDMapping) {
    var vstep = 'nOutput_SNMPServer.entitiesExtraction ';
    var response = {};
    try {
        var userDefnAttrbuteNames = Object.keys(IDMapping)
        var nAttrbuteName = (isDefined(args.name))?args.name:args.title
        
        //if (userDefnAttrbuteNames.includes(nAttrbuteName) 
        // Test if the current Attribute Name meets any regular expression from the OIDMapping        
        if (userDefnAttrbuteNames.filter(inc => nAttrbuteName.match(inc)).length > 0) 
        {
            var nAttrbuteRegex = userDefnAttrbuteNames.filter(inc => nAttrbuteName.match(inc))[0];

            var nAttrNameValues = (isDefined(args.val))?args.val:args.description

            if (!isDefined(IDMapping[nAttrbuteRegex]["OID"])) {
                throw (vstep + ":: oidMapping needs the field OID when mapping the OID for a specific attribute! IDMapping for entry " + nAttrbuteName + " is " + stringify(IDMapping[nAttrbuteRegex]) + " and OID field is missing! Please populate it!");
            }

            var flag = false;
            if (!(isObject(IDMapping[nAttrbuteRegex]["OID"]))) flag = true;

            if (isArray(nAttrNameValues)) {
                
                var response = this.arrayMapping(flag, nAttrbuteRegex, nAttrNameValues[0], IDMapping, args)
                
                return response
            }
            if (isMap(nAttrNameValues)) {

                var response = this.arrayMapping(flag, nAttrbuteRegex, nAttrNameValues, IDMapping, args)

                return response
            }

            if (isString(nAttrNameValues) || isNumber(nAttrNameValues || isBoolean(nAttrNameValues))) {

                var response = this.stringMapping(nAttrbuteRegex, nAttrNameValues, IDMapping, args)
                return response
            }
        }
        return response;
    } catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e)); throw "Error";
    };
}

nOutput_SNMPServer.prototype.sendTrap = function (argsValue, params, snmpProtocols, IDMapping, sysUpTime) {
    var vstep = 'nOutput_SNMPServer.sendTrap ';

    try {
        var response = this.entitiesExtraction(argsValue, IDMapping);
        if(isDefined(response.trapArr)) 
        {
            if (params.snmpVersion <= 2) var snmp = new SNMP(params.snmpIPAddress, params.snmpCommunity); else var snmp = new SNMP(params.snmpIPAddress, params.snmpCommunity, params.snmpTimeout, params.numOfRetries, params.snmpVersion, snmpProtocols);
            if (getVersion() > "20231221") {
                response.trapArr = response.trapArr.map(e => ({"OID": String(e.OID), "type": String(e.type), "value": (String(e.type) == "i" || String(e.type) == "t")?parseInt(e.value):String(e.value) }));
                snmp.trap(params.snmpBaseOID, sysUpTime, response.trapArr, {})
            } else {
                logWarn("nOutput_SNMPServer | sysUpTime functionality is not available on the current version " + getVersion() + ". Please upgrade to a more recent version.")
                snmp.trap(params.snmpBaseOID, response.trapArr, {})
            }
            log("nOutput_SNMPServer - Trap Sent Successfully: response.trapArr > " + stringify(response.trapArr))
        }
    }
    catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
};



nOutput_SNMPServer.prototype.output = function (scope, args) {
    var vstep = 'nOutput_SNMPServer.output ';
    try 
    {        
        if (this.enabled == false) return;

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
                var diff_now = 0
                if (isWarns) {
                    var now_date = new Date();
                    diff_now = (now_date - value.lastupdate); 
                }
                mappingObject = this.sendTrap(argsValue, this.params, this.snmpProtocols, this.IDMapping, diff_now)
            }
        });
    }
    catch (e) {
        if (isJavaException(e)) logErr("Error in step "+ vstep + ":: Error: " + e.javaException.printStackTrace()); else (logErr("Error in step "+ vstep + ":: Error: " + e));
    }
};






/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_RAIDLookups(aMap)</key>
 * You can create an input to get a list of existing RAID lookups with a map composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - excludeUnloaded (exclude Unloaded lk from output, defaults to false)\ 
 *    - include (array of lookup names to include)\
 *    - exclude (array of lookup names to exclude)\
 *    - includeRE (array of lookup names' reg exp to include)\
 *    - excludeRE (array of lookup names' reg exp to exclude)\
 * \
 * </odoc>
 */
var nInput_RAIDLookups = function(aMap) {
    if (isUnDef(getOPackPath("OpenCli"))) {
        throw "OpenCli opack not installed.";
    }

    if (isUnDef(aMap)) aMap = {};

    // If keys is not an array make it an array.
    if (isUnDef(aMap.keys) && isUnDef(aMap.chKeys)) {
        var e = "nInput_RAIDLookups: You need to provide keys or chKeys";
        logErr(e);
        throw e;
    }

    this.keys = aMap.keys;
    this.chKeys = aMap.chKeys;

    if (!(isArray(aMap.keys))) aMap.keys = [aMap.keys];

    if (isUnDef(aMap.attrTemplate)) {
        aMap.attrTemplate = "RAID/{{key}} lookups";
    }

    this.attrTemplate = aMap.attrTemplate;
    this.include = aMap.include
    this.exclude = aMap.exclude
    this.includeRE = aMap.includeRE
    this.excludeRE = aMap.excludeRE
    
    this.excludeUnloaded = _$(aMap.excludeUnloaded, "excludeUnloaded").isBoolean().default(false);

    ow.loadWAF();
    nInput.call(this, this.input);
};
inherit(nInput_RAIDLookups, nInput);

nInput_RAIDLookups.prototype.input = function(scope, args) {
    var res = {};
    var parent = this;

    if (isDef(this.chKeys)) this.keys = $stream($ch(this.chKeys).getKeys()).map("key").toArray();

    var convertRAIDDates = aRAIDDate => {
       if (isUnDef(aRAIDDate)) return __
       return ow.format.fromWeDoDateToDate(aRAIDDate);
    };

    for (var i in this.keys) {
        var arr = [];
        var aKey = this.keys[i];

        var listOfLKs;
        nattrmon.useObject(aKey, (aAF) => {
          try {
            listOfLKs = ow.waf.dp.listLookups(aAF);

            if (this.excludeUnloaded) {
                listOfLKs = $from(listOfLKs).notEquals("extraMetadata.report.status", "UNLOADED").select(); 
            }

            listOfLKs.forEach(lk => {
                var doIt = true

                // Handle include, exclude, includeRE and excludeRE
                if (isDef(this.include) && isArray(this.include) && this.include.indexOf(lk.shortname) < 0) doIt = false
                if (isDef(this.exclude) && isArray(this.exclude) && this.exclude.indexOf(lk.shortname) >= 0) doIt = false
                if (isDef(this.includeRE) && isArray(this.includeRE)) {
                    doIt = false
                    for(var irei in this.includeRE) {
                        if (lk.shortname.match(this.includeRE[irei])) doIt = true
                    }
                }
                if (isDef(this.excludeRE) && isArray(this.excludeRE)) {
                    doIt = true
                    for(var erei in this.excludeRE) {
                        if (lk.shortname.match(this.excludeRE[erei])) doIt = false
                    }			
                }	

                if (doIt) {
                    try {
                        var elk = ow.waf.dp.getLookup(aAF, lk.shortname);

                        arr.push({
                            Name              : aKey,
                            Lookup            : lk.shortname,
                            Status            : lk.extraMetadata.report.status,
                            InUse             : isDef(elk.resourceInfo) ? elk.resourceInfo.InUse : __,
                            Count             : isDef(elk.resourceInfo) ? elk.resourceInfo.RecordCount : __,
                            LastUsedTime      : isDef(elk.resourceInfo) ? convertRAIDDates(elk.resourceInfo.LastUsedTime) : __,
                            LoadTime          : isDef(elk.resourceInfo) ? convertRAIDDates(elk.resourceInfo.LoadTime) : __,
                            TotalLoadTimeMs   : isDef(elk.resourceInfo) ? elk.resourceInfo.TotalLoadTime : __,
                            LoadedVersion     : isDef(elk.resourceInfo) ? elk.resourceInfo.LoadedLookupVersion : __,
                            IndexMemoryBytes  : isDef(elk.resourceInfo) ? ow.format.fromBytesAbbreviation(elk.resourceInfo.IdxMemoryUsage) : __,
                            ValuesMemoryBytes : isDef(elk.resourceInfo) ? ow.format.fromBytesAbbreviation(elk.resourceInfo.ValMemoryUsage) : __,
                            TotalMemoryBytes  : isDef(elk.resourceInfo) ? ow.format.fromBytesAbbreviation(elk.resourceInfo.TotalMemoryUsage) : __
                            });
                    } catch(lke1) {
                        logErr("nInput_RAIDLookups | " + lk.shortname + " | " + lke1)
                    }
                }
            });
          } catch(e) {
            logErr("nInput_RAIDLookups | " + String(e));
          }
        });

        res[templify(this.attrTemplate, {
            key: aKey
        })] = $from(arr).sort("Name", "Lookup").select();
    }

    return res;
};

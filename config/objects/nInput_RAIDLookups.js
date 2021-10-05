/**
 * Author: Nuno Aguiar
 * <odoc>
 * <key>nattrmon.nInput_RAIDLookups(aMap)</key>
 * You can create an input to get a list of existing RAID lookups with a map composed of:\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
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

    ow.loadWAF();
    nInput.call(this, this.input);
};
inherit(nInput_RAIDLookups, nInput);

nInput_RAIDLookups.prototype.input = function(scope, args) {
    var res = {};
    var parent = this;

    if (isDef(this.chKeys)) this.keys = $stream($ch(this.chKeys).getKeys()).map("key").toArray();

    var convertRAIDDates = aRAIDDate => {
       return ow.format.fromWeDoDateToDate(aRAIDDate);
    };

    for (var i in this.keys) {
        var arr = [];
        var aKey = this.keys[i];

        var listOfLKs;
        nattrmon.useObject(aKey, (aAF) => {
          try {
            listOfLKs = ow.waf.dp.listLookups(aAF);

            listOfLKs.forEach(lk => {
                var elk = ow.waf.dp.getLookup(aAF, lk.shortname);

                arr.push({
                   Name              : aKey,
                   Lookup            : lk.shortname,
                   Status            : lk.extraMetadata.report.status,
                   InUse             : elk.resourceInfo.InUse,
                   Count             : elk.resourceInfo.RecordCount,
                   LastUsedTime      : convertRAIDDates(elk.resourceInfo.LastUsedTime),
                   LoadTime          : convertRAIDDates(elk.resourceInfo.LoadTime),
                   TotalLoadTimeMs   : elk.resourceInfo.TotalLoadTime,
                   LoadedVersion     : elk.resourceInfo.LoadedLookupVersion,
                   IndexMemoryBytes  : ow.format.fromBytesAbbreviation(elk.resourceInfo.IdxMemoryUsage),
                   ValuesMemoryBytes : ow.format.fromBytesAbbreviation(elk.resourceInfo.ValMemoryUsage),
                   TotalMemoryBytes  : ow.format.fromBytesAbbreviation(elk.resourceInfo.TotalMemoryUsage)
                });
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
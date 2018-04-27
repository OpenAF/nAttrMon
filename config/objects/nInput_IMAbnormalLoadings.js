/**
 * <odoc>
 * <key>nattrmon.nInput_IMAbnormalLoadings(aMap) : nInput</key>
 * You can create an input to check for abnormal progress (against a threshold) for a period of time (IM):\
 *    - keys (a key string or an array of keys for an AF object)\
 *    - chKeys (a channel name for the keys of AF objects)\
 *    - attrTemplate (a string template for the name of the attribute)\
 *    - days (number of days to check)\
 *    - defaultThreshold (default number of records to include on the list of abnormal (defaults to <= 0))\
 *    - include (array of block type names or ids to include)
 *    - exclude (array of block type names or ids to exclude)
 * </odoc>
 */
var nInput_IMAbnormalLoadings = function (aMap) {
    this.params = (isDef(aMap) ? aMap : {});

    if (isUnDef(this.params.attrTemplate)) {
        this.params.attrTemplate = "Loadings/{{key}} Abnormal progress";
    }

    if (isUnDef(this.params.days)) this.params.days = 1;
    if (isUnDef(this.params.defaultThreshold)) this.params.defaultThreshold = 0;

    if (isDef(this.params.include) && !isArray(this.params.include)) throw "Include parameter should be an array.";
    if (isDef(this.params.exclude) && !isArray(this.params.exclude)) throw "Exclude parameter should be an array.";

    nInput.call(this, this.input);
};
inherit(nInput_IMAbnormalLoadings, nInput);

nInput_IMAbnormalLoadings.prototype.input = function (scope, args) {
    var res = {};

    if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

    for (var i in this.params.keys) {
        var arRes = [];
        ow.loadObj();

        var blcks;
        var key = this.params.keys[i];

        nattrmon.useObject(key, (aAF) => {
            try {
                var res = aAF.exec("IM.GetBlockTypes");
                blcks = $from(ow.obj.fromObj2Array(res.BlockTypes)).select({
                    Description: "",
                    BlockType: -1
                });
            } catch (e) {
                logErr("Problem obtaining IM block types from " + key);
                throw e;
            }
            return true;
        });

        var dbKey = nattrmon.getAssociatedObjectPool(key, "db.app");
        if (isUnDef(dbKey)) {
            throw "No db.app object pool associated with " + key;
        }
        var ims = [];

        nattrmon.useObject(dbKey, (db) => {
            var res = db.qs("select i.source, i.block_type, i.modified_date, c.progress from im_c_input i, im_c_control c where i.status = 2 and i.modified_date >= (current_date - ?) and i.block_id = c.block_id and c.progress <= ?", [this.params.days, this.params.defaultThreshold]);
            ims = res.results;
        });

        $from(ims).sort("MODIFIED_DATE").select((r) => {
            var blockName = $from(blcks).equals("BlockType", r.BLOCK_TYPE).at(0).Description;
            var doIt = true;

            if (isDef(this.params.include)) {
                if ( (this.params.include.indexOf(blockName) >= 0) ||
                     (this.params.include.indexOf(r.BLOCK_TYPE) >= 0) )
                    doIt = true;
                else
                    doIt = false;
            }

            if (isDef(this.params.exclude) && 
                ( (this.params.exclude.indexOf(blockName) >= 0) || 
                  (this.params.exclude.indexOf(r.BLOCKTYPE) >= 0) )
               ) {
                doIt = false;
            }

            if (doIt) {
                arRes.push({
                    "Modified date": r.MODIFIED_DATE,
                    "Source"       : r.SOURCE,
                    "Name"         : blockName,
                    "Id"           : r.BLOCK_TYPE,
                    "# records"    : r.PROGRESS
                });
            }
        });

        res[templify(this.params.attrTemplate, { key: key })] = arRes;
    }

    return res;
};
/**
 * <odoc>
 * <key>nattrmon.nInput_Schedulers(aMap) : nInput</key>
 * You can create an input to check for the schedulers on the application
 * using a map composed of:\
 *    - keys           (a key string or an array of keys for an AF object)\
 *    - chKeys         (a channel name for the keys of AF objects)\
 *    - attrTemplate   (a string template)\
 *    - statusInclude  (an array of status to include default: includes everything)\
 *    - statusExclude  (an array of status to exclude default: excludes nothing)\
 *    - namesExclude   (an array of scheduler names to exclude default: excludes nothing)\
 *    - excludeLongAgo (defaults to false but if true will not output the HowLongAgo field)\
 * \
 * </odoc>
 */
var nInput_Schedulers = function(aMap) {
	
   if (isObject(aMap)) {
	this.params = aMap;

	// If keys is not an array make it an array.
    if (!(isArray(this.params.keys))) this.params.keys = [ this.params.keys ];
    } 
    if (isDef(this.attrTemplate)) {
	this.params.attrTemplate = this.attrTemplate;
    }
    if (isUnDef(this.params.attrTemplate)) {
        this.params.attrTemplate = "RAID/Schedulers {{key}}";
    }
    if (isUnDef(this.params.statusInclude)) {        
	this.params.statusInclude = [];
    }
    if (isUnDef(this.params.statusExclude)) {        
	this.params.statusExclude = [];
    }
    if (isUnDef(this.params.namesExclude)) {        
	this.params.namesExclude = [];
    }

    this.params.excludeLongAgo = _$(this.params.excludeLongAgo, "excludeLongAgo").isBoolean().default(false);

    nInput.call(this, this.input);
}
inherit(nInput_Schedulers, nInput);

nInput_Schedulers.prototype.__getSchedulers = function(aKey, scope) {
    var retSchedulers = [];
    var schedulers = [];
    ow.loadFormat();
    var parent = this;

	try {
         nattrmon.useObject(aKey, function(s) {
				try {
                                        var sched = s.exec("Scheduler.GetSchedulerEntryList");
					if (isDef(schedulers)) schedulers = sched.entryList;
				} catch(e) {
					logErr("Error while retrieving schedulers using '" + aKey + "': " + e.message);
					throw e;
				}
			});
       if(this.params.namesExclude.length > 0) {            
            for(i in this.params.namesExclude) {
                schedulers = $from(schedulers).notEquals("name",this.params.namesExclude[i]).select();
            }
        }

	if(this.params.statusInclude.length > 0) {
            var sAux = [];            
            for(i in this.params.statusInclude) {
                sAux = concat(sAux,$from(schedulers).equals("status",this.params.statusInclude[i]).select());
            }
            schedulers = sAux;
        } else if(this.params.statusExclude.length > 0) {            
            for(i in this.params.statusExclude) {
                schedulers = $from(schedulers).notEquals("status",this.params.statusExclude[i]).select();
            }
        }

        retSchedulers = $from($from(schedulers).select(function(x){ var r = {
            Name             : x.name,
            Status           : x.status,
            NextExecutionDate: (x.nextExecDate === null) ? "" : ow.format.fromWedoDate(x.nextExecDate),
            LastExecutionDate: (x.lastExecDate === null) ? "" : ow.format.fromWedoDate(x.lastExecDate),
            HowLongAgo       : (x.lastExecDate === null) ? "" : ow.format.timeago(x.lastExecDate.content[0])
         };
         if (parent.params.excludeLongAgo) delete r.HowLongAgo;
         return r;
        })).sort("-LastExecutionDate").select();

	} catch(e) {
		logErr("Error while retrieving schedulers using '" + aKey + "': " + e.message);
	}

	return retSchedulers;
};

nInput_Schedulers.prototype.input = function(scope, args) {
	var res = {};

	if (isDef(this.params.chKeys)) this.params.keys = $stream($ch(this.params.chKeys).getKeys()).map("key").toArray();

	for(var i in this.params.keys) {
		res[templify(this.params.attrTemplate, {"key": this.params.keys[i]})] = this.__getSchedulers(this.params.keys[i], scope);
	}
   
	return res;
};

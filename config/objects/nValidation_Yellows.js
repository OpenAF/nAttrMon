var nValidation_Yellows = function(semIncludes, aWarningName, aWarningDesc, mediumLimit, highLimit, moreinfo) {
	this.semIncludes = semIncludes;
	this.warningname = (isUndefined(aWarningName)) ? "Yellow semaphore {{name}}" : aWarningName;
	this.warningdesc = (isUndefined(aWarningDesc)) ? "The semaphore {{name}} is still yellow since {{timeago}}. {{moreinfo}}" : aWarningDesc;

	this.warningname = ow.template.getTemplate(this.warningname);
	this.warningdesc = ow.template.getTemplate(this.warningdesc);
	this.moreinfo = (isUndefined(moreinfo)) ? "" : moreinfo;
	
	this.mediumLimit = (isUndefined(mediumLimit)) ? 180 : mediumLimit;
	this.highLimit = (isUndefined(highLimit)) ? 60 : highLimit;
	
	nValidation.call(this, this.validate);
}
inherit(nValidation_Yellows, nValidation);

nValidation_Yellows.prototype.validate = function(warns, scope, args) {
    var ret = [];

    var vals = scope.getCurrentValues();
    for(var i in this.semincludes) {
       var ii = this.semincludes[i];

       var tt = ow.format.dateDiff.inMinutes(new Date(vals[ii].date), new Date());

       if (vals[ii].val == "yellow" && tt >= this.highLimit) {
          ret.push(new nWarning(
             nWarning.LEVEL_HIGH,
             this.warningname({"name": ii}),
             this.warningdesc({
            	 "name": ii, 
            	 "timeago": ow.format.timeago(new Date(vals[ii].date)), 
            	 "moreinfo": this.moreinfo   
             })
          ))
       } else {
          if (vals[ii].val == "yellow" && tt >= this.mediumLimit) {
              ret.push(new nWarning(
                      nWarning.LEVEL_HIGH,
                      this.warningname({"name": ii}),
                      this.warningdesc({
                     	 "name": ii, 
                     	 "timeago": ow.format.timeago(new Date(vals[ii].date)), 
                     	 "moreinfo": this.moreinfo
                      })
              ))
          } else {
              this.closeWarning(this.warningname({"name": ii}));
          }
       }
    }

    return ret;
}
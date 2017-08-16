var nValidation_Semaphores = function(aSemAttributePrefix, aWarningName, aWarningDesc) {
	this.semprefix = (isUndefined(aSemAttributePrefix)) ? "Semaphores " : aSemAttributePrefix;
	this.warningname = (isUndefined(aWarningName)) ? "RED {{name}}" : aWarningName;
	this.warningdesc = (isUndefined(aWarningDesc)) ? "A AF ping to the {{name}} server failed. Server could be down or not responsive. Check the server status and restart if needed." : aWarningDesc;

	this.warningname = ow.template.getTemplate(this.warningname);
	this.warningdesc = ow.template.getTemplate(this.warningdesc);
	
	nValidation.call(this, this.validate);
}
inherit(nValidation_Semaphores, nValidation);

nValidation_Semaphores.prototype.validate = function(warns, scope, args) {
    var ret = [];

    var vals = scope.getCurrentValues();
    for(var i in vals) {
       if(i.match(new RegExp("^" + this.semprefix))) {
          if (vals[i].val == "red") {
             ret.push(new nWarning(
            		 nWarning.LEVEL_HIGH, 
            		 this.warningname({"name": i}),
            		 this.warningdesc({"name": i})
             ));
          } else {
             this.closeWarning(this.warningname({"name": i}));
          }
       }
    }

    return ret;
}
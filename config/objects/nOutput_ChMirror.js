// Author: Nuno Aguiar

/**
 * <odoc>
 * <key>nattrmon.nOutput_ChMirror(aMap)</key>
 * 
 * </odoc>
 */
 var nOutput_ChMirror = function(aMap) {
    if (getVersion() < "20210923") throw "nOutput_ChMirror is only supported starting on OpenAF version 20210923";

    if (isObject(aMap)) {
        this.params = aMap;
    } else {
        this.params = {};
    }
    
    this.channels = _$(aMap.channels, "channels").isMap().default({});

    var chList = $ch().list();
    Object.keys(this.channels).forEach(ch => {
        try {
            _$(this.channels[ch].mirrorFrom, "mirrorFrom").isString().oneOf(chList).$_();
            if (chList.indexOf(ch) < 0) {
                log("Creating channel '" + ch + "' for mirror...");
                var op = __nam_getSec(this.channels[ch], this.channels[ch].secOut);
                $ch(ch).create(__, op.type, op.options);
            }

            $ch(this.channels[ch].mirrorFrom).subscribe(ow.ch.utils.getMirrorSubscriber(ch));
            log("Mirroring '" + this.channels[ch].mirrorFrom + "' to '" + ch + "'"); 
        } catch(e) {
            logErr("ChMirror | Channel '"+ ch + "' | " + String(e));
        }
    });

    nOutput.call(this, this.output);
};
inherit(nOutput_ChMirror, nOutput);

nOutput_ChMirror.prototype.output = function(scope, args) {

};
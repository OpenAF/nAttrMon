/**
 * <odoc>
 * <key>nOutput_Notifications(aMap)</key>
 * Output plug to send push notifications using the Pushover service (requires the Notifications opack).\
 * The aMap entries are:\
 *    - APIToken (String) The Pushover APIToken.\
 *    - notifications (Array of maps)\
 *    - notifications.warnLevel (String)   The warn level for which this entry will send a notification (if not defined defaults to HIGH).\
 *    - notifications.warnTitle (RegExp)   A regular expression for the warn titles to trigger this notification (if not defined defaults to all).\
 *    - notifications.userID    (String)   A pushover user id.\
 *    - notifications.message   (Template) A template where the variable "warn" is provided as each warning entry (e.g. title, description, ...).\
 * \
 * </odoc>
 */
var nOutput_Notifications = function(aMap) {
    this.params = aMap;
    
    // Check for opack
    if (isUnDef(getOPackPath("Notifications"))) {
        throw "Notifications opack not installed (please run 'opack install notifications')";
    }

    if (isUnDef(aMap.APIToken)) {
        throw "You need to define a Pushover APIToken";
    }

    loadLib("pushover.js");

	nOutput.call(this, this.output);
};
inherit(nOutput_Notifications, nOutput);

nOutput_Notifications.prototype.output = function(scope, args, meta) {
    var res = [];

    if (isDef(this.params.notifications)) {
        this.params.__notifyID = sha1(meta.aName);

        var warns = nattrmon.getWarnings(true).getCh().getAll();
        for(var inotif in this.params.notifications) {
            var notif = this.params.notifications[inotif];
            var selec = $from(warns);

            if (isDef(notif.warnLevel)) {
                var level = notif.warnLevel.toLowerCase();
                level = level.charAt(0).toUpperCase() + level.slice(1);

                selec = selec.equals("level", level);
            } else {
                selec = selec.equals("level", "High");
            }

            if (isDef(notif.warnTitle)) {
                selec = selec.match("title", notif.warnTitle);
            }

            var parent = this;

            selec.select((w) => {
                var nID = w.level + parent.params.__notifyID + md5(notif.userID);

                if (isDef(notif.userID) && !nattrmon.isNotified(w.title, nID)) {
                    // Prepare message for notification
                    var message = templify(notif.message, { warn: w });
                    try {
                        // Send notification
                        var ph = new Pushover(parent.params.APIToken);
                        ph.send(notif.userID, message);
                        log("nOutput_Notifications: Notification " + nID + " sent.");

                        // Notify that was been sent successfully
                        //w.notified[parent.__notifyID] = true;
                        nattrmon.setNotified(w.title, nID);
                        //nattrmon.getWarnings(true).setWarningByName(w.title, w);
                    } catch(e) {
                        logErr("nOutput_Notifications: [" + stringify(notif, void 0, "") + "] " + String(e));
                    }
                }
            });
        }
    }

    return 1;
};
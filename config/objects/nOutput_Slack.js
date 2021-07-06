/**
 * <odoc>
 * <key>nOutput_Slack(aMap)</key>
 * Output plug to send slack messages using a webhook.\
 * The aMap entries are:\
 *    - notifications (Array of maps)\
 *    - notifications.warnLevel (String)   The warn level for which this entry will send a notification (if not defined defaults to HIGH).\
 *    - notifications.warnTitle (RegExp)   A regular expression for the warn titles to trigger this notification (if not defined defaults to all).\
 *    - notifications.webhook   (String)   A pushover user id.\
 *    - notifications.simple    (Boolean)  If true the slack notification will be sent with the simplest protocol (false).\
 *    (deprecated) - notifications.message   (Template) A template where the variable "warn" is provided as each warning entry (e.g. title, description, ...).\
 * \
 * </odoc>
 */
 var nOutput_Slack = function(aMap) {
    this.params = aMap;
    nOutput.call(this, this.output);
};
inherit(nOutput_Slack, nOutput);

nOutput_Slack.prototype.output = function(scope, args, meta) {
    var res = [];

    if (isDef(this.params.notifications)) {
        this.params.__notifyID = sha1(meta.aName);

        var warns = nattrmon.getWarnings(true).getCh().getAll();
        for(var inotif in this.params.notifications) {
            var notif = this.params.notifications[inotif];
            var selec = $from(warns);

            if (isDef(notif.warnLevel)) {
                if (isString(notif.warnLevel)) {
                    notif.warnLevel = notif.warnLevel.split(",").map(r => r.trim());
                }
                if (isArray(notif.warnLevel)) {
                    notif.warnLevel.forEach(l => {
                        var level = l.toLowerCase();
                        level = level.charAt(0).toUpperCase() + level.slice(1);
                        selec = selec.orEquals("level", level);
                    });
                }
            } else {
                selec = selec.equals("level", "High");
            }

            if (isDef(notif.warnTitle)) {
                selec = selec.match("title", notif.warnTitle);
            }

            var parent = this;

            selec.select((w) => {
                if (isDef(notif.webhook) && !nattrmon.isNotified(w.title, w.level + parent.params.__notifyID + md5(notif.webhook))) {
                    // Prepare message for notification
                    var aPreMessage = templify("*_{{level}}_ | {{{title}}}*\n{{{description}}}", w);
                    var aContext    = templify("_created on {{createdate}}_", w);

                    var color;

                    switch(w.level.toUpperCase()) {
                    case "HIGH":
                        color = "#FF0000";
                        aPreMessage = ":bomb: " + aPreMessage;
                        break;
                    case "MEDIUM":
                        aPreMessage = ":thinking_face: " + aPreMessage;
                        color = "#FFFF00";
                        break;
                    case "LOW":
                        aPreMessage = ":face_with_monocle: " + aPreMessage;
                        color = "#ADD8E6";
                        break;
                    case "INFO":
                        aPreMessage = ":information_source: " + aPreMessage;
                        break;
                    case "CLOSED":
                        aPreMessage = ":thumbsup: " + aPreMessage;
                        break;
                    }

                    try {
                        var restMsg;
                        if (notif.simple) {
                            restMsg = { text: aPreMessage + "\n" + aContext };
                        } else {
                            restMsg = { blocks: [
                                {
                                    type: "section",
                                    text: { type: "mrkdwn", text: aPreMessage }
                                },
                                {
                                    type: "context",
                                    elements: [ { type: "mrkdwn", text: aContext } ]
                                }
                            ] };
                        }
                        
                        var restReply = $rest().post(notif.webhook, restMsg);
                        if (restReply != "ok") logWarn("Reply from Slack was not expected: " + stringify(restReply, ""));
                        // Notify that was been sent successfully
                        nattrmon.setNotified(w.title, w.level + parent.params.__notifyID + md5(notif.webhook));
                    } catch(e) {
                        logErr("nOutput_Slack: [" + stringify(notif, void 0, "") + "] " + String(e));
                    }
                }
            });
        }
    }

};
var nattrmonCtgs = [];
var nattrmonAttrsOrig = {};
var nattrmonAttrs = [];
var nattrmonWarns = [];
var plugs = [];

function refresh(data) {
    var attrs = data.attributes;
    var values = data.values;
    var lastvalues = data.lastvalues;
    var warns = data.warnings;

    nattrmonAttrsOrig = attrs;
    var tempattrs = [];

    var tempctgs = {};
    //var tempattr = {};

    for (i in attrs) {
        if (values[i] != undefined) {
            attrs[i].val = values[i].val;
            attrs[i].moddate = values[i].date;
            attrs[i].lastval = lastvalues[i].val;
            attrs[i].lastmoddate = lastvalues[i].date;
        }
        if (tempctgs[attrs[i].category.join("/")] == undefined) {
            tempctgs[attrs[i].category.join("/")] = [attrs[i]];
        } else {
            tempctgs[attrs[i].category.join("/")].push(attrs[i]);
        }
        tempattrs.push(attrs[i]);
    }

    var ctgs = [];
    for (i in tempctgs) {
        ctgs.push({
            "name": i,
            "attrs": tempctgs[i]
        });
    }

    var tempwarns = {
        High: [],
        Medium: [],
        Low: [],
        Info: []
    };
    for (var i in warns) {
        tempwarns[i] = warns[i];
    }

    nattrmonCtgs = ctgs;
    nattrmonAttrs = tempattrs;
    nattrmonWarns = tempwarns;
}

function render(sce, aValue, aType) {
    // If undefined
    if (typeof aValue === 'undefined') {
        aValue = "not available";
        aType = "undefined";
    }

    var _determineKeys = ar => {
        return ar.reduce((keys, map) => {
            if ("[object Object]" == Object.prototype.toString.call(map)) {
                for (const key in map) {
                    keys.add(key)
                }
            }
            return keys
        }, new Set())
    }

    // If object
    var _render = (aValue) => {
        if (typeof aValue != 'object') return aValue;

        var out = "";
        if (aValue instanceof Array && aValue.length > 0) {
            var _keys = Array.from(_determineKeys(aValue))
            var out = "<table class=\"nattributetable\"><tr>";
            for (var i in _keys) {
                out += "<th class=\"nattributetablehead\"><b>" + _keys[i] + "</b></th>";
            }
            out += "</tr>";
            for (var x in aValue) {
                out += "<tr>";
                for (var y in _keys) {
                    var _v = ""
                    if (aValue[x] != null && aValue[x][_keys[y]] != null) {
                        if ("undefined" != aValue[x][_keys[y]]) _v = aValue[x][_keys[y]]
                        if ("undefined" == typeof _v) _v = ""
                    }
                    out += "<td class=\"nattributetablecell\">" + _render(_v) + "</td>";
                }
                out += "</tr>";
            }
            out += "</table>";
        } else {
            var out = "<table class=\"nattributetable\">";
            for (var i in aValue) {
                var _v = ""
                if (aValue[i] != null) {
                    if ("undefined" != aValue[i]) _v = aValue[i]
                    if ("undefined" == typeof _v) _v = ""
                }
                out += "<tr><td class=\"nattributetablecell\"><b>" + i + "</b></td><td class=\"nattributetablecell\">" + _render(_v) + "</td></tr>";
            }
            out += "</table>";
        }
        return out;
    };

    if (typeof aValue == 'object') {
        var out = "";
        out += _render(aValue);
        aValue = out;
    }

    switch (aType) {
        case "sem": return sce.trustAsHtml("<span style=\"background-color:" + aValue + "\">&nbsp;&nbsp;&nbsp;&nbsp;</span><span class=\"nattributevalue\"> - " + aValue + "</span>");
        case "desc": return sce.trustAsHtml("<span class=\"nattributedesc\">" + aValue + "</span>");
        case "date": return sce.trustAsHtml((new Date(aValue)).toLocaleString() + "");
        case "undefined": return sce.trustAsHtml("<span class=\"nattributevalueNA\">" + aValue + "</span>")
        default:
            return sce.trustAsHtml("<span class=\"nattributevalue\">" + aValue + "</span>");
    }
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};
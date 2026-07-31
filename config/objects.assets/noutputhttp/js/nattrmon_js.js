var nattrmonCtgs = [];
var nattrmonAttrsOrig = {};
var nattrmonAttrs = [];
var nattrmonWarns = [];
var plugs = [];

function __namEscapeHtml(v) {
    return String(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function __namSafeColor(v) {
    var c = String(v).trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
    if (/^(rgb|hsl)a?\([0-9\s,%.+-]+\)$/i.test(c)) return c;
    if (/^[a-zA-Z]+$/.test(c)) return c;
    return "transparent";
}

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

    var _determineKeys = function(ar) {
        return ar.reduce(function(keys, map) {
            if ("[object Object]" == Object.prototype.toString.call(map)) {
                for (var key in map) {
                    keys.add(key)
                }
            }
            return keys
        }, new Set())
    }

    var _isObjRendered = false;

    // If object
    var _render = function(aValue) {
        if (typeof aValue != 'object') return __namEscapeHtml(aValue);

        var out = "";
        if (aValue instanceof Array && aValue.length > 0) {
            var _keys = Array.from(_determineKeys(aValue))
            var out = "<table class=\"nattributetable\"><tr>";
            for (var i in _keys) {
                out += "<th class=\"nattributetablehead\"><b>" + __namEscapeHtml(_keys[i]) + "</b></th>";
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
                out += "<tr><td class=\"nattributetablecell\"><b>" + __namEscapeHtml(i) + "</b></td><td class=\"nattributetablecell\">" + _render(_v) + "</td></tr>";
            }
            out += "</table>";
        }
        return out;
    };

    if (typeof aValue == 'object') {
        var out = "";
        out += _render(aValue);
        aValue = out;
        _isObjRendered = true;
    }

    var _safeText = function(v) {
        return _isObjRendered ? String(v) : __namEscapeHtml(v);
    };

    switch (aType) {
        case "sem":
            var _semColor = __namSafeColor(aValue);
            return sce.trustAsHtml("<span style=\"background-color:" + _semColor + "\">&nbsp;&nbsp;&nbsp;&nbsp;</span><span class=\"nattributevalue\"> - " + __namEscapeHtml(aValue) + "</span>");
        case "desc": return sce.trustAsHtml("<span class=\"nattributedesc\">" + _safeText(aValue) + "</span>");
        case "date": return sce.trustAsHtml((new Date(aValue)).toLocaleString() + "");
        case "undefined": return sce.trustAsHtml("<span class=\"nattributevalueNA\">" + _safeText(aValue) + "</span>")
        default:
            return sce.trustAsHtml("<span class=\"nattributevalue\">" + _safeText(aValue) + "</span>");
    }
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};
// Phase 6 -- harden nOutput HTTP UI rendering against script/style injection

ow.test.test("noutputhttp::render escapes HTML in text fields", () => {
	load(NATTRMON_HOME + "/config/objects.assets/noutputhttp/js/nattrmon_js.js")
	var sce = { trustAsHtml: function(v) { return v } }

	var out = render(sce, "<img src=x onerror=1>", "desc")
	ow.test.assert(out.indexOf("&lt;img src=x onerror=1&gt;") >= 0, true, "description should be HTML-escaped")
	ow.test.assert(out.indexOf("<img src=x onerror=1>") < 0, true, "raw HTML tag should not be rendered")
})

ow.test.test("noutputhttp::render escapes object keys and values in generated tables", () => {
	load(NATTRMON_HOME + "/config/objects.assets/noutputhttp/js/nattrmon_js.js")
	var sce = { trustAsHtml: function(v) { return v } }

	var out = render(sce, { "<k>": "v&x", n: "<b>z</b>" })
	ow.test.assert(out.indexOf("&lt;k&gt;") >= 0, true, "object keys should be escaped in table output")
	ow.test.assert(out.indexOf("v&amp;x") >= 0, true, "object values should be escaped in table output")
	ow.test.assert(out.indexOf("<b>z</b>") < 0, true, "raw HTML in object values should not be rendered")
})

ow.test.test("noutputhttp::render sem sanitizes css color values", () => {
	load(NATTRMON_HOME + "/config/objects.assets/noutputhttp/js/nattrmon_js.js")
	var sce = { trustAsHtml: function(v) { return v } }

	var out = render(sce, "red; background:url(javascript:alert(1))", "sem")
	ow.test.assert(out.indexOf("background-color:transparent") >= 0, true, "invalid sem color should fallback to transparent")
	ow.test.assert(/style=\"[^\"]*background:url\(/.test(out), false, "malicious css injection should not be inserted in style context")
})

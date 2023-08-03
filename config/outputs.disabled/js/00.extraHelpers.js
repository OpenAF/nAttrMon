ow.loadTemplate()

ow.template.addHelper("$startsWith", (a, b, s) => {
   if (isString(a) && isString(b)) {
     if (a.startsWith(b)) return (isDef(s.fn) ? s.fn(this) : true)
     return (isDef(s.inverse) ? s.inverse(this) : false) 
   }
})

ow.template.addHelper("$endsWith", (a, b, s) => {
   if (isString(a) && isString(b)) {
     if (a.endsWith(b)) return (isDef(s.fn) ? s.fn(this) : true)
     return (isDef(s.inverse) ? s.inverse(this) : false) 
   }
})

ow.template.addHelper("$match", (a, re, flags, s) => {
   if (isUnDef(s)) { s = flags; flags = "" }
   if (isString(a) && isString(re) && isString(flags)) {
     if (a.match(new RegExp(re, flags))) return (isDef(s.fn) ? s.fn(this) : true)
	 return (isDef(s.inverse) ? s.inverse(this) : false) 
   }
})

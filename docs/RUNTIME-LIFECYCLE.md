# Connection recovery and warning updates

## Monitored connections

`nattrmon.addMonitoredObject(key, factory)` registers a connection factory and
immediately calls it. It returns the created object, or `undefined` if creation
failed. `nattrmon.getMonitoredObject(key)` returns the currently available object;
`hasMonitoredObject(key)` checks registration, not connection health.

Failed initial creation leaves the wrapper dirty so it can retry. Recovery runs
when one of these APIs is called:

```javascript
// Test dirty objects, including registrations whose initial factory failed.
nattrmon.monitoredObjectsTest()

// Mark one connection dirty and immediately test/recreate it.
nattrmon.declareMonitoredObjectDirty("service")
```

Registration and reads do not start a retry timer. Schedule
`monitoredObjectsTest()` in a plug if your configuration needs periodic retries.
Each call makes at most one replacement attempt per dirty object. Clean objects
are skipped.

When testing a dirty object:

1. A successful health check clears the dirty flag and retains the object.
2. A missing object or a thrown health-check error triggers recreation. The old
   object is removed from the wrapper and its type-specific close is attempted.
3. A successful factory result updates the detected type and default health
   check, then clears the dirty flag. Fetch the replacement with
   `getMonitoredObject(key)`; a reference held by your plug still points to the
   old object.
4. A factory exception or `undefined` result leaves the object unavailable and
   dirty for another attempt. Callers must handle `undefined` while recovery is
   pending.

The lower-level `new nMonitoredObject(key, factory, testFunction)` accepts an
optional custom health check. It receives the object and must **throw** to report
failure; returning `false` does not report failure. Custom checks survive
recreation and are not called for a missing object. The public
`addMonitoredObject` wrapper accepts only the key and factory.

Default checks use `Ping` for AF connections and `select 1 from dual` for DB
connections. Other detected types and unrecognized objects are recreated when
marked dirty. Use a custom check when constructing a wrapper directly if these
defaults do not suit the connection.

## Shutdown cleanup

`nattrmon.stop()` stops scheduling and workers, then calls `stopObjects()` before
destroying runtime channels. `stopObjects()` stops pools, attempts type-specific
closure of monitored objects, and calls plug `close()` methods.

A pool or monitored-object cleanup exception is logged with its key. Cleanup
continues with the remaining resources, so one failure does not prevent plug or
channel cleanup. Registrations are removed even when their cleanup fails; the
error log does not mean the external resource was successfully closed.

## Updating warnings

Warnings are identified by their full title. Reuse that title to update or close
an existing alarm. `nattrmon.setWarnings(array)` accepts `nWarning` instances or
serialized warning maps; plain maps also work when the title already exists.
Use `nWarning` when creating new warnings so timestamps, category, simple title,
and notification fields are initialized:

```javascript
nattrmon.setWarnings([
  new nWarning(nWarning.LEVEL_HIGH, "Service/Availability", "Unavailable")
])

// Later, update the same warning using a serialized map.
var warning = nattrmon.getWarnings(true)
                      .getWarningByName("Service/Availability").getData()
warning.level = nWarning.LEVEL_CLOSED
warning.description = "Recovered"
nattrmon.setWarnings([warning])
```

Inside a validation, `this.closeWarning(title)` closes an existing warning and
commits that change immediately. Returning an empty warnings array does not close
previous warnings, and `setWarnings` does not replace or clear the collection.

## Regression tests

Run `openaf -f tests/autoTestAll.js` from the repository root. Recovery and
shutdown regressions are covered in `test_core_lifecycle_regressions.js` and
`test_legacy_recovery_regressions.js` under `tests/autotest/`, using local objects
and simulated failures without external service connections.

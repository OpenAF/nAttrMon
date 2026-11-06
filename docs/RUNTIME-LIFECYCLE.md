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

## Plug failures, counters and channel batches

Input, output and validation wrappers propagate the original exception to the shared
execution boundary, which logs it once with source context. A failed validation does
not commit its returned warnings. Explicit side effects performed by a plug before
it throws are not rolled back.

`numberOfExecs` counts successes and `numberOfExecsInError` counts failures. Error
rates and the diagnostics `minExecs` threshold use their sum (all attempts). Average
and last execution latency continue to describe successful executions. Timeout and
watchdog thresholds retain their configured meanings.

For subscribed `setall` events, `attrPattern` matches the names derived from each
record and the batch key fields. Without `chHandleSetAll`, any matching record
triggers one execution with the complete original batch payload. With
`chHandleSetAll: true`, matching records execute sequentially in source order as
`set` events. Each result passes through the normal `onlyOnEvent`, stamp, array,
merge and sort processing before the next record runs. Repeated names therefore
rotate current/last values as individual events do.

The first exception or timeout stops the batch. Earlier commits remain; later
records do not execute. All records share the trigger's original timeout deadline.
There is no rollback or automatic retry queue. Process-status cleanup runs even
when execution fails.

## Bounded output bookkeeping

Outputs retain the plain `lastSeen` timestamp map and its existing change signals.
Occupancy is maintained under the instance lock; enumeration and sorting occur
only when eviction is needed. Eviction keeps the same cap, timestamp comparator
and oldest-quarter rule. Replacing `lastSeen` with another map triggers a recount.
Directly adding or deleting its properties outside the output API is unsupported.

## Regression tests

Run `openaf -f tests/autoTestAll.js` from the repository root. Recovery and
shutdown regressions are covered in `test_core_lifecycle_regressions.js` and
`test_legacy_recovery_regressions.js` under `tests/autotest/`, using local objects
and simulated failures without external service connections.

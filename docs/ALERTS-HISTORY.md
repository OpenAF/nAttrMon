# Alert delivery and history acknowledgement

`nOutput_EmailWarnings` keeps each instance busy through preparation, sending,
and notification acknowledgement. Overlapping invocations of that instance
return without sending another message. Grouping and similarity thresholds see
notification marks staged during preparation; those marks are written to the
warning channel only after the email send succeeds. Template or send failures
release the guard and leave the warnings eligible on the next normal invocation.
There is no retry queue. Existing startup grace periods, filters, and notification
IDs retain their meaning.

## Sustained conditions

A `nValidation_Generic` check can specify `for: 5m` to require a failing condition
to persist for five minutes. See
[`16.validateTimed.yaml`](../config/validations.disabled/yaml/16.validateTimed.yaml).

Each trigger reads one complete source snapshot for all timed checks. Buffered
subscriptions read their underlying source channel. A scheduled validation uses
current attribute values. Timer groups are local to the validation instance and
are identified by source channel, check position, and rendered warning title.
Any failing row keeps its group running: healthy sibling rows, partial events,
and row reordering do not reset it. Use the title template to choose whether rows
or attributes share a group.

After the duration expires, the next trigger renders a warning and runs the
existing healing logic for each failing row, in snapshot order. A wholly healthy
group closes once; removal of all matching records closes and prunes it. Failed
snapshot reads leave timers and warnings unchanged. Timers live in memory and
reset when the plug reloads. No background timer or persistent queue is created.
Untimed checks continue to evaluate only the event's records.

## Database history

H2, PostgreSQL, and Oracle history outputs track timestamps only after their data
transaction commits. With `onlyOnEvent: true`, unseen or changed timestamps are
inserted. With `onlyOnEvent: false`, each invocation inserts the current values.
Failed inserts and failed commits remain eligible on the next invocation.
Retention runs after the data commit; a retention failure does not cause an
already committed value to be inserted again. Existing tables and retention
thresholds are unchanged.

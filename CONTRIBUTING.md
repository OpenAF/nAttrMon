# Contributors Guide
`nAttrMon` welcomes your contribution. Below steps can be followed to create a pull request.

* Fork this nAttrMon repository into your account.
* Create a feature branch in your fork (`$ git checkout -b my-new-feature`) (to add a new plug of feature)
* Implement the plug or features.
* Test it.
* For new plugs provide a yaml/js file to test it on the corresponding *.disabled folder. For new core features prepare a description of your changes and how to test them. 
* Commit your changes (`$ git commit -am 'Add some feature/plug'`).
* Push the feature branch into your fork (`$ git push origin -u my-new-feature`).
* Create new pull request to `master` branch adding the description on how to test the plug or feature.
* For new plugs do please also contribute with the corresponding documentation on https://github.com/OpenAF/nattrmon-docs

## Testing changes

Run the hermetic suite from the repository root before and after changing code:

```bash
openaf -f tests/autoTestAll.js
```

Use the explicit `-f` flag: a bare `openaf tests/autoTestAll.js` can exit without
running the tests. The suite needs no network or live nAttrMon server, creates
isolated engines under `tests/.tmp`, and removes that directory at the end. A
failed assertion produces a nonzero exit status. If Java aborts with a macOS
`sysctlbyname` error in a restricted environment, rerun with permission to read
system metrics; an aborted run is not a passing test result.

Add focused regressions as `tests/autotest/test_*.js`; the runner discovers them
automatically. Use `tests/autotest/harness.js` to isolate channels, globals, and
engine state. Reproduce the failure before applying the fix, then run the full
suite. Live-service tests in `tests/unitTest.js` and `tests/unitTestYAML.js` are
separate checks and require suitable server settings.

When adding a plug or changing its `execArgs`, update its matching
`config/objects.meta/<Constructor>.yaml` and disabled sample. Follow the
[object metadata checklist](docs/OBJECTS-METADATA.md). Core connection and warning
contracts are documented in [Runtime lifecycle](docs/RUNTIME-LIFECYCLE.md).

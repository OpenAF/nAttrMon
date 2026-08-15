# Object metadata

`config/objects.meta/` contains declarative documentation for object constructors. It is read when nAttrMon starts, independently of `config/objects/`; loading metadata never evaluates or instantiates a plug object.

This lets documentation tools and configuration UIs discover inputs, outputs, and validations while preserving lazy object loading.

## File format

Create one YAML or JSON file per constructor:

```yaml
kind: input                         # input, output, or validation
constructor: nInput_Example
title: Example input
description: One-sentence explanation of what it collects.
examples:
  - config/inputs.disabled/yaml/10.example.yaml
arguments:
  - name: endpoint
    type: string
    required: true
    description: Service URL to query.
    example: https://service.example/api
  - name: token
    type: string
    secret: true
    description: Token used to authenticate to the service.
    example: "$SERVICE_TOKEN"
```

Every entry requires `kind`, `constructor`, `title`, `description`, and an `arguments` array. Every argument requires `name`, `type`, `description`, and `example`. Optional argument fields are `required`, `default`, `secret`, `unit`, `enum`, `deprecated`, and `visibleWhen`.

Use `secret: true` for passwords, tokens, private keys, and credential maps. Examples must contain placeholders rather than real credentials.

## Loading and overrides

nAttrMon loads package metadata first and then `<active-config>/objects.meta`. A local file with the same `constructor` replaces the packaged entry. This supports custom objects and local documentation corrections without changing the installed package.

Use the runtime API from an OpenAF console or another object:

```javascript
nattrmon.getObjectsMeta()                         // all known objects
nattrmon.getObjectsMeta("input")                  // inputs only
nattrmon.getObjectsMeta("output", "nOutput_Log") // a single object
nattrmon.getObjectsMetaIssues()                    // invalid/unreadable metadata files
```

The metadata registry is documentation, not runtime validation of `execArgs`. Keep constructor validation as the source of runtime behaviour. Link an existing `.disabled` YAML configuration under `examples` whenever possible, but do not infer the schema from it: examples can contain legacy keys or historical mistakes.

## Contributor checklist

1. Add or update the object metadata whenever an `execArgs` option is added, removed, or renamed.
2. Link a runnable disabled configuration example for the object kind.
3. Mark sensitive settings as `secret` and use non-secret placeholders in examples.
4. Run `openaf -f tests/autoTestAll.js`.

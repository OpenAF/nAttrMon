# nAttrMon skills for GenAI assistants

These skills guide a coding assistant through nAttrMon's OpenAF APIs, plug contracts, metadata, examples, and configuration tools. They are plain Markdown with `name` and `description` frontmatter, with no model provider or GenAI runtime dependency in nAttrMon.

| Skill | Use it to |
| --- | --- |
| [nattrmon-create-input](nattrmon-create-input/SKILL.md) | Build a collector that produces monitored attributes. |
| [nattrmon-create-validation](nattrmon-create-validation/SKILL.md) | Build checks with stable warning titles and recovery behavior. |
| [nattrmon-create-output](nattrmon-create-output/SKILL.md) | Build an attribute/warning destination or presentation output. |
| [nattrmon-configure-plugs](nattrmon-configure-plugs/SKILL.md) | Select existing components and configure arguments, triggers, and queries. |
| [nattrmon-configure-runtime](nattrmon-configure-runtime/SKILL.md) | Configure workers, logging, persistence, metrics, watchdogs, and paths. |

## Use

Give your assistant access to this checkout and ask it to read the chosen `SKILL.md`. This works even when the assistant has no automatic skill discovery. For example:

```text
Read skills/nattrmon-create-input/SKILL.md and build an input that collects
queue depths from this JSON payload: {"queues":[{"name":"orders","depth":12}]}.
Use a configurable endpoint and include a disabled YAML example and fixture tests.
```

```text
Read skills/nattrmon-create-validation/SKILL.md and add a check that raises
a HIGH warning when Queue/Depth exceeds 100, closes it when it recovers,
and keeps an existing warning open when the value is missing.
```

```text
Read skills/nattrmon-create-output/SKILL.md and create a JSON-lines file output
for warnings, with include/exclude filters and tests using temporary files.
```

```text
Read skills/nattrmon-configure-plugs/SKILL.md and configure filesystem
collection every five minutes for /data in my /srv/nattrmon/config directory.
Validate the descriptors offline.
```

```text
Read skills/nattrmon-configure-runtime/SKILL.md and prepare settings for
8 workers and console logging in /srv/nattrmon/nattrmon.yaml.
Check whether deployment environment values override those settings.
```

If your assistant supports skill folders, register or copy the individual
`nattrmon-*` directories into its supported skill location using that tool's
installation instructions. The repository's `skills/` folder is a source
collection; automatic discovery depends on the assistant. Keep the checkout
available: these skills intentionally reference maintained code and docs
instead of bundling stale copies. All paths inside the skills are relative to
the nAttrMon checkout or installation, not the assistant's skill directory.

Generated plugs should include constructor code, matching metadata, disabled
sample configuration, and focused tests. Configuration work should identify
the effective deployment paths and distinguish offline validation from live
operation. Read `AGENTS.md` for repository conventions.

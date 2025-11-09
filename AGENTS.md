# Repository Guidelines

## Project Structure & Module Organization
Core runtime code lives in `lib/` (e.g., `lib/nmain.js` orchestrates workers, buffers, and security hooks) while `nattrmon.js` handles process bootstrap. Reusable plug definitions live under `config/objects/` and their assets under `config/objects.assets/`. Sample YAML/JS plugs are staged inside the `config/* .disabled/` trees so new contributions ship with reference configs without running by default. Tests sit in `tests/`, utility scripts and plug templates in `util/`, and docs/images in `docs/`.

## Build, Test, and Development Commands
Use `opack pack .` from the repo root to create `nattrmon-<date>.opack` based on `.package.yaml`. Run a local instance with `openaf nattrmon.js --withDirectory ./config` (set `NATTRMON_HOME` when running outside the repo). Back up/edit configs safely via `openaf util/backupConfig.yaml`. For focused plug work load templates by running `openaf util/templates/Object_nInput_template.js --help` to inspect expected arguments.

## Coding Style & Naming Conventions
This is OpenAF-flavoured JavaScript: keep strict mode–friendly code, prefer tabs (see `lib/*.js`), and align multi-line assignments for readability. Globals that tune runtime follow the `__NAM_*` pattern, while plug classes are PascalCase with prefixes such as `nInput_Filesystem`. Use camelCase for functions, keep side-effect helpers in `loadLib` modules, and guard optional data with helpers like `isDef/isUnDef` instead of bare truthiness checks.

## Testing Guidelines
Smoke-test plugs with `openaf tests/unitTest.js` or `tests/unitTestYAML.js`, adjusting the server/IP constants before running. When adding a plug, provide a runnable sample under the matching `config/inputs.disabled/js|yaml`, `outputs.disabled`, or `validations.disabled` folder so reviewers can replay the scenario. Reuse `tests/nattrmonTester.js` utilities to simulate channels and document any extra data needed for reproducibility.

## Commit & Pull Request Guidelines
Work in feature branches (`git checkout -b feature/<slug>`), keep commit titles short and imperative (e.g., `Add filesystem count plug`, mirroring existing `Update package` style), and describe the test surface in the body. Pull requests to `master` should explain configuration changes, link related issues, and include instructions to validate the new plug or capability; attach screenshots/log excerpts when touching outputs or UI assets.

## Configuration & Security Tips
Never commit live secrets—use `config/inputs.disabled/yaml/secrets.yaml.sample` as the disclosure boundary and document required environment variables. Prefer keeping custom configs inside `config/` and reference them via `nattrmon.yaml.sample` so deployments can override paths through `NATTRMON_HOME`, `NATTRMON_DIR`, or `withDirectory`. When shipping new assets, stage them in `config/objects.assets/` and reference via relative URLs so `opack pack` can collect them automatically.

# nAttrMon

![version](.github/version.svg)

**nAttrMon** (n-Attribute-Monitor) is a flexible, lightweight monitoring framework designed for functional monitoring of solutions, including RAID systems and custom applications. It provides a plugin-based architecture for collecting metrics, validating conditions, and generating alerts.

## Features

- **Flexible Plugin Architecture**: Extensible inputs, outputs, and validation plugins
- **YAML/JavaScript Configuration**: Define monitoring configurations using YAML or JavaScript
- **Cron-based Scheduling**: Schedule inputs and outputs with cron expressions
- **Real-time Validation**: Execute custom validation logic on collected attributes
- **Multiple Output Channels**: Support for various output formats and destinations
- **Built-in Debugging**: Comprehensive logging and debugging capabilities
- **Single-run Mode**: Execute monitoring tasks once or run as a daemon
- **Easy Updates**: Simple package-based update mechanism

## Prerequisites

- [OpenAF](https://openaf.io/) >= 20241117

## Quick Start

1. **Install nAttrMon**:
   ```bash
   opack install nattrmon
   ```

2. **Configure your monitoring** by editing the configuration files in the `config` folder

3. **Run nAttrMon**:
   ```bash
   ojob nattrmon.yaml
   ```

For a single execution without daemon mode:
```bash
ojob nAttrmon_single.yaml.sample
```

## Installation

### Install from opack repository

```bash
opack install nattrmon
```

### Install a specific version

```bash
opack install nattrmon-yyyyMMdd.opack
```

Where `nattrmon-yyyyMMdd.opack` is the specific package version.

## Updating

### Step 1: Backup your configuration

```bash
cd /the/folder/where/nAttrMon/is/installed
ojob ./util/backupConfig.yaml
```

This generates a file called `nattrmonConfig-yyyyMMdd.zip`. Move it to a safe location (e.g., your home folder).

### Step 2: Update nAttrMon

```bash
opack update nattrmon
```

**Important notes**:
- Newer versions may require updated OpenAF versions
- If you encounter errors, use the install procedure instead

### Configuration considerations after update

If you use a custom config folder (not the default):

- Check the `inputs.disabled`, `outputs.disabled`, and `validations.disabled` examples in the default config folder for updates
- If your config folder has objects and `objects.assets` copied from the default `config/objects` folder, merge them or use the `COREOBJECTS` setting in the main `nattrmon.yaml` configuration file
- You can restore from the backup created in Step 1 if needed

## Documentation

For comprehensive documentation, tutorials, and plugin references, visit:

[https://openaf.github.io/nattrmon-docs/](https://openaf.github.io/nattrmon-docs/)

## Building from Source

1. Clone this repository:
   ```bash
   git clone https://github.com/OpenAF/nAttrMon.git
   cd nAttrMon
   ```

2. Build the package:
   ```bash
   opack pack .
   ```

3. This generates a package named `nattrmon-yyyyMMdd.opack`

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:
- How to fork and create feature branches
- Testing requirements for new plugins
- Pull request guidelines
- Documentation contributions

## Support

- **Issues**: [GitHub Issues](https://github.com/OpenAF/nAttrMon/issues)
- **Documentation**: [nattrmon-docs](https://github.com/OpenAF/nattrmon-docs)

## License

nAttrMon is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## Authors

- Nuno Aguiar
- Andreia Brizida
- Jose Alves
- Leandro Fernandes
- Surya Kalyan Jaddu

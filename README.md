# Komerce Skill CLI

AI Skills Registry — manage AI assistant skills across multiple IDEs.

## Installation

No installation required! Use `npx` to run commands directly:

```bash
npx komerce-skill <command>
```

## Quick Start

### For Users (Installing Skills)

**Install a skill**
```bash
npx komerce-skill install fe/react
```

The CLI will automatically:
- Download the skill from npm registry
- Detect which IDEs are active in your project (Kiro, Cursor, Copilot, etc.)
- Generate configuration files in the correct locations for each IDE

**Install multiple skills**
```bash
npx komerce-skill install fe/react be/express testing/jest
```

**Force installation for a specific IDE**
```bash
npx komerce-skill install fe/react --ide kiro
```

**Search for available skills**
```bash
npx komerce-skill search vue
```

**List installed skills**
```bash
npx komerce-skill list
```

**List skills by category**
```bash
npx komerce-skill list --category fe
```

**Update a skill**
```bash
npx komerce-skill update fe/react
```

**Update all skills**
```bash
npx komerce-skill update --all
```

**Remove a skill**
```bash
npx komerce-skill remove fe/react
```

**Get detailed info about a skill**
```bash
npx komerce-skill info fe/react
```

**Report a problematic skill**
```bash
npx komerce-skill report fe/react
```

---

### For Skill Authors (Publishing Skills)

**Login to npm**
```bash
npx komerce-skill login
```

**Create a new skill scaffold**
```bash
npx komerce-skill init
```

This will prompt you for:
- Skill name (namespace format: `fe/react`)
- Description
- Author
- License (default: MIT)
- Target IDEs (comma-separated: `kiro,cursor,copilot`)

**Publish a skill**
```bash
npx komerce-skill publish ./my-skill
```

Or from within the skill directory:
```bash
cd my-skill
npx komerce-skill publish
```

---

## Skill Structure

Each skill package contains:

```
my-skill/
├── skill.json          # Metadata and configuration
├── instructions.md     # AI instructions content
└── package.json        # Auto-generated during publish
```

### `skill.json` Format

```json
{
  "name": "fe/react",
  "version": "1.0.0",
  "description": "React development instructions for AI assistant",
  "author": "komerce-team",
  "license": "MIT",
  "category": "fe",
  "targets": ["kiro", "cursor", "copilot", "jetbrains", "antigravity"],
  "entrypoint": "instructions.md"
}
```

**Required fields:**
- `name` — Namespace format: `<category>/<skill-name>` (e.g., `fe/react`)
- `version` — Semantic version (e.g., `1.0.0`)
- `description` — Short description of the skill
- `author` — Author name or email
- `license` — SPDX license identifier (e.g., `MIT`)
- `category` — Category prefix matching the namespace (e.g., `fe`, `be`, `testing`)
- `targets` — Array of supported IDEs: `kiro`, `cursor`, `copilot`, `jetbrains`, `antigravity`, or `all`
- `entrypoint` — Path to the main instruction file (e.g., `instructions.md`)

**Optional fields:**
- `dependencies` — Array of other skill namespaces this skill depends on
- `keywords` — Array of keywords for search discoverability
- `homepage` — URL to documentation
- `repository` — URL to source repository

---

## Supported IDEs

The CLI automatically detects and configures skills for:

| IDE | Config Directory | Output Location |
|-----|------------------|-----------------|
| **Kiro** | `.kiro/` | `.kiro/steering/<skill-name>.md` |
| **Cursor** | `.cursor/` | `.cursor/rules/<skill-name>.mdc` |
| **GitHub Copilot** | `.github/` | `.github/instructions/<skill-name>.instructions.md` |
| **JetBrains AI** | `.idea/` | `.idea/ai-rules/<skill-name>.md` |
| **Antigravity** | `.antigravity/` | `.antigravity/skills/<skill-name>.md` |

---

## How It Works

### For Users

1. Run `npx komerce-skill install fe/react`
2. CLI downloads `@komerce-skill/fe-react` from npm
3. CLI detects which IDE config directories exist in your project
4. CLI copies the instruction file to the appropriate location for each detected IDE
5. Your AI assistant now has access to the skill instructions

### For Skill Authors

1. Create skill content in a directory with `skill.json` and `instructions.md`
2. Run `npx komerce-skill publish ./my-skill`
3. CLI validates the manifest and files
4. CLI generates `package.json` from `skill.json`
5. CLI publishes to npm under `@komerce-skill/<category>-<skill-name>`
6. Users can now install your skill

---

## Examples

### Installing Skills for a React + Express Project

```bash
# Install frontend and backend skills
npx komerce-skill install fe/react be/express

# Install testing skill
npx komerce-skill install testing/jest

# Check what's installed
npx komerce-skill list
```

### Creating and Publishing a New Skill

```bash
# Create scaffold
npx komerce-skill init

# Follow prompts:
# - Skill name: fe/vue-3
# - Description: Vue 3 Composition API instructions
# - Author: your-name
# - License: MIT
# - Targets: kiro,cursor,copilot

# Edit the generated instructions.md file
cd fe-vue-3
# ... edit instructions.md ...

# Login to npm (one-time)
npx komerce-skill login

# Publish
npx komerce-skill publish
```

---

## Requirements

- **Node.js** >= 18.0.0
- **npm** account (for publishing skills)

---

## Publishing to npm

This CLI tool itself can be published to npm:

```bash
# Build
npm run build

# Login
npm login

# Publish
npm publish --access public
```

After publishing, users can run:
```bash
npx komerce-skill install fe/react
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.js --help

# Run tests
npm test

# Type check
npm run lint
```

---

## License

MIT

---

## Contributing

Contributions are welcome! Please open an issue or pull request.

---

## Support

For issues or questions:
- GitHub Issues: [komerce/komerce-skill](https://github.com/komerce/komerce-skill/issues)
- npm: [@komerce-skill](https://www.npmjs.com/org/komerce-skill)

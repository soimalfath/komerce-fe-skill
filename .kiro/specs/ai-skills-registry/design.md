# Design Document: AI Skills Registry

## Overview

AI Skills Registry adalah sistem distribusi skill berbasis npm yang memungkinkan developer menginstall, mengelola, dan mempublikasikan instruksi AI untuk berbagai IDE. Sistem ini terdiri dari dua komponen utama:

1. **CLI Tool (`komerce-skill`)** — alat baris perintah yang menjadi antarmuka utama pengguna untuk semua operasi skill.
2. **Skill Package Format** — standar struktur paket yang memungkinkan skill bekerja lintas IDE.

npm registry (npmjs.com) digunakan sebagai backend distribusi dengan scope `@komerce-skill`. Pendekatan ini memanfaatkan infrastruktur npm yang sudah matang (versioning, search, download stats, auth) tanpa perlu membangun registry sendiri.

### Alur Kerja Utama

```
Developer                CLI Tool              npm Registry          IDE
    |                       |                       |                 |
    |-- install fe/vue-2 -->|                       |                 |
    |                       |-- fetch pkg info ---->|                 |
    |                       |<-- metadata ----------|                 |
    |                       |-- download tarball -->|                 |
    |                       |<-- tarball -----------|                 |
    |                       |-- validate checksum   |                 |
    |                       |-- extract to .kiro/skills/             |
    |                       |-- detect IDE -------->|                 |
    |                       |-- generate config --->|                 |
    |<-- success msg --------|                       |                 |
```

---

## Architecture

### Komponen Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Tool (komerce-skill)                  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Command     │  │  Registry    │  │  Package Manager     │   │
│  │  Parser      │  │  Client      │  │                      │   │
│  │  (Commander) │  │  (npm API)   │  │  - Download          │   │
│  └──────┬───────┘  └──────┬───────┘  │  - Validate          │   │
│         │                 │          │  - Extract           │   │
│         └────────┬────────┘          └──────────┬───────────┘   │
│                  │                              │                │
│         ┌────────▼──────────────────────────────▼────────────┐  │
│         │                  Core Orchestrator                   │  │
│         └────────────────────────┬───────────────────────────┘  │
│                                  │                               │
│         ┌────────────────────────▼───────────────────────────┐  │
│         │                  IDE Adapter Layer                   │  │
│         │                                                      │  │
│         │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐  │  │
│         │  │  Kiro    │ │  Cursor  │ │ Copilot  │ │  JB   │  │  │
│         │  │ Adapter  │ │ Adapter  │ │ Adapter  │ │Adapter│  │  │
│         │  └──────────┘ └──────────┘ └──────────┘ └───────┘  │  │
│         └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   npm Registry     │
                    │  (@komerce-skill)  │
                    └────────────────────┘
```

### Prinsip Arsitektur

- **Plugin-based IDE Adapters**: Setiap IDE adapter adalah modul terpisah yang mengimplementasikan interface `IdeAdapter`. IDE baru dapat ditambahkan tanpa mengubah kode inti.
- **npm sebagai Registry Backend**: Memanfaatkan npm API untuk search, download, versioning, dan auth — tidak ada server custom yang diperlukan.
- **Namespace-to-Package Mapping**: Konversi deterministik dari `fe/vue-2` → `@komerce-skill/fe-vue-2` dilakukan di satu tempat (NamespaceMapper).
- **Validasi Berlapis**: Validasi dilakukan di dua titik — saat publish (oleh Skill_Author) dan saat install (oleh Developer).

---

## Components and Interfaces

### 1. Command Parser

Menggunakan **Commander.js** sebagai framework CLI karena popularitasnya (500M+ weekly downloads), API yang bersih, dan dukungan subcommand yang baik.

```typescript
// src/cli.ts
import { Command } from 'commander';

const program = new Command();
program
  .name('komerce-skill')
  .description('AI Skills Registry CLI')
  .version('1.0.0');

// Subcommands: install, remove, update, list, search, publish, init, info, report, login
```

**Subcommands yang didukung:**

| Command | Deskripsi |
|---|---|
| `install <namespace...>` | Install satu atau lebih skill |
| `remove <namespace>` | Hapus skill dari workspace |
| `update [namespace]` | Update skill (atau semua dengan `--all`) |
| `list [--category <cat>]` | Tampilkan skill terinstall atau per kategori |
| `search <query>` | Cari skill di registry |
| `publish` | Publikasikan skill ke npm |
| `init [--template <ns>]` | Buat kerangka skill baru |
| `info <namespace>` | Tampilkan detail skill |
| `report <namespace>` | Laporkan skill bermasalah |
| `login` | Autentikasi ke npm registry |

### 2. Registry Client

Berkomunikasi dengan npm registry API untuk operasi read (search, info, download).

```typescript
// src/registry/RegistryClient.ts
interface RegistryClient {
  getPackageInfo(packageName: string): Promise<PackageInfo>;
  searchPackages(query: string, scope: string): Promise<SearchResult[]>;
  getDownloadCount(packageName: string): Promise<number>;
  downloadTarball(packageName: string, version: string): Promise<Buffer>;
  getVersions(packageName: string): Promise<string[]>;
}
```

**Endpoint npm yang digunakan:**
- `GET https://registry.npmjs.org/@komerce-skill%2F<name>` — metadata paket
- `GET https://registry.npmjs.org/-/v1/search?text=@komerce-skill+<query>` — pencarian
- `GET https://api.npmjs.org/downloads/point/last-month/@komerce-skill/<name>` — download count
- Tarball URL dari field `dist.tarball` di metadata paket

### 3. Namespace Mapper

Konversi deterministik antara namespace dan nama paket npm.

```typescript
// src/registry/NamespaceMapper.ts
class NamespaceMapper {
  // "fe/vue-2" -> "@komerce-skill/fe-vue-2"
  toPackageName(namespace: string): string {
    const [category, skillName] = namespace.split('/');
    return `@komerce-skill/${category}-${skillName}`;
  }

  // "@komerce-skill/fe-vue-2" -> "fe/vue-2"
  toNamespace(packageName: string): string {
    const name = packageName.replace('@komerce-skill/', '');
    const dashIndex = name.indexOf('-');
    const category = name.substring(0, dashIndex);
    const skillName = name.substring(dashIndex + 1);
    return `${category}/${skillName}`;
  }

  // Validasi format namespace
  isValidNamespace(namespace: string): boolean {
    return /^[a-z0-9-]+\/[a-z0-9-]+$/.test(namespace);
  }
}
```

### 4. Package Manager

Menangani download, validasi, dan ekstraksi Skill_Package.

```typescript
// src/package/PackageManager.ts
interface PackageManager {
  install(namespace: string, options?: InstallOptions): Promise<InstallResult>;
  remove(namespace: string): Promise<void>;
  update(namespace: string): Promise<UpdateResult>;
  updateAll(): Promise<UpdateResult[]>;
  listInstalled(): Promise<InstalledSkill[]>;
  validatePackage(tarball: Buffer): Promise<ValidationResult>;
}
```

**Proses instalasi:**
1. Resolve namespace → package name
2. Fetch metadata dari npm registry
3. Download tarball
4. Validasi checksum (SHA-512 dari npm `dist.integrity`)
5. Validasi ekstensi file (hanya `.md`, `.json`, `.txt`)
6. Ekstrak ke `.kiro/skills/<category>/<skill-name>/`
7. Trigger IDE Adapter untuk generate konfigurasi

### 5. IDE Adapter Layer

Interface yang harus diimplementasikan oleh setiap adapter IDE.

```typescript
// src/adapters/IdeAdapter.ts
interface IdeAdapter {
  readonly name: string;
  readonly configDir: string;  // e.g., ".kiro", ".cursor", ".github"

  // Deteksi apakah IDE ini aktif di workspace
  detect(workspaceRoot: string): Promise<boolean>;

  // Generate file konfigurasi dari skill
  install(skill: InstalledSkill, workspaceRoot: string): Promise<void>;

  // Hapus konfigurasi skill
  remove(skillNamespace: string, workspaceRoot: string): Promise<void>;
}
```

**Implementasi per IDE:**

| IDE | Config Dir | Format File | Lokasi Output |
|---|---|---|---|
| Kiro | `.kiro/` | Markdown (`.md`) | `.kiro/steering/<skill-name>.md` |
| Cursor | `.cursor/` | Markdown (`.md`) | `.cursor/rules/<skill-name>.mdc` |
| GitHub Copilot | `.github/` | Markdown (`.md`) | `.github/instructions/<skill-name>.instructions.md` |
| JetBrains AI | `.idea/` | Markdown (`.md`) | `.idea/ai-rules/<skill-name>.md` |
| Antigravity | `.antigravity/` | Markdown (`.md`) | `.antigravity/skills/<skill-name>.md` |

**Deteksi IDE otomatis** berdasarkan keberadaan direktori konfigurasi:

```typescript
// src/adapters/IdeDetector.ts
class IdeDetector {
  async detectAll(workspaceRoot: string): Promise<IdeAdapter[]> {
    const adapters = [kiroAdapter, cursorAdapter, copilotAdapter, jetbrainsAdapter, antigravityAdapter];
    const detected = await Promise.all(
      adapters.map(async (adapter) => ({
        adapter,
        active: await adapter.detect(workspaceRoot),
      }))
    );
    return detected.filter((d) => d.active).map((d) => d.adapter);
  }
}
```

### 6. Manifest Validator

Validasi file `skill.json` terhadap JSON Schema.

```typescript
// src/validation/ManifestValidator.ts
interface ManifestValidator {
  validate(manifest: unknown): ValidationResult;
  validateForPublish(skillDir: string): Promise<ValidationResult>;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

### 7. Workspace State Manager

Mengelola state skill yang terinstall di workspace (file `skills.lock.json`).

```typescript
// src/workspace/WorkspaceState.ts
interface WorkspaceState {
  getInstalledSkills(): InstalledSkill[];
  addSkill(skill: InstalledSkill): void;
  removeSkill(namespace: string): void;
  updateSkill(namespace: string, newVersion: string): void;
  save(): void;
  load(): void;
}
```

---

## Data Models

### Skill Manifest (`skill.json`)

```typescript
interface SkillManifest {
  // Field wajib
  name: string;           // Format: "<category>/<skill-name>", e.g., "fe/vue-2"
  version: string;        // SemVer, e.g., "1.0.0"
  description: string;    // Deskripsi singkat skill
  author: string;         // Nama atau email author
  license: string;        // SPDX license identifier, e.g., "MIT"
  category: string;       // Kategori, e.g., "fe", "be", "testing"
  targets: IdeTarget[];   // IDE yang didukung
  entrypoint: string;     // Path ke file instruksi utama, e.g., "instructions.md"

  // Field opsional
  dependencies?: string[];  // Namespace skill lain yang dibutuhkan
  keywords?: string[];      // Kata kunci untuk pencarian
  homepage?: string;        // URL dokumentasi
  repository?: string;      // URL repository
}

type IdeTarget = 'kiro' | 'cursor' | 'copilot' | 'jetbrains' | 'antigravity' | 'all';
```

**Contoh `skill.json`:**

```json
{
  "name": "fe/vue-2",
  "version": "1.2.0",
  "description": "AI instructions for Vue 2 development including Options API patterns, Vuex, and Vue Router",
  "author": "komerce-team",
  "license": "MIT",
  "category": "fe",
  "targets": ["kiro", "cursor", "copilot"],
  "entrypoint": "instructions.md",
  "dependencies": [],
  "keywords": ["vue", "frontend", "javascript", "options-api"]
}
```

### npm Package Structure

```
@komerce-skill/fe-vue-2/
├── package.json          # npm manifest (auto-generated dari skill.json)
├── skill.json            # Skill manifest
├── instructions.md       # File instruksi utama (entrypoint)
└── README.md             # Dokumentasi (opsional)
```

**`package.json` yang di-generate:**

```json
{
  "name": "@komerce-skill/fe-vue-2",
  "version": "1.2.0",
  "description": "AI instructions for Vue 2 development",
  "author": "komerce-team",
  "license": "MIT",
  "keywords": ["komerce-skill", "fe", "vue", "ai-skill"],
  "files": ["skill.json", "instructions.md", "README.md"]
}
```

### Installed Skill Record

```typescript
interface InstalledSkill {
  namespace: string;        // e.g., "fe/vue-2"
  packageName: string;      // e.g., "@komerce-skill/fe-vue-2"
  version: string;          // Versi terinstall
  installedAt: string;      // ISO 8601 timestamp
  installDir: string;       // Path relatif, e.g., ".kiro/skills/fe/vue-2"
  manifest: SkillManifest;  // Isi skill.json
}
```

### Workspace Lock File (`.kiro/skills/skills.lock.json`)

```json
{
  "version": "1",
  "skills": {
    "fe/vue-2": {
      "namespace": "fe/vue-2",
      "packageName": "@komerce-skill/fe-vue-2",
      "version": "1.2.0",
      "installedAt": "2025-01-15T10:30:00Z",
      "installDir": ".kiro/skills/fe/vue-2"
    },
    "be/express": {
      "namespace": "be/express",
      "packageName": "@komerce-skill/be-express",
      "version": "2.0.1",
      "installedAt": "2025-01-16T08:00:00Z",
      "installDir": ".kiro/skills/be/express"
    }
  }
}
```

### Search Result

```typescript
interface SearchResult {
  namespace: string;       // e.g., "fe/vue-2"
  packageName: string;     // e.g., "@komerce-skill/fe-vue-2"
  description: string;
  version: string;
  author: string;
  downloads: number;       // Download count bulan terakhir
  keywords: string[];
}
```

### Validation Error

```typescript
interface ValidationError {
  field: string;    // Field yang tidak valid, e.g., "version"
  message: string;  // Penjelasan error
  value?: unknown;  // Nilai yang diberikan (jika ada)
}
```

### Direktori Instalasi Skill

```
<workspace>/
├── .kiro/
│   ├── skills/
│   │   ├── skills.lock.json          # State file
│   │   ├── fe/
│   │   │   └── vue-2/
│   │   │       ├── skill.json
│   │   │       └── instructions.md
│   │   └── be/
│   │       └── express/
│   │           ├── skill.json
│   │           └── instructions.md
│   └── steering/
│       ├── fe-vue-2.md               # Generated by Kiro adapter
│       └── be-express.md
├── .cursor/
│   └── rules/
│       ├── fe-vue-2.mdc              # Generated by Cursor adapter
│       └── be-express.mdc
└── .github/
    └── instructions/
        ├── fe-vue-2.instructions.md  # Generated by Copilot adapter
        └── be-express.instructions.md
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Namespace-to-Package Round Trip

*For any* valid namespace string dengan format `<category>/<skill-name>`, mengkonversi ke nama paket npm kemudian kembali ke namespace harus menghasilkan namespace yang identik dengan input awal.

**Validates: Requirements 2.2**

---

### Property 2: Install Menyimpan File di Lokasi yang Benar

*For any* namespace yang valid, setelah proses instalasi berhasil (dengan mock npm), file `skill.json` dan file entrypoint harus tersimpan di direktori `.kiro/skills/<category>/<skill-name>/` di workspace.

**Validates: Requirements 1.2**

---

### Property 3: Install-Remove Round Trip

*For any* skill yang berhasil diinstall, setelah perintah remove dijalankan, tidak boleh ada file tersisa di direktori `.kiro/skills/<category>/<skill-name>/` dan semua file konfigurasi IDE yang di-generate harus dihapus.

**Validates: Requirements 3.6**

---

### Property 4: Validasi Checksum Paket

*For any* Skill_Package, paket dengan checksum yang valid (sesuai `dist.integrity` dari npm) harus berhasil diinstall, sedangkan paket dengan checksum yang dimodifikasi atau tidak valid harus ditolak sebelum ekstraksi.

**Validates: Requirements 1.7**

---

### Property 5: Instalasi Multi-Skill

*For any* daftar namespace yang valid (1 hingga N skill), setelah perintah install dijalankan, semua skill dalam daftar harus terinstall di lokasi yang benar di workspace.

**Validates: Requirements 1.6**

---

### Property 6: Filter List per Kategori

*For any* daftar skill terinstall yang mengandung berbagai kategori, perintah `list --category <X>` hanya boleh mengembalikan skill yang memiliki kategori `X`, tidak boleh ada skill dari kategori lain dalam hasil.

**Validates: Requirements 2.3**

---

### Property 7: Format Output List Skill

*For any* daftar skill terinstall, output perintah `list` harus mengandung namespace, versi terinstall, versi terbaru yang tersedia, dan status (up-to-date/outdated) untuk setiap skill dalam daftar.

**Validates: Requirements 3.2**

---

### Property 8: Update All Memperbarui Semua Skill Outdated

*For any* workspace dengan daftar skill terinstall (beberapa outdated, beberapa up-to-date), setelah perintah `update --all` dijalankan, semua skill yang sebelumnya outdated harus diperbarui ke versi terbaru.

**Validates: Requirements 3.4**

---

### Property 9: Validasi Field Wajib Manifest

*For any* manifest yang tidak memiliki satu atau lebih field wajib (`name`, `version`, `description`, `author`, `license`, `category`, `targets`, `entrypoint`), validator harus menolaknya dan output error harus mengandung nama semua field yang hilang atau tidak valid beserta alasannya.

**Validates: Requirements 4.2, 4.6**

---

### Property 10: Validasi Format SemVer

*For any* string versi, validator manifest harus menerima string yang sesuai format Semantic Versioning (contoh: `1.0.0`, `2.3.1-beta.1`) dan menolak string yang tidak sesuai (contoh: `v1`, `1.0`, `latest`).

**Validates: Requirements 4.3**

---

### Property 11: Validasi Manifest Sebelum Publish

*For any* Skill_Package, perintah publish hanya boleh melanjutkan ke proses `npm publish` jika dan hanya jika manifest lolos semua validasi schema. Manifest yang tidak valid harus menghentikan proses publish sebelum memanggil npm.

**Validates: Requirements 4.5, 6.2**

---

### Property 12: Deteksi IDE Berdasarkan Direktori Konfigurasi

*For any* kombinasi direktori konfigurasi IDE yang ada di workspace (`.kiro/`, `.cursor/`, `.github/`, `.idea/`, `.antigravity/`), IDE detector harus mengidentifikasi tepat IDE yang direktorinya ada dan tidak mengidentifikasi IDE yang direktorinya tidak ada.

**Validates: Requirements 5.2**

---

### Property 13: IDE Adapter Menghasilkan Config di Lokasi yang Benar

*For any* skill yang diinstall dan *for any* IDE yang terdeteksi di workspace, jika IDE tersebut terdaftar dalam field `targets` skill (atau targets adalah `all`), maka IDE adapter harus menghasilkan file konfigurasi di lokasi yang benar untuk IDE tersebut. Jika IDE tidak terdaftar dalam targets, tidak boleh ada file konfigurasi yang dibuat untuk IDE tersebut.

**Validates: Requirements 5.3, 5.4**

---

### Property 14: Validasi Ekstensi File Paket

*For any* Skill_Package, paket yang mengandung file dengan ekstensi yang tidak diizinkan (bukan `.md`, `.json`, `.txt`) harus ditolak saat instalasi, dan output error harus mengandung daftar semua file bermasalah. Paket yang hanya mengandung file dengan ekstensi yang diizinkan harus diterima.

**Validates: Requirements 8.1, 8.2**

---

### Property 15: Output Search Mengandung Informasi Lengkap

*For any* hasil pencarian dari npm registry, output yang dirender ke terminal harus mengandung namespace, deskripsi singkat, dan jumlah unduhan untuk setiap item hasil pencarian.

**Validates: Requirements 2.5**

---

### Property 16: Output Publish Mengandung URL npm

*For any* Skill_Package yang berhasil dipublikasikan, output CLI harus mengandung URL paket npm yang valid dengan format `https://www.npmjs.com/package/@komerce-skill/<package-name>`.

**Validates: Requirements 6.4**

---

### Property 17: Init Menghasilkan Struktur File Lengkap

*For any* kombinasi input yang valid untuk perintah `init` (nama, kategori, deskripsi, author, targets), proses init harus menghasilkan direktori dengan file `skill.json`, file instruksi Markdown (entrypoint), dan file `package.json` yang semuanya mengandung data dari input yang diberikan.

**Validates: Requirements 7.3**

---

### Property 18: Konsistensi Category di Manifest

*For any* manifest yang valid, nilai field `category` harus identik dengan bagian category dari field `name` (bagian sebelum `/`). Manifest dengan ketidaksesuaian antara `category` dan prefix `name` harus ditolak oleh validator.

**Validates: Requirements 2.6**

---

### Property 19: Informasi Author dan Download Count Ditampilkan Saat Install

*For any* skill yang akan diinstall, sebelum proses download dimulai, CLI harus menampilkan informasi author dan jumlah unduhan bulan terakhir yang diambil dari npm registry.

**Validates: Requirements 8.3**

---

## Error Handling

### Strategi Penanganan Error

Semua error dikategorikan ke dalam tiga level:

| Level | Deskripsi | Contoh |
|---|---|---|
| **Fatal** | Proses berhenti, tidak dapat dilanjutkan | Checksum tidak valid, manifest tidak valid |
| **Warning** | Proses dilanjutkan dengan degradasi | IDE tidak didukung, template tidak ditemukan |
| **Info** | Informasi tambahan untuk pengguna | Skill sudah up-to-date |

### Error Codes

```typescript
enum SkillErrorCode {
  // Registry errors
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  REGISTRY_UNAVAILABLE = 'REGISTRY_UNAVAILABLE',

  // Package errors
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  INVALID_FILE_EXTENSION = 'INVALID_FILE_EXTENSION',
  INVALID_MANIFEST = 'INVALID_MANIFEST',
  MISSING_ENTRYPOINT = 'MISSING_ENTRYPOINT',

  // Auth errors
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  PUBLISH_CONFLICT = 'PUBLISH_CONFLICT',

  // Workspace errors
  SKILL_NOT_INSTALLED = 'SKILL_NOT_INSTALLED',
  WORKSPACE_WRITE_ERROR = 'WORKSPACE_WRITE_ERROR',

  // IDE errors
  IDE_NOT_SUPPORTED = 'IDE_NOT_SUPPORTED',
  IDE_CONFIG_WRITE_ERROR = 'IDE_CONFIG_WRITE_ERROR',
}
```

### Penanganan Error per Skenario

**1. Skill tidak ditemukan di registry:**
```
Error: Skill 'fe/vue-3' tidak ditemukan di registry.

Mungkin maksud Anda:
  - fe/vue-2 (vue 2 instructions)
  - fe/vue-composition (vue composition api)

Gunakan 'npx komerce-skill search vue' untuk melihat semua skill Vue.
```

**2. Checksum tidak valid:**
```
Error: Integritas paket '@komerce-skill/fe-vue-2@1.2.0' gagal diverifikasi.
  Expected: sha512-abc123...
  Received: sha512-xyz789...

Instalasi dibatalkan. Coba lagi atau laporkan masalah ini.
```

**3. Manifest tidak valid saat publish:**
```
Error: Manifest 'skill.json' tidak valid. Publikasi dibatalkan.

Field yang tidak valid:
  - version: "v1.0" bukan format SemVer yang valid (gunakan "1.0.0")
  - targets: nilai "vscode" tidak dikenali (gunakan "copilot")
  - entrypoint: file "guide.md" tidak ditemukan di direktori skill

Perbaiki error di atas dan coba lagi.
```

**4. IDE tidak didukung (warning, bukan fatal):**
```
Warning: IDE 'windsurf' tidak didukung oleh skill 'fe/vue-2'.
  Skill ini mendukung: kiro, cursor, copilot

Instalasi dilanjutkan untuk IDE yang didukung.
```

**5. Belum login saat publish:**
```
Error: Anda belum terautentikasi ke npm registry.

Jalankan perintah berikut untuk login:
  npx komerce-skill login

Kemudian coba publish kembali.
```

### Retry dan Resilience

- **Network errors**: Retry otomatis hingga 3 kali dengan exponential backoff (1s, 2s, 4s) untuk operasi registry.
- **Partial install failure**: Jika instalasi multi-skill gagal di tengah jalan, skill yang sudah berhasil diinstall tetap tersimpan. Error ditampilkan untuk skill yang gagal.
- **IDE config write error**: Jika gagal menulis konfigurasi ke satu IDE, proses dilanjutkan untuk IDE lain. Error ditampilkan sebagai warning.

---

## Testing Strategy

### Pendekatan Pengujian

Sistem ini menggunakan **dual testing approach**:

1. **Unit Tests + Property-Based Tests** — untuk logika inti CLI (validasi, mapping, rendering)
2. **Integration Tests** — untuk interaksi dengan npm registry dan filesystem

### Property-Based Testing

**Library yang digunakan**: [fast-check](https://github.com/dubzzz/fast-check) (TypeScript/JavaScript)

**Konfigurasi**: Minimum 100 iterasi per property test.

**Tag format**: `// Feature: ai-skills-registry, Property <N>: <property_text>`

Setiap property dari bagian Correctness Properties diimplementasikan sebagai satu property-based test:

```typescript
// Contoh implementasi Property 1: Namespace-to-Package Round Trip
// Feature: ai-skills-registry, Property 1: Namespace-to-Package Round Trip
it('namespace round trip', () => {
  fc.assert(
    fc.property(
      fc.tuple(
        fc.stringMatching(/^[a-z][a-z0-9-]*$/),  // category
        fc.stringMatching(/^[a-z][a-z0-9-]*$/)   // skill-name
      ),
      ([category, skillName]) => {
        const namespace = `${category}/${skillName}`;
        const mapper = new NamespaceMapper();
        const packageName = mapper.toPackageName(namespace);
        const roundTripped = mapper.toNamespace(packageName);
        expect(roundTripped).toBe(namespace);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Tests

Unit tests fokus pada:
- Skenario spesifik yang tidak tercakup oleh property tests (error cases, edge cases)
- Integrasi antar komponen (Command Parser → Core Orchestrator → Package Manager)
- Perilaku CLI commands secara end-to-end dengan mock

**Contoh unit tests:**
- Skill tidak ditemukan menampilkan saran yang relevan
- Publish ditolak saat belum login
- Template fallback ke default saat template tidak ditemukan
- `--ide` flag memaksa instalasi ke IDE tertentu

### Integration Tests

Integration tests menggunakan **mock npm registry** (dengan `nock` atau `msw`) untuk menghindari ketergantungan pada jaringan:

```typescript
// Contoh integration test
it('install skill creates files in correct location', async () => {
  // Mock npm registry response
  nock('https://registry.npmjs.org')
    .get('/@komerce-skill%2Ffe-vue-2')
    .reply(200, mockPackageMetadata);

  // Run install
  await cli.run(['install', 'fe/vue-2']);

  // Verify files created
  expect(fs.existsSync('.kiro/skills/fe/vue-2/skill.json')).toBe(true);
  expect(fs.existsSync('.kiro/skills/fe/vue-2/instructions.md')).toBe(true);
});
```

### Test Coverage Targets

| Komponen | Target Coverage |
|---|---|
| NamespaceMapper | 100% |
| ManifestValidator | 100% |
| PackageManager (logika) | 90%+ |
| IDE Adapters | 90%+ |
| Command handlers | 80%+ |

### Test File Structure

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── NamespaceMapper.test.ts
│   │   ├── ManifestValidator.test.ts
│   │   ├── IdeDetector.test.ts
│   │   └── commands/
│   │       ├── install.test.ts
│   │       ├── remove.test.ts
│   │       └── ...
│   ├── property/
│   │   ├── namespace.property.test.ts    # Properties 1, 6, 18
│   │   ├── install.property.test.ts      # Properties 2, 3, 4, 5, 19
│   │   ├── manifest.property.test.ts     # Properties 9, 10, 11
│   │   ├── ide-adapter.property.test.ts  # Properties 12, 13
│   │   ├── package.property.test.ts      # Properties 14
│   │   ├── list.property.test.ts         # Properties 7, 8, 15
│   │   └── publish.property.test.ts      # Properties 16, 17
│   └── integration/
│       ├── install.integration.test.ts
│       ├── publish.integration.test.ts
│       └── search.integration.test.ts
```

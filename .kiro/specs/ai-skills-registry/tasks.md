# Implementation Plan: AI Skills Registry

## Overview

Implementasi CLI tool `komerce-skill` menggunakan TypeScript dan Node.js. Sistem dibangun secara inkremental: dimulai dari fondasi (struktur proyek, tipe data, dan komponen inti), kemudian command-command CLI, lalu IDE adapters, dan diakhiri dengan wiring semua komponen menjadi satu CLI yang berfungsi penuh.

## Tasks

- [x] 1. Setup struktur proyek dan konfigurasi TypeScript
  - Inisialisasi proyek Node.js dengan `package.json` untuk paket `komerce-skill`
  - Konfigurasi `tsconfig.json` dengan target ES2020, module CommonJS, strict mode aktif
  - Install dependensi: `commander`, `fast-check` (dev), `jest` + `ts-jest` (dev), `nock` (dev)
  - Buat struktur direktori: `src/`, `src/registry/`, `src/package/`, `src/adapters/`, `src/validation/`, `src/workspace/`, `src/__tests__/unit/`, `src/__tests__/property/`, `src/__tests__/integration/`
  - Definisikan semua interface dan tipe data di `src/types.ts`: `SkillManifest`, `InstalledSkill`, `SearchResult`, `ValidationResult`, `ValidationError`, `IdeAdapter`, `IdeTarget`, `SkillErrorCode`
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 2. Implementasi NamespaceMapper dan ManifestValidator
  - [x] 2.1 Implementasi `NamespaceMapper` di `src/registry/NamespaceMapper.ts`
    - Implementasi `toPackageName(namespace)`: `"fe/vue-2"` → `"@komerce-skill/fe-vue-2"`
    - Implementasi `toNamespace(packageName)`: `"@komerce-skill/fe-vue-2"` → `"fe/vue-2"`
    - Implementasi `isValidNamespace(namespace)`: validasi format `^[a-z0-9-]+/[a-z0-9-]+$`
    - _Requirements: 2.2_

  - [ ]* 2.2 Tulis property test untuk NamespaceMapper
    - **Property 1: Namespace-to-Package Round Trip**
    - **Validates: Requirements 2.2**
    - File: `src/__tests__/property/namespace.property.test.ts`
    - Tag: `// Feature: ai-skills-registry, Property 1: Namespace-to-Package Round Trip`

  - [x] 2.3 Implementasi `ManifestValidator` di `src/validation/ManifestValidator.ts`
    - Validasi field wajib: `name`, `version`, `description`, `author`, `license`, `category`, `targets`, `entrypoint`
    - Validasi format SemVer pada field `version` (terima `1.0.0`, `2.3.1-beta.1`; tolak `v1`, `1.0`, `latest`)
    - Validasi konsistensi: nilai `category` harus identik dengan prefix `name` (bagian sebelum `/`)
    - Validasi nilai `targets` hanya boleh dari: `kiro`, `cursor`, `copilot`, `jetbrains`, `antigravity`, `all`
    - Return `ValidationResult` dengan daftar `ValidationError` yang lengkap (field, message, value)
    - _Requirements: 4.2, 4.3, 2.6_

  - [ ]* 2.4 Tulis property test untuk ManifestValidator
    - **Property 9: Validasi Field Wajib Manifest**
    - **Property 10: Validasi Format SemVer**
    - **Property 18: Konsistensi Category di Manifest**
    - **Validates: Requirements 4.2, 4.3, 4.6, 2.6**
    - File: `src/__tests__/property/manifest.property.test.ts`

  - [ ]* 2.5 Tulis unit test untuk ManifestValidator
    - Test error message yang deskriptif untuk setiap field yang tidak valid
    - Test manifest valid dengan semua field opsional
    - File: `src/__tests__/unit/ManifestValidator.test.ts`

- [x] 3. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan kepada pengguna jika ada pertanyaan.

- [ ] 4. Implementasi RegistryClient dan WorkspaceState
  - [x] 4.1 Implementasi `RegistryClient` di `src/registry/RegistryClient.ts`
    - Implementasi `getPackageInfo(packageName)`: GET `https://registry.npmjs.org/<encoded-name>`
    - Implementasi `searchPackages(query, scope)`: GET `https://registry.npmjs.org/-/v1/search?text=@komerce-skill+<query>`
    - Implementasi `getDownloadCount(packageName)`: GET `https://api.npmjs.org/downloads/point/last-month/<name>`
    - Implementasi `downloadTarball(packageName, version)`: download dari URL `dist.tarball` di metadata
    - Implementasi `getVersions(packageName)`: ekstrak daftar versi dari metadata paket
    - Implementasi retry otomatis 3 kali dengan exponential backoff (1s, 2s, 4s) untuk semua network error
    - _Requirements: 1.1, 1.4, 1.5, 2.4, 2.5_

  - [x] 4.2 Implementasi `WorkspaceState` di `src/workspace/WorkspaceState.ts`
    - Baca/tulis file `skills.lock.json` di `.kiro/skills/skills.lock.json`
    - Implementasi `getInstalledSkills()`, `addSkill()`, `removeSkill()`, `updateSkill()`, `save()`, `load()`
    - Handle kasus file lock belum ada (workspace baru)
    - _Requirements: 3.1, 3.2_

  - [ ]* 4.3 Tulis unit test untuk WorkspaceState
    - Test load dari file yang ada dan file yang belum ada
    - Test add, remove, update skill dan persistensi ke file
    - File: `src/__tests__/unit/WorkspaceState.test.ts`

- [ ] 5. Implementasi PackageManager
  - [x] 5.1 Implementasi logika validasi dan ekstraksi di `src/package/PackageManager.ts`
    - Implementasi `validatePackage(tarball)`: validasi checksum SHA-512 menggunakan `dist.integrity` dari npm
    - Implementasi validasi ekstensi file: tolak paket yang mengandung file selain `.md`, `.json`, `.txt`
    - Implementasi ekstraksi tarball ke `.kiro/skills/<category>/<skill-name>/`
    - _Requirements: 1.7, 8.1, 8.2_

  - [ ]* 5.2 Tulis property test untuk validasi paket
    - **Property 4: Validasi Checksum Paket**
    - **Property 14: Validasi Ekstensi File Paket**
    - **Validates: Requirements 1.7, 8.1, 8.2**
    - File: `src/__tests__/property/package.property.test.ts`

  - [x] 5.3 Implementasi `install`, `remove`, `update`, `updateAll`, `listInstalled` di `PackageManager`
    - `install`: resolve namespace → fetch metadata → tampilkan author & download count → download → validasi checksum → validasi ekstensi → ekstrak → update WorkspaceState
    - `remove`: hapus direktori `.kiro/skills/<category>/<skill-name>/` → update WorkspaceState
    - `update`: install versi terbaru → update WorkspaceState
    - `updateAll`: iterasi semua skill terinstall, update yang outdated
    - `listInstalled`: baca WorkspaceState, fetch versi terbaru dari registry untuk status up-to-date/outdated
    - _Requirements: 1.2, 1.3, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.3_

  - [ ]* 5.4 Tulis property test untuk install dan remove
    - **Property 2: Install Menyimpan File di Lokasi yang Benar**
    - **Property 3: Install-Remove Round Trip**
    - **Property 5: Instalasi Multi-Skill**
    - **Property 19: Informasi Author dan Download Count Ditampilkan Saat Install**
    - **Validates: Requirements 1.2, 1.6, 3.6, 8.3**
    - File: `src/__tests__/property/install.property.test.ts`

- [x] 6. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan kepada pengguna jika ada pertanyaan.

- [ ] 7. Implementasi IDE Adapter Layer
  - [x] 7.1 Implementasi `IdeDetector` di `src/adapters/IdeDetector.ts`
    - Deteksi IDE berdasarkan keberadaan direktori: `.kiro/` → Kiro, `.cursor/` → Cursor, `.github/` → Copilot, `.idea/` → JetBrains, `.antigravity/` → Antigravity
    - Implementasi `detectAll(workspaceRoot)`: return array adapter yang terdeteksi
    - _Requirements: 5.2_

  - [ ]* 7.2 Tulis property test untuk IdeDetector
    - **Property 12: Deteksi IDE Berdasarkan Direktori Konfigurasi**
    - **Validates: Requirements 5.2**
    - File: `src/__tests__/property/ide-adapter.property.test.ts`

  - [x] 7.3 Implementasi lima IDE adapter di `src/adapters/`
    - `KiroAdapter`: generate `.kiro/steering/<category>-<skill-name>.md`
    - `CursorAdapter`: generate `.cursor/rules/<category>-<skill-name>.mdc`
    - `CopilotAdapter`: generate `.github/instructions/<category>-<skill-name>.instructions.md`
    - `JetBrainsAdapter`: generate `.idea/ai-rules/<category>-<skill-name>.md`
    - `AntigravityAdapter`: generate `.antigravity/skills/<category>-<skill-name>.md`
    - Setiap adapter mengimplementasikan interface `IdeAdapter`: `detect()`, `install()`, `remove()`
    - Adapter hanya generate config jika IDE terdaftar di `targets` skill (atau `targets` mengandung `all`)
    - Tampilkan warning jika IDE terdeteksi tapi tidak ada di `targets` skill
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [ ]* 7.4 Tulis property test untuk IDE adapter
    - **Property 13: IDE Adapter Menghasilkan Config di Lokasi yang Benar**
    - **Validates: Requirements 5.3, 5.4**
    - Lanjutkan di file: `src/__tests__/property/ide-adapter.property.test.ts`

  - [ ]* 7.5 Tulis unit test untuk IDE adapters
    - Test flag `--ide <ide-name>` memaksa instalasi ke IDE tertentu
    - Test warning saat IDE terdeteksi tapi tidak ada di targets
    - File: `src/__tests__/unit/IdeDetector.test.ts`

- [ ] 8. Implementasi Command Handlers
  - [x] 8.1 Implementasi command `install` di `src/commands/install.ts`
    - Parsing argumen: satu atau lebih namespace
    - Support flag `--ide <ide-name>` untuk memaksa IDE tertentu
    - Tampilkan pesan konfirmasi beserta versi setelah instalasi berhasil
    - Tampilkan error deskriptif + saran skill serupa jika skill tidak ditemukan
    - Tampilkan daftar versi tersedia jika versi yang diminta tidak ada
    - Untuk multi-skill: lanjutkan instalasi skill berikutnya jika satu gagal, tampilkan ringkasan di akhir
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [x] 8.2 Implementasi command `remove` di `src/commands/remove.ts`
    - Hapus file skill dari `.kiro/skills/` dan semua file konfigurasi IDE yang di-generate
    - Update WorkspaceState setelah penghapusan
    - _Requirements: 3.5, 3.6_

  - [x] 8.3 Implementasi command `update` di `src/commands/update.ts`
    - Support `update <namespace>` untuk update satu skill
    - Support `update --all` untuk update semua skill
    - _Requirements: 3.3, 3.4_

  - [x] 8.4 Implementasi command `list` di `src/commands/list.ts`
    - Tampilkan namespace, versi terinstall, versi terbaru, dan status (up-to-date/outdated)
    - Support flag `--category <category>` untuk filter per kategori
    - _Requirements: 3.1, 3.2, 2.3_

  - [ ]* 8.5 Tulis property test untuk command list
    - **Property 6: Filter List per Kategori**
    - **Property 7: Format Output List Skill**
    - **Property 8: Update All Memperbarui Semua Skill Outdated**
    - **Validates: Requirements 2.3, 3.2, 3.4**
    - File: `src/__tests__/property/list.property.test.ts`

  - [x] 8.6 Implementasi command `search` di `src/commands/search.ts`
    - Tampilkan namespace, deskripsi singkat, dan jumlah unduhan untuk setiap hasil
    - _Requirements: 2.4, 2.5_

  - [ ]* 8.7 Tulis property test untuk command search
    - **Property 15: Output Search Mengandung Informasi Lengkap**
    - **Validates: Requirements 2.5**
    - File: `src/__tests__/property/list.property.test.ts`

  - [x] 8.8 Implementasi command `info` di `src/commands/info.ts`
    - Tampilkan detail lengkap skill termasuk isi file instruksi
    - _Requirements: 8.4_

  - [x] 8.9 Implementasi command `report` di `src/commands/report.ts`
    - Buka URL issue di repository resmi dengan namespace skill sebagai pre-fill
    - _Requirements: 8.5_

- [x] 9. Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan kepada pengguna jika ada pertanyaan.

- [ ] 10. Implementasi Command Publish, Login, dan Init
  - [x] 10.1 Implementasi command `login` di `src/commands/login.ts`
    - Delegasikan ke `npm login` dengan scope `@komerce-skill`
    - Simpan status autentikasi untuk dicek oleh command `publish`
    - _Requirements: 6.5_

  - [x] 10.2 Implementasi command `publish` di `src/commands/publish.ts`
    - Cek status autentikasi; tolak dan tampilkan instruksi login jika belum terautentikasi
    - Jalankan `ManifestValidator.validateForPublish()`: validasi manifest + semua file yang direferensikan ada
    - Jika validasi gagal, tampilkan daftar error yang deskriptif dan batalkan publish
    - Generate `package.json` dari `skill.json` sebelum publish
    - Jalankan `npm publish --access public` di bawah scope `@komerce-skill`
    - Tampilkan URL paket npm setelah publish berhasil
    - Tolak jika nama+versi sudah ada di registry
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [ ]* 10.3 Tulis property test untuk command publish
    - **Property 11: Validasi Manifest Sebelum Publish**
    - **Property 16: Output Publish Mengandung URL npm**
    - **Validates: Requirements 4.5, 6.2, 6.4**
    - File: `src/__tests__/property/publish.property.test.ts`

  - [x] 10.4 Implementasi command `init` di `src/commands/init.ts`
    - Prompt interaktif untuk field wajib: nama, kategori, deskripsi, author, target IDE
    - Generate struktur direktori: `skill.json`, file instruksi Markdown (entrypoint), `package.json`
    - Support flag `--template <namespace/template-name>`: download template dari registry, fallback ke default dengan warning jika tidak ditemukan
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 10.5 Tulis property test untuk command init
    - **Property 17: Init Menghasilkan Struktur File Lengkap**
    - **Validates: Requirements 7.3**
    - File: `src/__tests__/property/publish.property.test.ts`

  - [ ]* 10.6 Tulis unit test untuk command publish dan login
    - Test publish ditolak saat belum login
    - Test publish ditolak saat nama+versi sudah ada di registry
    - Test template fallback ke default saat template tidak ditemukan
    - File: `src/__tests__/unit/commands/publish.test.ts`

- [ ] 11. Wiring: Rakit CLI utama dan integrasi semua komponen
  - [x] 11.1 Implementasi `src/cli.ts` sebagai entry point CLI
    - Daftarkan semua subcommand ke Commander.js: `install`, `remove`, `update`, `list`, `search`, `publish`, `init`, `info`, `report`, `login`
    - Konfigurasi `bin` di `package.json` agar `komerce-skill` dapat dijalankan via `npx`
    - Hubungkan setiap command handler ke `PackageManager`, `RegistryClient`, `IdeDetector`, dan `WorkspaceState`
    - _Requirements: 1.1, 2.3, 2.4, 3.1, 3.3, 3.5, 6.1, 7.1, 8.4, 8.5_

  - [x] 11.2 Implementasi `Core Orchestrator` di `src/core/Orchestrator.ts`
    - Koordinasikan alur install: `RegistryClient` → `PackageManager` → `IdeDetector` → IDE Adapters → `WorkspaceState`
    - Koordinasikan alur remove: `PackageManager` → IDE Adapters (remove config) → `WorkspaceState`
    - Tangani partial failure pada multi-skill install sesuai strategi error handling
    - _Requirements: 1.2, 1.6, 3.6_

  - [ ]* 11.3 Tulis integration test untuk alur install end-to-end
    - Mock npm registry dengan `nock`
    - Test install satu skill: verifikasi file di `.kiro/skills/` dan konfigurasi IDE ter-generate
    - Test install multi-skill: verifikasi semua skill terinstall
    - File: `src/__tests__/integration/install.integration.test.ts`

  - [ ]* 11.4 Tulis integration test untuk alur publish end-to-end
    - Mock npm registry dengan `nock`
    - Test publish berhasil: verifikasi URL output
    - Test publish gagal karena manifest tidak valid
    - File: `src/__tests__/integration/publish.integration.test.ts`

  - [ ]* 11.5 Tulis integration test untuk alur search end-to-end
    - Mock npm registry dengan `nock`
    - Test search menampilkan namespace, deskripsi, dan download count
    - File: `src/__tests__/integration/search.integration.test.ts`

- [x] 12. Final Checkpoint — Pastikan semua test lulus
  - Pastikan semua test lulus, tanyakan kepada pengguna jika ada pertanyaan.

## Notes

- Task bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirement spesifik untuk keterlacakan
- Property test menggunakan `fast-check` dengan minimum 100 iterasi per property
- Unit test dan property test bersifat komplementer — keduanya diperlukan untuk coverage yang baik
- Integration test menggunakan `nock` untuk mock npm registry agar tidak bergantung pada jaringan
- Checkpoint memastikan validasi inkremental di setiap fase pembangunan

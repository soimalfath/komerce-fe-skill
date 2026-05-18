# Requirements Document

## Introduction

AI Skills Registry adalah sebuah repository terpusat yang menyediakan kumpulan *skill* (kemampuan/instruksi tambahan) untuk AI assistant di berbagai IDE. Skill diorganisir menggunakan sistem namespace berbasis kategori (contoh: `fe/vue-2`, `fe/react-router`, `be/express`) dan dapat diinstall oleh developer melalui npm. Setiap skill berisi instruksi, konteks, atau kemampuan spesifik yang memperluas fungsionalitas AI assistant — misalnya skill untuk framework frontend tertentu, library backend, code review, testing, dan lain-lain.

Skill dipublikasikan sebagai paket npm di bawah scope `@komerce-skill` dan dikelola melalui CLI tool `komerce-skill`.

## Glossary

- **Registry**: npm registry (npmjs.com) yang digunakan sebagai backend distribusi skill dengan scope `@komerce-skill`.
- **Skill**: Paket npm berisi instruksi, prompt, dan metadata yang memperluas kemampuan AI assistant di IDE.
- **Skill_Package**: Satu unit skill yang dapat diinstall, berisi file konfigurasi, instruksi, dan metadata. Dipublikasikan sebagai paket npm dengan format `@komerce-skill/<category>-<name>`.
- **Namespace**: Kategori hierarkis untuk mengelompokkan skill, menggunakan format `<category>/<skill-name>` (contoh: `fe/vue-2`, `be/express`).
- **CLI**: Command Line Interface — alat baris perintah `komerce-skill` untuk mengelola skill.
- **IDE_Adapter**: Komponen yang menerjemahkan skill ke format yang dipahami oleh IDE tertentu.
- **Manifest**: File `skill.json` yang mendefinisikan metadata, dependensi, dan konfigurasi sebuah skill.
- **Developer**: Pengguna yang menginstall dan menggunakan skill di IDE mereka.
- **Skill_Author**: Pengguna yang membuat dan mempublikasikan skill ke registry.
- **Workspace**: Direktori proyek tempat skill diinstall dan diaktifkan.

---

## Requirements

### Requirement 1: Instalasi Skill via npm

**User Story:** Sebagai seorang developer, saya ingin menginstall skill AI melalui CLI `komerce-skill`, sehingga saya dapat dengan mudah menambahkan kemampuan baru ke AI assistant saya tanpa konfigurasi manual yang rumit.

#### Acceptance Criteria

1. THE CLI SHALL menyediakan perintah `npx komerce-skill install <namespace/skill-name>` untuk menginstall skill dari npm registry.
2. WHEN perintah install dijalankan, THE CLI SHALL mengunduh Skill_Package dari npm registry dan menyimpannya di direktori `.kiro/skills/` pada Workspace.
3. WHEN instalasi berhasil, THE CLI SHALL menampilkan pesan konfirmasi beserta versi skill yang terinstall.
4. IF skill yang diminta tidak ditemukan di registry, THEN THE CLI SHALL menampilkan pesan error yang deskriptif beserta saran skill serupa berdasarkan kesamaan nama namespace.
5. IF versi skill yang diminta tidak tersedia, THEN THE CLI SHALL menampilkan daftar versi yang tersedia dari npm registry.
6. THE CLI SHALL mendukung instalasi beberapa skill sekaligus dengan perintah `npx komerce-skill install <skill1> <skill2>`.
7. WHEN skill diinstall, THE CLI SHALL memvalidasi integritas Skill_Package menggunakan checksum npm sebelum mengekstrak file.

---

### Requirement 2: Sistem Namespace dan Kategori Skill

**User Story:** Sebagai seorang developer, saya ingin skill diorganisir berdasarkan kategori dan teknologi, sehingga saya dapat dengan mudah menemukan skill yang relevan untuk stack teknologi yang saya gunakan.

#### Acceptance Criteria

1. THE Registry SHALL mengorganisir skill menggunakan format namespace `<category>/<skill-name>` (contoh: `fe/vue-2`, `fe/react-router`, `be/express`).
2. THE CLI SHALL memetakan namespace `<category>/<skill-name>` ke nama paket npm `@komerce-skill/<category>-<skill-name>` secara otomatis.
3. THE CLI SHALL menyediakan perintah `npx komerce-skill list --category <category>` untuk menampilkan semua skill dalam kategori tertentu.
4. THE CLI SHALL menyediakan perintah `npx komerce-skill search <query>` untuk mencari skill berdasarkan nama, kategori, atau deskripsi.
5. WHEN perintah search dijalankan, THE CLI SHALL menampilkan hasil pencarian beserta namespace, deskripsi singkat, dan jumlah unduhan.
6. THE Manifest SHALL mengandung field `category` yang sesuai dengan namespace skill untuk konsistensi kategorisasi.

---

### Requirement 3: Manajemen Skill (List, Update, Remove)

**User Story:** Sebagai seorang developer, saya ingin mengelola skill yang terinstall di workspace saya, sehingga saya dapat menjaga skill tetap terkini dan menghapus yang tidak diperlukan.

#### Acceptance Criteria

1. THE CLI SHALL menyediakan perintah `npx komerce-skill list` untuk menampilkan semua skill yang terinstall di Workspace beserta versinya.
2. WHEN perintah `list` dijalankan, THE CLI SHALL menampilkan namespace skill, versi terinstall, versi terbaru yang tersedia di npm, dan status (up-to-date / outdated).
3. THE CLI SHALL menyediakan perintah `npx komerce-skill update <namespace/skill-name>` untuk memperbarui skill ke versi terbaru.
4. THE CLI SHALL menyediakan perintah `npx komerce-skill update --all` untuk memperbarui semua skill yang terinstall sekaligus.
5. THE CLI SHALL menyediakan perintah `npx komerce-skill remove <namespace/skill-name>` untuk menghapus skill dari Workspace.
6. WHEN skill dihapus, THE CLI SHALL menghapus semua file terkait skill dari direktori `.kiro/skills/` dan memperbarui konfigurasi IDE_Adapter yang relevan.

---

### Requirement 4: Struktur dan Format Skill Package

**User Story:** Sebagai seorang Skill_Author, saya ingin ada standar format yang jelas untuk membuat skill, sehingga skill yang saya buat dapat digunakan di berbagai IDE tanpa modifikasi tambahan.

#### Acceptance Criteria

1. THE Skill_Package SHALL mengandung file `skill.json` sebagai Manifest yang mendefinisikan metadata skill.
2. THE Manifest SHALL mengandung field wajib: `name`, `version`, `description`, `author`, `license`, `category`, `targets`, dan `entrypoint`.
3. THE Manifest SHALL menggunakan format Semantic Versioning (SemVer) pada field `version`.
4. THE Skill_Package SHALL mengandung minimal satu file instruksi dalam format Markdown (`.md`) yang direferensikan oleh field `entrypoint`.
5. WHEN Skill_Package dipublikasikan ke npm, THE CLI SHALL memvalidasi bahwa Manifest memenuhi skema yang ditetapkan sebelum menjalankan `npm publish`.
6. IF Manifest tidak valid, THEN THE CLI SHALL menolak publikasi dan menampilkan daftar field yang tidak valid beserta alasannya.
7. THE Skill_Package SHALL mendukung field opsional `dependencies` pada Manifest untuk mendefinisikan skill lain yang dibutuhkan.

---

### Requirement 5: Dukungan Multi-IDE

**User Story:** Sebagai seorang developer, saya ingin skill yang sama dapat bekerja di berbagai IDE yang saya gunakan, sehingga saya tidak perlu mengkonfigurasi ulang skill untuk setiap IDE.

#### Acceptance Criteria

1. THE IDE_Adapter SHALL mendukung IDE berikut pada rilis pertama: VS Code (GitHub Copilot), Kiro, Cursor, JetBrains AI Assistant, dan Antigravity.
2. WHEN skill diinstall, THE CLI SHALL mendeteksi IDE yang aktif di Workspace secara otomatis berdasarkan file konfigurasi yang ada (contoh: `.vscode/`, `.kiro/`, `.cursor/`).
3. WHEN IDE terdeteksi, THE IDE_Adapter SHALL menghasilkan file konfigurasi dalam format yang sesuai dengan IDE tersebut di lokasi yang tepat.
4. WHERE Skill_Package mendefinisikan target IDE tertentu pada field `targets`, THE IDE_Adapter SHALL hanya menghasilkan konfigurasi untuk IDE yang terdaftar.
5. IF IDE yang terdeteksi tidak didukung oleh Skill_Package, THEN THE CLI SHALL menampilkan peringatan dan melanjutkan instalasi untuk IDE yang didukung.
6. THE CLI SHALL menyediakan flag `--ide <ide-name>` untuk memaksa instalasi ke IDE tertentu secara manual.
7. WHEN IDE baru ditambahkan ke daftar dukungan, THE IDE_Adapter SHALL dapat dikonfigurasi melalui plugin tanpa mengubah kode inti CLI.

---

### Requirement 6: Publikasi Skill ke npm Registry

**User Story:** Sebagai seorang Skill_Author, saya ingin mempublikasikan skill yang saya buat ke npm registry, sehingga developer lain dapat menemukan dan menggunakan skill tersebut.

#### Acceptance Criteria

1. THE CLI SHALL menyediakan perintah `npx komerce-skill publish` untuk mempublikasikan Skill_Package ke npm registry di bawah scope `@komerce-skill`.
2. WHEN perintah publish dijalankan, THE CLI SHALL memvalidasi Manifest dan semua file yang direferensikan sebelum menjalankan proses publikasi.
3. IF Skill_Package dengan nama dan versi yang sama sudah ada di npm registry, THEN THE CLI SHALL menolak publikasi dan menampilkan pesan error yang menginstruksikan Skill_Author untuk menaikkan versi.
4. WHEN publikasi berhasil, THE CLI SHALL menampilkan URL paket npm yang dapat dibagikan.
5. THE CLI SHALL menyediakan perintah `npx komerce-skill login` untuk autentikasi Skill_Author ke npm registry sebelum dapat mempublikasikan skill.
6. WHILE Skill_Author belum terautentikasi ke npm, THE CLI SHALL menolak perintah publish dan menampilkan instruksi untuk menjalankan `npx komerce-skill login`.

---

### Requirement 7: Inisialisasi Skill Baru

**User Story:** Sebagai seorang Skill_Author, saya ingin ada perintah untuk membuat kerangka skill baru, sehingga saya dapat memulai pembuatan skill dengan cepat tanpa harus membuat struktur file secara manual.

#### Acceptance Criteria

1. THE CLI SHALL menyediakan perintah `npx komerce-skill init` untuk membuat kerangka Skill_Package baru secara interaktif.
2. WHEN perintah init dijalankan, THE CLI SHALL meminta input untuk field Manifest wajib: nama, kategori (namespace), deskripsi, author, dan target IDE.
3. WHEN proses init selesai, THE CLI SHALL menghasilkan struktur direktori standar beserta file `skill.json`, file instruksi contoh dalam format Markdown, dan file `package.json` yang siap dipublikasikan ke npm.
4. THE CLI SHALL menyediakan flag `--template <namespace/template-name>` untuk membuat skill berdasarkan template yang tersedia di registry (contoh: `--template fe/vue-2`).
5. WHEN template yang diminta tidak ditemukan, THE CLI SHALL menggunakan template default dan menampilkan peringatan kepada Skill_Author.

---

### Requirement 8: Keamanan dan Validasi Konten Skill

**User Story:** Sebagai seorang developer, saya ingin memastikan skill yang saya install aman dan tidak mengandung konten berbahaya, sehingga saya dapat menggunakan skill dari pihak ketiga dengan percaya diri.

#### Acceptance Criteria

1. THE CLI SHALL memvalidasi bahwa Skill_Package hanya mengandung file dengan ekstensi yang diizinkan (`.md`, `.json`, `.txt`) sebelum menginstall.
2. IF Skill_Package mengandung file dengan ekstensi yang tidak diizinkan, THEN THE CLI SHALL menolak instalasi dan menampilkan daftar file yang bermasalah.
3. THE CLI SHALL menampilkan informasi author dan jumlah unduhan dari npm registry kepada Developer sebelum menginstall skill baru.
4. THE CLI SHALL menyediakan perintah `npx komerce-skill info <namespace/skill-name>` untuk menampilkan detail lengkap skill sebelum diinstall, termasuk isi file instruksi.
5. THE CLI SHALL menyediakan perintah `npx komerce-skill report <namespace/skill-name>` untuk melaporkan skill yang bermasalah melalui mekanisme issue di repository resmi.

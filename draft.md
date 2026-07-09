# draft.md — PMO Workflow Tool (Tahap 1: Modul Projects)

> Dokumen ini adalah **spec presisi untuk vibecoding**. Tujuannya: setiap halaman, komponen, dan interaksi dijelaskan cukup detail sehingga output AI coding tidak menebak-nebak behavior. Untuk visual/UI (warna, spacing, tipografi, komponen library) → lihat `design.md`. Dokumen ini fokus ke **logic, state, data flow, dan interaksi**.

---

## 0. Ringkasan Aplikasi

Web tool internal PMO untuk mengelola project di 3 divisi, dengan pengalaman inti berupa **Gantt chart interaktif** (ala MS Project) per project: drag-reschedule, baseline vs aktual, milestone, dependency antar fase. Single-role (PM) di tahap ini, tanpa login/RBAC.

**Tech assumption (silakan sesuaikan ke stack yang dipakai):**
- Frontend: React (atau framework pilihanmu) + state management lokal per page (Context/Zustand/dsb — bebas, tidak wajib Redux)
- Data: bisa mulai dari local storage / mock JSON dulu, lalu pindah ke backend/DB nanti — poin pentingnya struktur data di bagian 3 harus konsisten sejak awal
- Library Gantt: pilih library yang **native support drag-resize** (misal `frappe-gantt`, `gantt-task-react`, `dhtmlx-gantt`, atau bikin custom pakai `react-dnd` + SVG kalau mau kontrol penuh) — jangan bangun drag-logic dari nol kalau tidak perlu

---

## 1. Routing & Struktur Halaman

```
/                                → redirect ke /dashboard
/dashboard                       → Dashboard Overview
/projects/hotd1                  → List Project HOTD 1
/projects/hotd2-finance          → List Project HOTD 2 - Finance
/projects/hotd2-nonfinance       → List Project HOTD 2 - Non-Finance
/projects/:divisi/new            → Form Create Project
/projects/:divisi/:projectId     → Detail Project (termasuk Gantt)
/projects/:divisi/:projectId/edit → Form Edit Project
/team-members                    → (opsional) CRUD anggota tim
```

**Sidebar:**
- Item "Dashboard" (selalu terlihat, link langsung)
- Item "Projects" (expandable/collapsible, default collapsed atau expanded — pilih salah satu dan konsisten, simpan state expand/collapse di local state saja, tidak perlu persist)
  - Sub-item: HOTD 1 / HOTD 2 - Finance / HOTD 2 - Non-Finance
  - Active state: sub-item ter-highlight kalau route saat ini match prefix-nya
- Item "Team Members" (opsional, kalau dibangun)

---

## 2. Konvensi Umum (berlaku di semua halaman)

- **Loading state:** setiap fetch data (atau simulasi delay kalau masih mock) tampilkan skeleton/spinner, jangan biarkan layout blank/jump.
- **Empty state:** setiap list (project list, tim, milestone) yang kosong harus punya pesan + CTA yang jelas (bukan cuma "no data").
- **Konfirmasi destruktif:** semua aksi delete/archive WAJIB modal konfirmasi dua langkah (klik delete → modal muncul → user klik confirm lagi). Tidak ada delete langsung sekali klik.
- **Toast/notifikasi:** setiap create/edit/delete berhasil, tampilkan toast singkat ("Project berhasil dibuat", dst). Kalau gagal, toast error dengan pesan yang jelas.
- **Format tanggal:** tampilkan konsisten `DD MMM YYYY` (misal `12 Jul 2026`) di seluruh aplikasi. Input tetap pakai date picker native/library, bukan text manual.
- **Format persen:** progress selalu dibulatkan ke integer, ditampilkan dengan simbol `%`.

---

## 3. Data Model (Definitif — jangan menyimpang saat implementasi)

```ts
type Divisi = "HOTD1" | "HOTD2_FINANCE" | "HOTD2_NONFINANCE";

type ProjectStatus =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "AT_RISK"
  | "DELAYED"
  | "ON_HOLD"
  | "COMPLETED";

type PhaseKey =
  | "discovery"
  | "development"
  | "testing"
  | "uat"
  | "goLive"
  | "supportGoLive";

type PhaseStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

interface PhaseData {
  start: string | null;        // ISO date, null kalau belum diisi
  end: string | null;
  baselineStart: string | null; // di-set SEKALI saat pertama kali start diisi, tidak berubah lagi kecuali reset manual
  baselineEnd: string | null;
  status: PhaseStatus;          // auto-derive dari tanggal (lihat bag. 6.5), bisa di-override manual
  statusManualOverride: boolean; // true kalau PM pernah override manual, supaya auto-derive tidak menimpa lagi
}

interface Milestone {
  id: string;
  nama: string;
  tanggal: string; // ISO date
}

interface TeamAssignment {
  BPA: string[];   // array of TeamMember.id
  DEV: string[];
  PQA: string[];
  // role lain bisa ditambah sebagai key baru di objek ini
}

interface Project {
  id: string;
  divisi: Divisi;
  nama: string;
  deskripsi: string;
  status: ProjectStatus;
  progress: number;              // 0-100
  progressMode: "manual" | "auto";
  tim: TeamAssignment;
  timeline: Record<PhaseKey, PhaseData>;
  milestones: Milestone[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  nama: string;
  role: string; // "BPA" | "DEV" | "PQA" | custom
  isActive: boolean;
}
```

**Urutan fase tetap dan tidak bisa diubah urutannya oleh user:**
`discovery → development → testing → uat → goLive → supportGoLive`

---

## 4. Halaman: List Project per Divisi

### 4.1 Layout
Table, kolom (urutan default):
1. Nama Project (klik → ke detail)
2. Status (badge berwarna, lihat mapping warna di `design.md`)
3. Fase Aktif (dihitung, lihat 4.3)
4. Progress (progress bar mini + angka %)
5. Tanggal Mulai (= `timeline.discovery.start`)
6. Target Selesai (= `timeline.supportGoLive.end`)
7. Jumlah Anggota Tim (total unik across semua role)
8. Action (icon edit, icon delete)

### 4.2 Filter & Sort
- Filter dropdown: Status (multi-select), Fase Aktif (single-select)
- Search box: filter by substring nama project (case-insensitive), debounce 300ms
- Sort: klik header kolom Nama / Progress / Target Selesai untuk toggle asc/desc
- State filter/sort **tidak perlu persist** ke storage, cukup reset tiap kali masuk halaman

### 4.3 Logic "Fase Aktif"
Hitung di frontend (atau computed field), berdasarkan tanggal hari ini:
```
untuk setiap fase secara urutan:
  jika today berada di antara fase.start dan fase.end → itu fase aktif
jika tidak ada yang match:
  jika today < discovery.start → tampilkan "Belum Mulai"
  jika today > supportGoLive.end → tampilkan "Selesai"
  jika di antara dua fase yang datanya kosong/belum diisi → tampilkan "Menunggu Update Timeline"
```

### 4.4 Tombol "+ Create New Project"
Selalu ada di kanan atas halaman, redirect ke `/projects/:divisi/new` dengan `divisi` sudah ter-preset sesuai halaman saat ini (tidak bisa diubah di form).

### 4.5 Empty state
Kalau divisi belum punya project sama sekali: ilustrasi/icon + teks "Belum ada project di divisi ini" + tombol Create langsung di tengah halaman.

---

## 5. Halaman: Create / Edit Project

### 5.1 Field & Validasi

| Field | Validasi |
|---|---|
| Nama Project | required, min 3 karakter, max 100 karakter |
| Deskripsi | optional, max 500 karakter, tampilkan counter sisa karakter |
| Status | required, default `NOT_STARTED` saat create |
| Progress | jika `progressMode = manual`: input number 0-100, default 0. Jika `auto`: field ini read-only, tampilkan angka hasil kalkulasi (lihat 6.6), dengan label kecil "dihitung otomatis" |
| progressMode | toggle/switch di form, default `manual`. Kalau user switch ke `auto`, tampilkan konfirmasi kecil ("progress akan dihitung otomatis dari timeline, input manual diabaikan") |
| Tim Terlibat | optional saat create (boleh kosong dulu, diisi belakangan), lihat bagian 7 |
| Timeline SDLC | optional saat create (boleh kosong dulu), lihat bagian 6 |

### 5.2 Behavior
- **Create:** semua field kosong/default. Setelah submit sukses → toast sukses → redirect ke `/projects/:divisi/:newProjectId` (langsung ke detail, BUKAN balik ke list — supaya PM bisa langsung lanjut isi timeline & tim kalau belum diisi saat create).
- **Edit:** pre-fill semua field dari data existing. Setelah submit sukses → toast sukses → redirect ke `/projects/:divisi/:projectId` (detail).
- **Cancel/Back:** tombol batal → kalau ada perubahan yang belum disave, munculkan modal konfirmasi "yakin batal? perubahan akan hilang" sebelum navigasi keluar.
- **Delete** (hanya muncul di mode Edit, bukan Create): tombol delete → modal 2 langkah → pilih "Archive" (soft delete, default/direkomendasikan) atau "Hapus Permanen" (hard delete, dengan warning tambahan "tidak bisa dikembalikan"). Setelah aksi, redirect ke list project divisi terkait.

### 5.3 Reusability
Form Create dan Edit adalah **satu komponen** yang menerima prop/mode (`mode: "create" | "edit"`, `initialData?: Project`). Jangan duplikasi komponen.

---

## 6. Timeline SDLC & Gantt Chart (Komponen Inti)

### 6.1 Sub-komponen: Tabel Input Tanggal
Ditampilkan sebagai bagian dari form project (section terpisah, bisa collapsible), berisi 6 baris (satu per fase, urutan tetap), tiap baris:
- Nama fase (read-only label)
- Date picker "Tanggal Mulai"
- Date picker "Tanggal Selesai"
- Badge status fase (auto atau manual override, lihat 6.5)

**Behavior saat isi tanggal pertama kali (baseline capture):**
```
saat user mengisi phase.start untuk PERTAMA KALI (baselineStart masih null):
  set baselineStart = start yang baru diinput
saat user mengisi phase.end untuk PERTAMA KALI (baselineEnd masih null):
  set baselineEnd = end yang baru diinput
perubahan tanggal SETELAHNYA tidak mengubah baseline, kecuali user klik tombol eksplisit "Reset Baseline" (letakkan di detail project, bukan form, dengan warning konfirmasi)
```

### 6.2 Sub-komponen: Gantt Chart (di halaman Detail Project)
Ditampilkan setelah minimal satu fase punya start & end terisi.

**Elemen visual (behavior, bukan styling):**
- Sumbu X: bulan, rentang auto dari `min(start semua fase)` sampai `max(end semua fase)`, dibulatkan ke awal/akhir bulan biar rapi
- Satu bar horizontal per fase, urutan vertikal tetap sesuai urutan fase (discovery paling atas)
- Bar aktual (warna solid) + bar baseline (warna pudar/outline, digambar di belakang atau di atas bar aktual dengan offset kecil) — HANYA ditampilkan kalau baseline berbeda dari aktual (kalau sama, tidak perlu render dua bar overlap)
- Garis vertikal "Today" menandai tanggal hari ini, dengan label tanggal kecil di atasnya
- Milestone: render sebagai marker diamond/titik di baris terpisah paling atas atau paling bawah (bukan menimpa bar fase), dengan tooltip nama milestone saat hover
- Tooltip saat hover bar fase: nama fase, tanggal mulai-selesai aktual, tanggal baseline (kalau beda), status fase

### 6.3 Interaksi Drag (WAJIB, ini fitur inti)
- **Drag tengah bar** → geser seluruh fase (start & end bergeser sama jumlah hari), tidak mengubah durasi
- **Drag ujung kiri bar** → ubah tanggal mulai saja (resize), durasi berubah
- **Drag ujung kanan bar** → ubah tanggal selesai saja (resize), durasi berubah
- Selama drag, tampilkan tooltip live menunjukkan tanggal yang akan di-set
- Setelah drop, update state project (sinkron otomatis ke tabel input di form — dua arah, real time, tidak perlu refresh/reload)
- Snap ke hari (bukan snap ke minggu/bulan), granularitas harian

### 6.4 Cascade Dependency (default ON, bisa dimatikan)
Saat tanggal mulai suatu fase berubah (baik lewat drag maupun input manual) DAN tanggal baru itu bertabrakan dengan fase sebelumnya (start fase baru < end fase sebelumnya):
```
munculkan modal pilihan:
  Opsi 1: "Geser fase-fase setelahnya" → semua fase setelah fase yang diubah ikut bergeser
          sejumlah selisih hari, mempertahankan durasi masing-masing fase
  Opsi 2: "Biarkan, saya atur manual" → tidak ada perubahan otomatis ke fase lain,
          tapi tampilkan warning badge kecil di fase-fase yang jadi overlap
```
Simpan preferensi ini per-aksi saja (tidak perlu setting global), setiap kali terjadi konflik tampilkan modal ini lagi.

### 6.5 Status Fase (Auto-derive)
```
jika statusManualOverride == false:
  jika today < start atau start == null → status = NOT_STARTED
  jika today >= start dan today <= end → status = IN_PROGRESS
  jika today > end → status = DONE
jika statusManualOverride == true:
  pakai nilai yang di-set manual oleh PM, jangan dihitung ulang otomatis
```
PM bisa override manual lewat dropdown kecil di setiap baris fase (di tabel input atau di tooltip Gantt) — begitu di-override, set `statusManualOverride = true` untuk fase itu.

### 6.6 Progress Auto-Calculate (kalau `progressMode = "auto"`)
```
totalFase = 6
faseSelesai = jumlah fase dengan status DONE
progress = round((faseSelesai / totalFase) * 100)
```
*(Sederhana by design — dihitung dari jumlah fase selesai, bukan dari proporsi durasi, supaya predictable dan tidak butuh weighting rumit di tahap awal. Bisa diperhalus nanti kalau perlu.)*

### 6.7 Milestone — CRUD
Di halaman detail project, section kecil terpisah dari tabel fase:
- Tombol "+ Tambah Milestone" → modal kecil: input nama + date picker
- List milestone yang sudah ada, tiap item bisa diedit (klik) atau dihapus (icon, tanpa perlu modal konfirmasi karena risikonya rendah — cukup satu klik dengan undo toast 5 detik)

### 6.8 Validasi Timeline
- `end` tidak boleh sebelum `start` pada fase yang sama → block submit, tampilkan error inline di field terkait
- Kalau ada gap kosong antar fase (misal development.end jauh sebelum testing.start) → tidak di-block, tapi tampilkan warning badge non-intrusive di Gantt ("ada jeda X hari sebelum fase ini")
- Kalau fase sudah lewat tanggal selesai tapi status masih IN_PROGRESS (manual override) → tampilkan badge kuning "Berpotensi Delay" di baris fase tsb DAN di card project di halaman list (indikator kecil, tidak mengubah status project secara otomatis)

### 6.9 Task-Level WBS (Work Breakdown Structure)

Konsep

Tiap fase (Discovery, Development, dst) bisa punya breakdown task di dalamnya. Beda dari
fase yang tanggalnya diisi manual, tanggal task dihitung otomatis dari durasi (mandays)
dan predecessor — mirip Smartsheet/MS Project, bukan input manual.

Data Model Tambahan

tstype TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

interface Task {
  id: string;
  phaseKey: PhaseKey;          // task ini milik fase yang mana
  nama: string;
  durationMandays: number;     // dalam hari kerja, boleh desimal (misal 0.5)
  predecessorIds: string[];    // id Task lain — HANYA task di fase yang SAMA (lihat catatan)
  start: string | null;        // COMPUTED, jangan diisi manual
  end: string | null;          // COMPUTED, jangan diisi manual
  status: TaskStatus;
  statusManualOverride: boolean;
  order: number;                // urutan tampil untuk task tanpa predecessor
  assigneeId?: string;          // optional, TeamMember id
}

Project.timeline[phaseKey] tetap seperti sekarang, TAPI ditambah:

tsinterface PhaseData {
  // ...field yang sudah ada (start, end, baselineStart, dst)
  tasks: Task[];   // BARU — kalau array ini kosong, fase pakai tanggal manual seperti sekarang
}

Aturan Kunci


Rollup otomatis: kalau tasks.length > 0, maka phase.start = MIN(task.start) dan
phase.end = MAX(task.end) — dihitung otomatis, field manual start/end fase jadi
read-only / disembunyikan untuk fase yang punya task. Fase tanpa task tetap manual
seperti sekarang (backward compatible).
Perhitungan tanggal task:

Kalau task tidak punya predecessor: start = tanggal yang di-set user secara
eksplisit lewat date picker (task pertama di suatu fase butuh starting point manual),
ATAU default ke tanggal hari ini kalau belum pernah di-set.
Kalau task punya 1+ predecessor: start = MAX(end semua predecessor) + 1 hari kerja
end = start + (durationMandays - 1) dihitung dalam hari kerja (Senin-Jumat,
skip Sabtu-Minggu). Durasi 1 manday = start dan end di hari yang sama.
Tidak ada kalender hari libur nasional di tahap ini (asumsi: cuma exclude weekend).



Predecessor scope: predecessor hanya boleh task lain DALAM FASE YANG SAMA
(bukan cross-phase). Ini simplifikasi disengaja untuk MVP — kalau nanti butuh
dependency antar fase yang lebih granular, itu jadi iterasi berikutnya.
Dependency type: hanya Finish-to-Start (task mulai setelah predecessor selesai).
Tidak perlu Start-to-Start/Finish-to-Finish/dst di tahap ini.
Cascade recompute: setiap kali durationMandays atau predecessorIds suatu task
berubah, semua task yang bergantung padanya (langsung maupun berantai) HARUS
di-recompute otomatis, real-time, tanpa perlu refresh.
Validasi circular dependency: block save kalau predecessor yang dipilih akan
membentuk siklus (misal Task A → predecessor Task B → predecessor Task A). Tampilkan
error jelas, jangan silent fail.
Hapus task: kalau task yang dihapus adalah predecessor task lain, task-task yang
bergantung itu otomatis re-compute (predecessor yang hilang dianggap tidak ada lagi —
kalau masih ada predecessor lain, pakai itu; kalau predecessor yang dihapus itu
satu-satunya, task jadi butuh start date manual lagi seperti task tanpa predecessor).


UI Behavior


Di Gantt chart, setiap baris fase bisa expand/collapse untuk menampilkan/menyembunyikan
task-tasknya (indented di bawah bar fase, bar lebih kecil/tipis dari bar fase).
Tombol "+ Add Task" muncul di tiap fase (baik di Gantt maupun di tabel input),
langsung menambah task baru ke fase tersebut.
Form/row tiap task: nama, input durationMandays (number), multi-select predecessor
(dropdown hanya berisi task lain di fase yang sama), start & end (READ-ONLY, hasil
komputasi), status.
Ubah duration atau predecessor → tanggal ter-update otomatis di UI seketika (sesuai
konvensi auto-save yang sudah ada di section 9).
Task status auto-derive sama seperti fase (berdasarkan tanggal vs hari ini), bisa
manual override sama seperti pola di section 6.5.


Yang TIDAK termasuk di tahap ini (deliberately out of scope)


Kalender hari libur/cuti custom
Dependency type selain Finish-to-Start
Predecessor lintas fase
Resource leveling / conflict detection antar assignee
Critical path highlight untuk level task (baru ada di level fase, opsional, section 9.5)


## 6.10 Cross-Phase Predecessor & Custom Holiday Calendar

### Bagian A — Cross-Phase Predecessor

**Perubahan dari 6.9:** predecessor task **tidak lagi dibatasi ke fase yang sama** —
task boleh punya predecessor dari task di fase manapun dalam project yang sama.

**Alasan:** project real nggak selalu murni waterfall. Contoh: task "Setup environment
testing" di fase Testing bisa mulai duluan begitu task "API selesai" di fase Development
kelar, tanpa harus nunggu SEMUA task Development selesai dulu.

#### Aturan

1. **Scope predecessor:** task boleh pilih predecessor dari task manapun di project yang
   sama, LINTAS FASE, kecuali dirinya sendiri.
2. **Urutan fase TIDAK dipaksa:** predecessor boleh dari fase sebelumnya, fase yang sama,
   atau bahkan fase setelahnya (kasus ini jarang tapi tidak diblokir — cukup tampilkan
   warning non-blocking "predecessor ini berasal dari fase setelah fase task ini, cek
   lagi urutannya" kalau kejadian).
3. **Cycle detection jadi PROJECT-WIDE**, bukan per-fase lagi — `wouldCreateCycle` harus
   mengecek seluruh graph dependency di project, bukan cuma dalam 1 fase.
4. **Cascade recompute** (6.9 poin 5) tetap berlaku, tapi sekarang scope-nya ke seluruh
   project — perubahan tanggal 1 task bisa mempengaruhi task di fase lain.
5. **Rollup fase (6.9 aturan 1) tidak berubah** — `phase.start`/`phase.end` tetap dihitung
   dari MIN/MAX task **milik fase itu sendiri saja**, meskipun task tersebut punya
   predecessor dari fase lain.

#### UI Behavior

- Dropdown predecessor sekarang menampilkan task **dikelompokkan per fase** (bukan flat
  list), misal:
  ```
  Development
    ☐ Setup API
    ☐ Build endpoint auth
  Testing
    ☐ Write test cases
  ```
- Search/filter tetap ada, mencari across semua fase sekaligus.
- Kalau predecessor yang dipilih berasal dari fase setelah fase task ini sendiri,
  tampilkan warning badge kecil di chip predecessor tersebut (bukan blocking, sesuai
  poin 2 di atas).

---

### Bagian B — Kalender Libur Custom

**Perubahan dari 6.9:** perhitungan hari kerja (working days) sekarang exclude bukan
cuma Sabtu-Minggu, tapi juga tanggal-tanggal yang di-set sebagai hari libur custom
(misal libur nasional, cuti bersama).

#### Data Model Tambahan

```ts
interface Holiday {
  id: string;
  tanggal: string;   // ISO date
  nama: string;       // misal "Hari Kemerdekaan", "Cuti Bersama Lebaran"
}
```

- Disimpan sebagai koleksi **terpisah dan global** (bukan per-project) — sekali di-set,
  berlaku untuk semua project, karena ini representasi hari libur perusahaan/nasional,
  bukan spesifik ke satu project.
- Seed data awal: boleh kosong, atau isi contoh 2-3 tanggal libur nasional Indonesia
  tahun berjalan untuk testing.

#### Aturan

1. **`addWorkingDays` dan `computeEndDate` (dari 6.9) di-update**: selain skip
   Sabtu-Minggu, sekarang juga skip tanggal manapun yang ada di koleksi `Holiday`.
2. **Semua task yang datanya dihitung dari fungsi ini otomatis ikut ter-exclude** —
   tidak perlu perubahan di level Task, cukup ubah di fungsi kalkulasinya (satu tempat).
3. **Perubahan holiday (tambah/hapus) HARUS trigger recompute** semua task yang
   tanggalnya bergantung pada perhitungan working-day (cascade ulang, sama seperti kalau
   duration/predecessor berubah).

#### UI — Halaman/Section Kelola Holiday

- Halaman baru sederhana (mirip pola Team Members): `/holidays` atau section di
  settings, berisi:
  - List holiday yang sudah ada (tanggal + nama), sort by tanggal
  - Tombol "+ Add Holiday" → input tanggal + nama
  - Delete per item (dengan modal konfirmasi ringan, sama pola dengan delete lain di app)
- **Opsional (nice-to-have):** render tanggal libur di Gantt chart sebagai garis/shading
  vertikal tipis, biar keliatan visual kenapa suatu task "melompat" tanggalnya.

---

### Yang TIDAK termasuk (tetap out of scope)
- Kalender libur yang beda per divisi/region (semua divisi pakai kalender yang sama)
- Recurring holiday rules (misal "setiap Jumat terakhir bulan") — semua holiday di-input
  manual per tanggal
- Dependency type selain Finish-to-Start (masih sama seperti 6.9)

---

### Catatan Implementasi (untuk AI)

Fitur ini dibangun DI ATAS section 6.9 yang sudah stabil dan ter-verifikasi. Karena
riwayat project ini sempat ada beberapa bug di predecessor logic sebelum akhirnya
stabil, disarankan:
- Jangan ubah struktur data Task yang sudah ada, cukup ubah SCOPE predecessor yang
  diizinkan (dari same-phase ke project-wide) dan tambah lookup ke Holiday saat kalkulasi
- Re-test ulang skenario dasar (task tanpa predecessor, task dengan predecessor,
  circular dependency check) SETELAH perubahan ini, karena mengubah scope predecessor
  berpotensi mempengaruhi logic yang sudah jalan

---

## 7. Tim Terlibat

### 7.1 Data Master (Seed, tahap 1)
Buat file/koleksi seed berisi minimal 8-10 dummy anggota tim tersebar di role BPA/DEV/PQA, dipakai sebagai data awal. Kalau halaman Team Members dibangun, seed ini jadi initial state yang bisa ditambah/edit dari situ.

### 7.2 Section di Form Project
- Tiga (atau lebih) sub-section berdasarkan role: BPA, DEV, PQA
- Tiap sub-section: multi-select dropdown (searchable) menampilkan nama dari `TeamMember` yang `isActive == true` dan `role` cocok
- Setelah dipilih, tampil sebagai chip/tag dengan tombol remove (x) di sampingnya
- Tidak ada batas maksimum jumlah orang per role

### 7.3 Tampilan di Detail Project
- List nama dikelompokkan per role (bukan flat list), format: label role + daftar nama
- Kalau kosong untuk suatu role, tampilkan "Belum ada" bukan section hilang total (supaya PM ingat masih perlu diisi)

### 7.4 Workload Indicator (opsional, bangun kalau sempat)
Saat memilih nama di dropdown assign, tampilkan badge kecil di sebelah nama: jumlah project aktif (status bukan `COMPLETED`/`ON_HOLD`) di mana orang itu sudah ter-assign di role manapun, across semua divisi.

---

## 8. Dashboard Overview

### 8.1 Data Aggregation (dihitung di frontend dari seluruh project across 3 divisi)
- Total project (exclude yang `isArchived == true`)
- Breakdown jumlah per divisi (3 angka)
- Distribusi status: hitung jumlah project per `ProjectStatus`, render sebagai chart (bar atau pie — pilih salah satu, bar direkomendasikan kalau ingin breakdown per divisi di dalamnya/stacked)
- Rata-rata progress: `average(progress)` semua project non-archived, tampilkan juga breakdown rata-rata per divisi
- List "Perlu Perhatian": semua project dengan status `AT_RISK` atau `DELAYED`, sort by `updatedAt` descending, tampilkan max 10 dengan link "lihat semua" kalau lebih
- Timeline gabungan bulan ini: semua project yang punya fase `goLive` aktif di bulan berjalan (start <= akhir bulan ini AND end >= awal bulan ini), tampilkan sebagai list ringkas (nama project, divisi, tanggal go-live)

### 8.2 Refresh
Data dashboard di-compute setiap kali halaman dimuat/di-navigate ke, tidak perlu real-time/polling di tahap ini.

---

## 9. Aturan Global Tambahan

- Semua computed value (fase aktif, status auto-derive, progress auto) dihitung ulang setiap render/load, JANGAN disimpan sebagai cached value yang bisa stale — kecuali baseline & assignment yang memang harus persist.
- Semua interaksi drag/resize di Gantt harus optimistic-update di UI (langsung terlihat berubah saat drag, tidak menunggu "save" terpisah) — anggap semua perubahan di halaman detail project auto-save per field (bukan satu tombol "Save" besar), KECUALI form Create/Edit yang tetap pakai tombol submit eksplisit.

  > *(Rasionalnya: MS Project juga auto-save tiap perubahan Gantt. Tapi form Create/Edit tetap eksplisit submit karena mengandung banyak field sekaligus dan perlu validasi utuh sebelum disimpan.)*

---

## 10. Seed Data Contoh (untuk mulai development)

```json
{
  "teamMembers": [
    { "id": "tm1", "nama": "Andi Pratama", "role": "BPA", "isActive": true },
    { "id": "tm2", "nama": "Budi Santoso", "role": "DEV", "isActive": true },
    { "id": "tm3", "nama": "Citra Dewi", "role": "DEV", "isActive": true },
    { "id": "tm4", "nama": "Dian Permata", "role": "PQA", "isActive": true },
    { "id": "tm5", "nama": "Eka Wijaya", "role": "BPA", "isActive": true },
    { "id": "tm6", "nama": "Fajar Nugroho", "role": "DEV", "isActive": true },
    { "id": "tm7", "nama": "Gita Ayu", "role": "PQA", "isActive": true },
    { "id": "tm8", "nama": "Hendra Kusuma", "role": "DEV", "isActive": true }
  ],
  "projects": [
    {
      "id": "p1",
      "divisi": "HOTD1",
      "nama": "Migrasi Sistem Approval",
      "deskripsi": "Migrasi alur approval dari sistem lama ke platform baru",
      "status": "ON_TRACK",
      "progress": 40,
      "progressMode": "manual",
      "tim": { "BPA": ["tm1"], "DEV": ["tm2", "tm3"], "PQA": ["tm4"] },
      "timeline": {
        "discovery": { "start": "2026-05-01", "end": "2026-05-15", "baselineStart": "2026-05-01", "baselineEnd": "2026-05-15", "status": "DONE", "statusManualOverride": false },
        "development": { "start": "2026-05-16", "end": "2026-06-30", "baselineStart": "2026-05-16", "baselineEnd": "2026-06-20", "status": "IN_PROGRESS", "statusManualOverride": false },
        "testing": { "start": "2026-07-01", "end": "2026-07-15", "baselineStart": "2026-06-21", "baselineEnd": "2026-07-05", "status": "NOT_STARTED", "statusManualOverride": false },
        "uat": { "start": null, "end": null, "baselineStart": null, "baselineEnd": null, "status": "NOT_STARTED", "statusManualOverride": false },
        "goLive": { "start": null, "end": null, "baselineStart": null, "baselineEnd": null, "status": "NOT_STARTED", "statusManualOverride": false },
        "supportGoLive": { "start": null, "end": null, "baselineStart": null, "baselineEnd": null, "status": "NOT_STARTED", "statusManualOverride": false }
      },
      "milestones": [
        { "id": "m1", "nama": "Sign-off Development", "tanggal": "2026-06-30" }
      ],
      "isArchived": false,
      "createdAt": "2026-04-20T00:00:00Z",
      "updatedAt": "2026-07-01T00:00:00Z"
    }
  ]
}
```
*(Contoh ini sengaja punya baseline development yang beda dari aktual, supaya saat build Gantt kamu langsung bisa test render bar baseline-vs-aktual.)*

---

## 11. Urutan Build (Disesuaikan dengan Kompleksitas Baru)

1. Setup routing + sidebar (halaman kosong)
2. Data layer: model + seed data + basic CRUD functions (mock/local dulu)
3. List project per divisi (table, filter, sort, search)
4. Form Create/Edit (field dasar dulu: nama, deskripsi, status, progress manual)
5. Detail project page (layout dasar, belum ada Gantt)
6. Tabel input timeline + validasi dasar
7. Gantt chart versi statis (render saja, belum drag)
8. Gantt drag-to-reschedule + sync dua arah ke tabel
9. Baseline capture logic + render baseline bar
10. Cascade dependency modal
11. Milestone CRUD + render di Gantt
12. Today marker
13. Tim terlibat: assignment + tampilan grouped
14. Progress auto-calculate mode + toggle
15. Delete/Archive flow
16. Dashboard overview (semua widget)
17. Nice-to-have terakhir: workload indicator, critical path highlight

---

**Catatan:** dokumen ini boleh direvisi sambil jalan kalau ketemu constraint teknis di lapangan (misal keterbatasan library Gantt yang dipilih) — tapi struktur data di bagian 3 sebaiknya dijaga stabil karena semua fitur lain bergantung padanya.
# 📎 Paperclip AI — Commerce Edition (Preview & Rangkuman Tampilan)

Selamat datang di antarmuka baru **Paperclip Commerce Edition**. Desain sistem UI telah dirombak agar lebih **bersih, fungsional, dan minimalis** mengadopsi standar visual Paperclip AI asli serta estetika Linear.

---

## 🌐 Cara Mengakses Live Preview

Server Next.js dan API backend telah berjalan di latar belakang:
- **Port 3000 (`Website`)**: Antarmuka dashboard web utama. Anda dapat melihat tab **Live Preview** di atas jendela browser atau panel samping Arena.ai.
- **Port 4000 (`API Server`)**: Layanan orkestrasi model AI & pipeline e-commerce.

---

## 🎨 Detail Perubahan UI

### 1. Palet Warna & Visual Hierarchy (Linear-Style Dark System)
- **Background Utama**: Deep Void Canvas `#090a0f` menggantikan warna slate standar.
- **Sidebar Background**: Dense Surface `#0d0e12` dengan pembatas halus `rgba(255, 255, 255, 0.06)`.
- **Accent Color**: Iris / Indigo `#5e6ad2` dan `#828fff` untuk tombol aksi utama, indikator aktif, dan status penting.
- **Borders & Dividers**: Menggunakan hairline border berbasis transparansi putih rendah (`0.06 - 0.12`) tanpa drop shadow tebal yang mengganggu.

---

### 2. Navigasi & Sidebar Ramping (`components/sidebar.tsx`)
- **Branding Resmi**: Dilengkapi logo ikon klip Paperclip AI dengan badge status workspace.
- **Ikon Vektor**: Menggunakan ikon minimalis `lucide-react` (Dashboard, Sparkles, Package, ShoppingBag, TableProperties, Settings).
- **Active Model Monitor**: Widget bawah sidebar menampilkan secara real-time apakah provider AI berjalan dalam mode `ONLINE` atau `MOCK`.

---

### 3. Halaman yang Telah Diperbarui

| Halaman | Fitur Tampilan Baru |
|---|---|
| **`/dashboard`** | Kartu metrik kompak (Provider AI, Storage Driver, Katalog, Work Products), daftar riwayat run dengan token counter dan badge status eksekusi agen. |
| **`/content`** | Studio pipeline multi-tahap dengan formulir 2-kolom yang ringkas, visualisasi progress tahap demi tahap, dan tab Work Product (Social Captions, SEO, Visual Directives, Jadwal, Market Research). |
| **`/products`** | Manajemen katalog e-commerce bersih dengan pencarian instan dan kartu spesifikasi ringkas. |
| **`/marketplace`** | Scraper & restrukturisasi AI produk e-commerce otomatis dari tautan marketplace (Shopee, Tokopedia, dll). |
| **`/sheets`** | Integrasi Google Sheets dengan status otorisasi OAuth dan tombol sinkronisasi inventaris. |
| **`/settings`** | Manajemen kunci API penyedia AI (Gemini, Claude, OpenAI, Ollama) yang dapat diubah dan dites tanpa restart kode. |

---

> *Catatan: Jika tab Live Preview belum muncul secara otomatis di layar Anda, klik tab Preview/Port 3000 pada antarmuka Arena.*

# Günay Kimya Endüstriyel ERP & Mobil El Terminali (PWA)

Kimyasal üretim, formülasyon (BOM), reaktör faz yönetimi, GS1 SSCC-18 paletleme, e-İrsaliye mal kabulü ve saha el terminali süreçlerini entegre yöneten modern endüstriyel ERP platformu.

---

## 🚀 Hızlı Başlangıç (Yerel Çalıştırma)

### 1. Backend (FastAPI & SQLite)
```bash
# Python sanal ortamını aktif edin
.\.venv\Scripts\activate

# Backend API sunucusunu başlatın (Port: 8000)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Dokümantasyonu: `http://127.0.0.1:8000/docs`

### 2. Frontend (React 18 + Vite + PWA)
```bash
cd frontend
npm install
npm run dev
```
Yerel Arayüz: `http://localhost:3000`  
Yerel Ağ (Wi-Fi) Erişimi: `http://<BILGISAYAR_IP_ADRESI>:3000`

---

## ☁️ Render.com Canlı Dağıtım (Deployment) Kılavuzu

Proje kök dizininde yer alan `render.yaml` dosyası sayesinde sistem Render.com üzerinde **Infrastructure-as-Code (Blueprint)** standardında tek tıkla canlıya alınabilir.

### 1. Render Blueprint ile Otomatik Kurulum (Önerilen)
1. GitHub deponuzu (`gunay-kimya-erp`) [Render Dashboard](https://dashboard.render.com/) hesabınıza bağlayın.
2. Render panelinde **New +** butonuna basıp **Blueprint** seçeneğini seçin.
3. `gunay-kimya-erp` deposunu seçin.
4. Render, `render.yaml` dosyasını otomatik olarak okur ve şu 3 bileşeni ayağa kaldırır:
   - **PostgreSQL Veritabanı:** `gunay-kimya-db` (Free tier)
   - **Backend Web Service:** `gunay-kimya-api` (Python 3.11, FastAPI)
   - **Frontend Static Site:** `gunay-kimya-web` (React + Vite PWA)
5. `ADMIN_PASSWORD` değişkeni (`sync: false`) için belirlediğiniz güçlü bir yönetici şifresi girin ve **Apply** butonuna tıklayın.
6. İlk açılışta veritabanı tabloları otomatik oluşturulur ve demo veriler yüklenir (mevcut veri varsa üzerine yazılmaz).

### 2. Ortam Değişkenleri Referansı (Environment Variables)

#### Backend (`gunay-kimya-api`)
| Değişken Adı | Açıklama | Örnek / Kaynak |
|---|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı adresi | `gunay-kimya-db` bağlantısından otomatik gelir |
| `SECRET_KEY` | JWT token imzalama gizli anahtarı | Render tarafından otomatik 64-karakter üretilir |
| `ADMIN_PASSWORD` | İlk açılış demo admin şifresi | Kullanıcı tarafından elle girilir (`sync: false`) |
| `FRONTEND_URL` | CORS izinli frontend adresi | `gunay-kimya-web` URL'sinden otomatik gelir |
| `PORT` | Dinlenecek port | Render tarafından otomatik atanır (Varsayılan 10000) |
| `PYTHON_VERSION` | Python çalışma sürümü | `3.11.9` |

#### Frontend (`gunay-kimya-web`)
| Değişken Adı | Açıklama | Örnek / Kaynak |
|---|---|---|
| `VITE_API_URL` | Backend REST API kök adresi | `gunay-kimya-api` URL'sinden otomatik gelir |

---

## 📱 Mobil Cihaz / Telefon ile Test Etme (Cloudflare Tunnel ile HTTPS)

Mobil cihazlarda (Android Chrome ve iOS Safari) **kamera ile barkod tarama (WebRTC/getUserMedia)** ve **PWA (Progressive Web App) olarak ana ekrana yükleme** özellikleri tarayıcı güvenlik politikaları gereğince **HTTPS** bağlantısı zorunlu kılar.

### Adım Adım HTTPS Tüneli Açma:

1. **Cloudflared İndirin:**
   ```bash
   winget install --id Cloudflare.cloudflared
   ```
2. **Tüneli Başlatın:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. **HTTPS Adresini Alın:**
   Terminalde üretilen `https://gunay-kimya-xxxx.trycloudflare.com` adresini telefonunuzda açın.

---

## 📲 Telefonda "Ana Ekrana Ekle" (PWA Kurulum) Adımları

### Android (Google Chrome) ile Kurulum:
1. Chrome'da canlı site adresini (`https://...`) açın.
2. Sağ üst köşedeki **üç nokta (⋮)** simgesine dokunun.
3. Menüden **"Ana ekrana ekle"** veya **"Uygulamayı yükle"** seçeneğini seçin.
4. **"Yükle"** butonuna dokunun.

### iOS / iPhone & iPad (Apple Safari) ile Kurulum:
1. Bağlantıyı **Safari** tarayıcısında açın.
2. Alttaki **Paylaş (Share - kare içinden yukarı ok ⎋)** simgesine dokunun.
3. Aşağı kaydırıp **"Ana Ekrana Ekle" (Add to Home Screen)** seçeneğini seçin.
4. Sağ üstteki **"Ekle"** butonuna dokunun.

---

## 🏷️ Mobil El Terminali (`/terminal` veya `?view=scanner`)

- **Kamera ile Barkod Okuma:** `html5-qrcode` ile arka kamera üzerinden ultra hızlı okuma ve Web Audio onay sesi.
- **Akıllı Tanıma:** Palet (SSCC-18), Koli (GTIN-14) veya Hammadde/Lot otomatik ayrıştırma.
- **Tek Tık Aksiyonlar:** "Depoya Kabul Et" ve "Sevkiyat Doğrula".
- **Lazer Okuyucu Desteği:** Fiziksel el terminali tabancaları için otomatik odaklı manuel giriş alanı.

---

## 🗂️ Temel Modül Haritası

- **Üretim Yönetimi:** Canlı Sipariş & 5s Faz Takibi, Reçete (BOM) Hesaplayıcı, Paketleme İstasyonu (SSCC-18 etiketleme).
- **Stok & Lojistik:** Stok Durumu & FEFO Erimeleri, Ürün & Hammadde SKU Kataloğu, Hazır Palet & Koli Merkezi, El Terminali.
- **Satın Alma:** e-İrsaliye (UBL-TR XML) ile Mal Kabul, Tedarikçi Yönetimi.
- **Satış & Sevkiyat:** B2B Sipariş Giriş, Müşteri/Cari Yönetimi, Sevkiyat Doğrulama.

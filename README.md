# SalesTrack CRM

A full recreation of the [SalesTrack CRM](https://crm-projectt.lovable.app/app/dashboard.html) application — a sales pipeline management platform with role-based login, forecasting dashboard, lead/deal management, activity tracking, AI email composer, and analytics reports.

## Project Structure

```
salestrack-crm/
├── index.html              # Main SPA entry point
├── css/
│   └── salestrack.css      # Design system (sidebar, cards, badges, modals, theme)
├── js/
│   └── dashboard-enhanced.js  # Dashboard forecasting, charts, timeline feed
├── app/                    # Original multi-page reference copies
│   ├── dashboard.html
│   ├── leads.html
│   ├── deals.html
│   ├── activities.html
│   ├── ai.html
│   └── reports.html
└── README.md
```

## Features

| Module | Description |
|--------|-------------|
| **Login Flow** | Account picker with Manager / Sales Rep roles (demo mode, no password) |
| **Dashboard** | Cohort period filter, 6 KPI cards, forecasted revenue, dual-axis pipeline chart, lead donut chart, upcoming activities timeline, recent deals feed |
| **Lead Management** | Search, filter, table view, detail drawer, activity history |
| **Deal Management** | Table/Kanban views, pipeline metrics, EV forecasting, CSV export |
| **Activity Log** | Filter by type/rep, log calls/emails/meetings/notes |
| **AI Email** | Template-based email generation from lead context |
| **Reports** | Pipeline charts, activity breakdown, lead source performance |

## UI Components

- **Layout:** Fixed sidebar (240px), topbar, main content area
- **Cards:** Metric cards with colored left borders, content cards with shadows
- **Badges:** Stage badges (Prospecting → Closed), activity type badges
- **Modals:** Profile, Settings (5 tabs), Notifications
- **Drawer:** Right-side detail panel with timeline
- **Toast:** Success/error/info notifications
- **Theme:** Light/dark mode toggle with CSS variables

## Getting Started

No build step required. Open `index.html` in a browser, or serve locally:

```powershell
# Python
python -m http.server 8080

# Then open http://localhost:8080
```

1. Select an account on the login screen
2. Click **Sign in** (or **Đăng nhập hệ thống**)
3. On Dashboard, click **Load Sample Data** to populate leads & activities
4. Navigate via the sidebar: Dashboard, Leads, Deals, Activities, AI Email, Report

## Tech Stack

- Vanilla HTML / CSS / JavaScript (SPA)
- [Tailwind CSS](https://tailwindcss.com) (CDN, utility classes)
- [Chart.js](https://www.chartjs.org) for analytics charts
- [Font Awesome 6](https://fontawesome.com) icons
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) typography
- `localStorage` for leads, activities, and theme persistence
- `sessionStorage` for auth session

## Data & Forecasting

- **Total Pipeline:** Sum of open deal values (unweighted)
- **Forecasted Revenue:** Σ(deal value × probability / 100)
- **Win Outcome Rate:** Won revenue / (Won + Lost revenue) × 100
- Dashboard uses master deal pool by default; loads from `localStorage` after sample data import

## Deploy lên GitHub Pages (miễn phí)

App là trang tĩnh (HTML/CSS/JS), không cần build. Sau khi bật GitHub Pages, site sẽ có dạng:

`https://<tên-github-của-bạn>.github.io/<tên-repo>/`

### Cách 1 — Upload trên web (không cần cài Git)

1. Đăng nhập [github.com](https://github.com) → **New repository**
2. Tên repo: ví dụ `salestrack-crm` → chọn **Public** → **Create repository**
3. Trang repo mới → **Add file** → **Upload files**
4. Kéo thả **toàn bộ thư mục** `salestrack-crm` (gồm `index.html`, `css/`, `js/`, `app/`, `README.md`)
5. **Commit changes**
6. **Settings** → **Pages** (menu trái)
7. **Build and deployment** → Source: **Deploy from a branch**
8. Branch: **main** (hoặc **master**), Folder: **/ (root)** → **Save**
9. Đợi 1–3 phút, refresh trang Pages để lấy link site

**Lưu ý:** File `index.html` phải nằm ở **gốc repo**, không chỉ trong `app/`.

### Cách 2 — GitHub Desktop (cập nhật code sau này dễ hơn)

1. Cài [GitHub Desktop](https://desktop.github.com/)
2. **File → Add local repository** → chọn `C:\Users\Jewle\salestrack-crm`
3. Nếu chưa có git: **create a repository** tại đó
4. **Publish repository** lên GitHub
5. Bật Pages như bước 6–9 ở Cách 1

### Sau khi deploy

- Mở link GitHub Pages → chọn tài khoản demo → **Load Sample Data** trên Dashboard
- Dữ liệu vẫn lưu trong trình duyệt (`localStorage`), mỗi máy/trình duyệt riêng
- API key Gemini (trang AI Email) cũng lưu local — không đưa key vào GitHub

## License

Recreated for educational/demo purposes. Based on the SalesTrack CRM Lovable app.

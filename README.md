# H&CO. Invoice Management System

A full-stack invoice management web app for H&CO., built with Node.js, Express, and SQLite.  
Works on desktop and mobile. Supports PDF export for WhatsApp/email sharing.

---

## Stack

- **Backend**: Node.js + Express + better-sqlite3
- **Database**: SQLite (single file, zero config, lives next to the server)
- **Frontend**: Vanilla JS + HTML/CSS (no framework, fast on mobile)
- **PDF**: jsPDF (client-side, no server needed)
- **PWA**: installable on Android/iPhone home screen

---

## Quick Start (Local)

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Start the server
node server.js

# 3. Open in browser
# http://localhost:3000
```

The database file `backend/invoices.db` is created automatically on first run.

---

## Deploy to a VPS / Server (Recommended)

### Option A — Any Linux VPS (DigitalOcean, Vultr, Linode, etc.)

```bash
# On your server:
sudo apt update && sudo apt install -y nodejs npm git

# Upload/clone the project
git clone <your-repo> /var/www/hnco-invoices
# OR use scp/FileZilla to upload the folder

cd /var/www/hnco-invoices/backend
npm install

# Install PM2 to keep it running forever
sudo npm install -g pm2
pm2 start server.js --name hnco-invoices
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

Your app is now live on `http://YOUR_SERVER_IP:3000`

### Option B — Deploy to Railway (Free tier, easiest)

1. Create account at https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub and push this folder
4. Railway auto-detects Node.js and deploys
5. Set `PORT` environment variable if needed (Railway sets it automatically)
6. Your app gets a free URL like `https://hnco-invoices.up.railway.app`

### Option C — Deploy to Render (Free tier)

1. Create account at https://render.com
2. New → Web Service → connect GitHub repo
3. Build command: `cd backend && npm install`
4. Start command: `cd backend && node server.js`
5. Free URL provided automatically

> **Note**: On free tiers, use a persistent disk for the SQLite file so data isn't lost on restart.
> Set `DB_PATH=/data/invoices.db` environment variable and mount a disk at `/data`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | Port to listen on |
| `DB_PATH`| `./invoices.db` | Path to SQLite database file |

---

## Add a Custom Domain + HTTPS (Optional)

1. Point your domain DNS to your server IP
2. Install nginx: `sudo apt install nginx`
3. Install certbot: `sudo apt install certbot python3-certbot-nginx`
4. Create `/etc/nginx/sites-available/hnco`:

```nginx
server {
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

5. Enable: `sudo ln -s /etc/nginx/sites-available/hnco /etc/nginx/sites-enabled/`
6. SSL: `sudo certbot --nginx -d yourdomain.com`

Now accessible at `https://yourdomain.com` — bookmark on phone and use like an app.

---

## Install on Mobile (PWA)

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap the 3-dot menu → "Add to Home screen"
3. Opens full-screen like a native app

### iPhone (Safari)
1. Open the app URL in Safari
2. Tap Share → "Add to Home Screen"
3. Opens full-screen like a native app

---

## Backup Your Data

The entire database is a single file: `backend/invoices.db`

```bash
# Simple backup
cp backend/invoices.db backup/invoices-$(date +%Y%m%d).db

# Or automate with cron (daily at 2am)
0 2 * * * cp /var/www/hnco-invoices/backend/invoices.db /backups/invoices-$(date +\%Y\%m\%d).db
```

---

## Features

- Create, edit, delete invoices
- Line items: Qty → Description → Rate → Item price
- Auto-calculated totals
- Pending / Paid status tracking
- Export professional PDF (send via WhatsApp or email)
- Dashboard with revenue stats
- Search invoices
- Mobile-responsive, works on all screen sizes
- Installable as PWA on phones
- SQLite database — no external database needed

---

## File Structure

```
hnco-invoices/
├── backend/
│   ├── server.js          ← Express API + SQLite
│   ├── package.json
│   └── invoices.db        ← Auto-created database (don't delete!)
├── frontend/
│   └── public/
│       ├── index.html
│       ├── manifest.json  ← PWA config
│       ├── css/app.css
│       └── js/app.js
└── README.md
```

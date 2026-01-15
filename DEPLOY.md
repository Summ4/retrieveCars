# Cloud Deployment Guide

Deploy your automation bot to the cloud so it runs 24/7 without depending on your local network.

## 🚀 Quick Deploy Options

### Option 1: Railway (Easiest - Recommended) ⭐

**Free tier available, very easy setup**

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
4. Railway will automatically detect the Dockerfile and deploy
5. Your bot will run 24/7!

**Or deploy via CLI:**
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

### Option 2: Render

**Free tier available**

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Settings:
   - **Build Command:** (leave empty, uses Dockerfile)
   - **Start Command:** (leave empty, uses Dockerfile CMD)
   - **Plan:** Free
5. Click "Create Web Service"
6. Your bot will deploy and run continuously!

---

### Option 3: Fly.io

**Free tier available, great for Docker**

1. Install Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login and deploy:
   ```bash
   fly auth login
   fly launch
   fly deploy
   ```

3. Your app will be live at `https://autowini-car-watcher.fly.dev`

---

### Option 4: DigitalOcean App Platform

**Paid but reliable ($5/month minimum)**

1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create → App Platform
3. Connect GitHub repository
4. Select Dockerfile as build method
5. Choose Basic plan ($5/month)
6. Deploy!

---

### Option 5: VPS (DigitalOcean Droplet, Linode, etc.)

**Full control, ~$5-6/month**

1. Create a VPS instance (Ubuntu 22.04)
2. SSH into the server
3. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```
4. Install Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install docker-compose-plugin
   ```
5. Clone your repo:
   ```bash
   git clone <your-repo-url>
   cd myhome_automation
   ```
6. Remove volume mount from docker-compose.yml (for production)
7. Deploy:
   ```bash
   docker compose up -d --build
   ```
8. Check logs:
   ```bash
   docker compose logs -f
   ```

---

## 📝 Before Deploying

### For Production Deployment:

1. **Remove volume mount** from `docker-compose.yml` (or use production compose file)
2. **Make sure your code is in a Git repository** (GitHub, GitLab, etc.)
3. **Test locally first** with:
   ```bash
   docker-compose -f docker-compose.yml up --build
   ```

---

## 🔧 Recommended: Production Docker Compose

For cloud deployment, use this version without volume mounts:

```yaml
services:
  autowini-car-watcher:
    build: .
    container_name: autowini-car-watcher
    restart: unless-stopped
    # No volume mounts in production - code is baked into image
```

---

## 💡 Which Should You Choose?

- **Railway/Render**: Best for beginners, free tier, zero maintenance
- **Fly.io**: Great for Docker, free tier, more control
- **VPS**: Full control, learn server management, cheapest long-term
- **DigitalOcean App Platform**: Managed, reliable, paid

---

## ✅ After Deployment

Your bot will:
- ✅ Run 24/7 without your laptop
- ✅ Auto-restart on crashes
- ✅ Survive network issues (with retry logic)
- ✅ Work even when your laptop is off

Monitor it via the platform's dashboard or logs!


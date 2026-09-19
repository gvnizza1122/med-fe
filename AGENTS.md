# AGENTS.md — eClaim System Architecture & Deployment Guidelines

## Overview

eClaim adalah sistem pre-validasi klaim BPJS yang terdiri dari tiga komponen utama:
- **Frontend**: Next.js 16.2.6 (React, TypeScript) — port 3000
- **Backend**: Node.js Express API — port 60131 
- **Database**: PostgreSQL — port 5432

## Deployment Architecture

### Container Services

```
┌─────────────────────────────────────────────────────┐
│                    nginx (port 80)                   │
│              medaudit.my.id routing                  │
└────────────────┬──────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    ┌───▼────┐      ┌────▼───┐
    │Frontend │      │Backend │
    │:3000   │      │:60131  │
    └───┬────┘      └────┬───┘
        │                │
        └────────┬───────┘
                 │
            ┌────▼────┐
            │ Database│
            │:5432    │
            └─────────┘
```

### Nginx Configuration

**File**: `/etc/nginx/sites-available/eclaim`

**Routes**:
- `/` → 301 redirect to `/login`
- `/login` → Frontend (port 3000)
- `/api/*` → Backend (port 60131)
- `/*` → Frontend (port 3000)

### Docker Compose

**Backend**: `~/eclaim/be/docker-compose.yml`
```yaml
services:
  eclaim_api:
    image: be-api:latest
    ports:
      - "60131:60131"
    depends_on:
      - eclaim_postgres
      
  eclaim_postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
```

**Frontend**: `~/eclaim/fe/docker-compose.yml`
```yaml
services:
  eclaim_frontend:
    image: fe-frontend:latest
    ports:
      - "3000:3000"
```

## Common Issues & Fixes

### 1. Container Name Conflict

**Problem**: `Error: The container name "/eclaim_api" is already in use`

**Solution**:
```bash
docker stop eclaim_api
docker rm eclaim_api
cd eclaim/be && bash build.sh
```

**Prevention**: Update `build.sh` to clean up old containers:
```bash
docker compose down --remove-orphans
docker compose up -d
```

### 2. Frontend Build Failure

**Problem**: `TypeScript compilation errors during build`

**Solution**:
```bash
cd eclaim/fe
npm install
npm run build
docker compose build --no-cache
docker compose up -d
```

**Key files to check**:
- `src/components/CodingExplanationPanel.tsx` — type definitions
- `src/app/*/page.tsx` — route handlers
- `tsconfig.json` — TypeScript configuration

### 3. 502 Bad Gateway

**Root causes**:
1. Nginx routing to non-existent port
2. Backend/Frontend service not running
3. Old nginx config active

**Debug**:
```bash
# Check nginx config
cat /etc/nginx/sites-available/eclaim

# Check services running
docker ps | grep eclaim

# Check nginx logs
sudo tail -20 /var/log/nginx/error.log

# Test direct connection
curl -I http://localhost:3000/login
curl -I http://localhost:60131/
```

### 4. Missing Login Page (404)

**Problem**: `/login` returns 404

**Solution**:
1. Check route exists: `ls -la ~/eclaim/fe/src/app/login/`
2. Rebuild frontend: `docker compose build --no-cache && docker compose up -d`
3. Verify frontend serving: `curl http://localhost:3000/login`

## Deployment Checklist

### Pre-Deployment

- [ ] Code changes via git (not direct SSH edits)
- [ ] All commits follow commit conventions
- [ ] Tests passing locally
- [ ] No TypeScript errors in build
- [ ] Docker images building successfully

### Deployment Steps

**Backend**:
```bash
cd ~/eclaim/be
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs -f eclaim_api
```

**Frontend**:
```bash
cd ~/eclaim/fe
git pull origin main
npm install  # Only if package.json changed
npm run build  # Verify build locally (optional)
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs -f eclaim_frontend
```

**Nginx**:
```bash
# After both services up
sudo systemctl restart nginx
sudo nginx -t  # Test config
curl https://medaudit.my.id/login  # Verify
```

### Post-Deployment

- [ ] Frontend loads at `/login`
- [ ] Backend API responds: `curl http://localhost:60131/`
- [ ] Nginx logs show no 502 errors
- [ ] User can login successfully
- [ ] File upload works
- [ ] OCR processing completes

## Environment Variables

### Backend `.env`

**Critical**:
```env
# Database
DATABASE_URL=postgresql://user:pass@eclaim_postgres:5432/eclaim_db

# AI/OCR Services
AI_PROVIDER_BASE_URL=https://api.openai.com/v1
AI_PROVIDER_API_KEY=sk-proj-...

# External APIs
SIMRS_API_KEY=...
KIMI_API_KEY=...
KIMI_BASE_URL=https://api.moonshot.ai/v1

# Server
PORT=60131
NODE_ENV=production
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=https://medaudit.my.id/api
```

## Troubleshooting Workflow

### Step 1: Identify Component
```bash
# Check which service is failing
docker ps
docker logs eclaim_api | tail -50
docker logs eclaim_frontend | tail -50
```

### Step 2: Check Git State
```bash
cd ~/eclaim/be && git status && git log --oneline -5
cd ~/eclaim/fe && git status && git log --oneline -5
```

### Step 3: Rebuild Affected Service
```bash
# Backend rebuild
cd ~/eclaim/be
git pull
docker compose build --no-cache
docker compose up -d

# Frontend rebuild
cd ~/eclaim/fe
npm install
npm run build
docker compose build --no-cache
docker compose up -d
```

### Step 4: Verify Deployment
```bash
curl -I https://medaudit.my.id/login
curl -I http://localhost:60131/
docker ps
```

## Best Practices

### ✅ DO

1. **Always use git** for changes
   ```bash
   git checkout -b feature/my-feature
   # make changes
   git add .
   git commit -m "feat: description"
   git push origin feature/my-feature
   ```

2. **Test locally before deploying**
   ```bash
   npm run build
   npm run dev
   ```

3. **Check logs after deployment**
   ```bash
   docker logs -f eclaim_api
   docker logs -f eclaim_frontend
   ```

4. **Keep backups of configs**
   ```bash
   sudo cp /etc/nginx/sites-available/eclaim \
           /etc/nginx/sites-available/eclaim.backup-$(date +%s)
   ```

### ❌ DON'T

1. **Direct SSH file edits** on production
   - Always go through git + proper deployment

2. **Manual docker commands** on production
   - Use docker-compose scripts instead

3. **Force-push to main**
   - Create branches and PRs

4. **Ignore build errors**
   - Fix TypeScript errors before deploying

5. **Delete untracked backup files**
   - They may contain important config history

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:60131/health

# Frontend check (should return 200)
curl -I http://localhost:3000/

# Nginx status
sudo systemctl status nginx

# Container status
docker compose ps
```

### Common Logs to Monitor

```bash
# API errors
docker logs eclaim_api | grep -i error

# Frontend build issues
docker logs eclaim_frontend | grep -i error

# Nginx routing issues
sudo tail -f /var/log/nginx/error.log

# Database connection
docker logs eclaim_postgres | grep -i error
```

## Recovery Procedures

### If Frontend Won't Build

```bash
# Clean rebuild
cd ~/eclaim/fe
rm -rf .next node_modules package-lock.json
npm install
npm run build
docker compose build --no-cache --pull
docker compose up -d
```

### If Backend Won't Start

```bash
# Check database
docker logs eclaim_postgres

# Restart database connection
docker compose down
docker compose up -d eclaim_postgres
sleep 5
docker compose up -d eclaim_api
```

### If Nginx Has Old Config

```bash
# Verify correct config is active
cat /etc/nginx/sites-enabled/eclaim

# Should NOT contain port 60132 or old routes
# Should have port 60131 and proper redirects

# If wrong, remove old symlinks
sudo rm /etc/nginx/sites-enabled/medaudit
sudo rm /etc/nginx/sites-enabled/app-ip

# Restart nginx
sudo systemctl restart nginx
```

## Version Info

- **Frontend**: Next.js 16.2.6, Node 20-alpine
- **Backend**: Node 20-alpine, Express
- **Database**: PostgreSQL 17-alpine
- **Nginx**: 1.28.3 (Ubuntu)

## Contact & Support

For issues:
1. Check this AGENTS.md first
2. Review git logs for recent changes
3. Check docker logs for error messages
4. Restart services and test
5. If still broken, consult git history to understand what changed

---

**Last Updated**: 2026-09-19
**Maintained by**: DevOps Team

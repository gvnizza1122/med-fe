#!/bin/bash

# Pastikan script dijalankan di direktori frontend (fe)
cd "$(dirname "$0")" || exit

echo "🔄 Pulling latest changes from git..."
git pull

echo "🚀 Building and starting frontend containers..."
docker compose up -d --build

# Ambil informasi port dari .env
PORT=$(grep -E "^PORT=" .env | cut -d '=' -f 2)

# Jika tidak ditemukan di .env, gunakan default 3000
if [ -z "$PORT" ]; then
  PORT=3000
fi

echo ""
echo "======================================================="
echo "✅ Frontend successfully deployed and running on PORT: $PORT"
echo "======================================================="
echo ""

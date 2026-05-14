#!/bin/bash
set -e

echo "=== Aura Backend Entrypoint ==="

# 等待 MongoDB 就绪
echo "[entrypoint] Waiting for MongoDB..."
until python -c "from pymongo import MongoClient; MongoClient('mongodb://admin:tradingagents123@mongodb:27017/?authSource=admin', serverSelectionTimeoutMS=5000).admin.command('ping')" 2>/dev/null; do
    sleep 2
done
echo "[entrypoint] MongoDB is ready."

# 初始化 admin 用户（幂等，已存在则跳过）
echo "[entrypoint] Ensuring admin user exists..."
python -c "
import asyncio, hashlib, os
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def ensure_admin():
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client.get_database(settings.MONGO_DB)
    exists = await db.users.find_one({'username': 'admin'})
    if exists:
        print('[entrypoint] Admin user already exists, skipping.')
        return
    hashed = hashlib.sha256('admin123'.encode()).hexdigest()
    await db.users.insert_one({
        'username': 'admin',
        'hashed_password': hashed,
        'email': 'admin@aura.local',
        'is_active': True,
        'is_admin': True,
    })
    print('[entrypoint] ✅ Admin user created: admin / admin123')

asyncio.run(ensure_admin())
"

echo "[entrypoint] Starting FastAPI..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

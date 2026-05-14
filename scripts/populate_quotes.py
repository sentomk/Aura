"""Populate market_quotes from AKShare real-time data. Run inside Docker: python3 /app/populate_quotes.py"""
import asyncio, os, sys
sys.path.insert(0, '/app')
os.chdir('/app')

async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    from tradingagents.dataflows.providers.china.akshare import AKShareProvider

    mongo_url = os.environ.get('MONGODB_URL', 'mongodb://admin:tradingagents123@mongodb:27017/tradingagentscn?authSource=admin')
    db_name = os.environ.get('MONGODB_DATABASE_NAME', 'tradingagentscn')

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    provider = AKShareProvider()
    if not provider.is_available():
        print("AKShare not available")
        return

    # Get stock codes from DB
    cursor = db.stock_basic_info.find({}, {'code': 1}).limit(200)
    codes = [doc['code'] async for doc in cursor]
    print(f"Fetched {len(codes)} stock codes from {db_name}")

    batch_size = 50
    total_ok = 0
    for i in range(0, len(codes), batch_size):
        batch = codes[i:i+batch_size]
        try:
            quotes = await provider.get_batch_stock_quotes(batch)
            if not quotes:
                continue
            for code, q in quotes.items():
                if not q:
                    continue
                doc = {
                    'code': code.zfill(6),
                    'symbol': code.zfill(6),
                    'name': q.get('name', ''),
                    'close': q.get('price') or q.get('close'),
                    'open': q.get('open_price') or q.get('open'),
                    'high': q.get('high_price') or q.get('high'),
                    'low': q.get('low_price') or q.get('low'),
                    'pre_close': q.get('pre_close'),
                    'pct_chg': q.get('change_percent') or q.get('pct_chg'),
                    'change': q.get('change'),
                    'volume': q.get('volume'),
                    'amount': q.get('amount'),
                    'pe': q.get('pe'),
                    'pb': q.get('pb'),
                    'pe_ttm': q.get('pe_ttm'),
                    'updated_at': q.get('last_sync'),
                }
                doc = {k: v for k, v in doc.items() if v is not None}
                await db.market_quotes.update_one(
                    {'code': doc['code']},
                    {'$set': doc},
                    upsert=True,
                )
                total_ok += 1
        except Exception as e:
            print(f"  batch {i//batch_size} error: {e}")
        if (i // batch_size + 1) % 4 == 0:
            print(f"  progress: {min(i+batch_size, len(codes))}/{len(codes)}, ok: {total_ok}")

    print(f"\nDone. Upserted: {total_ok}")
    count = await db.market_quotes.count_documents({})
    print(f"market_quotes count: {count}")

if __name__ == '__main__':
    asyncio.run(main())

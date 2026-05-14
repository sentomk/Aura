"""Create default admin user (admin / admin123)."""
import asyncio
from app.core.database import init_database, close_database
from app.services.user_service import user_service


async def main() -> None:
    await init_database()
    user = await user_service.create_admin_user()
    if user:
        print(f"Admin user ready: admin / admin123")
    await close_database()


if __name__ == "__main__":
    asyncio.run(main())

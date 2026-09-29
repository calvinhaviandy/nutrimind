import os

from dotenv import load_dotenv

load_dotenv()

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-6-sol")

# Neon/Vercel provides a PostgreSQL URL. Local development continues to use
# MariaDB unless this variable is explicitly set.
DATABASE_URL = (os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or "").strip()
USE_POSTGRES = bool(DATABASE_URL)

MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "nutrimind"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
}

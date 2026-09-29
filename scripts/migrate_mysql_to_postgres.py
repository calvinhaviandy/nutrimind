"""Copy the local NutriMind MariaDB data into an empty Neon database.

Run ``python scripts/migrate_mysql_to_postgres.py --dry-run --env-file PATH``
first. The dry run creates the schema and copies rows inside a transaction that
is rolled back. A normal run commits only after every row has been checked.
Credentials and user data are never printed.
"""

import argparse
import os
from pathlib import Path
import sys

import mysql.connector
import psycopg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
TABLES = (
    "users",
    "food_logs",
    "hydration_logs",
    "meal_plans",
    "meal_plan_meals",
    "meal_plan_items",
    "meal_plan_drafts",
)
ORDER_COLUMN = {"meal_plan_drafts": "user_id"}


def image_mime(data):
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    raise ValueError("A local food photo has an unsupported file format")


def source_image(image_path):
    if not image_path:
        return None, None
    uploads = (ROOT / "static" / "uploads").resolve()
    image_file = (ROOT / "static" / image_path).resolve()
    if not image_file.is_relative_to(uploads):
        raise ValueError("A local food photo path is outside static/uploads")
    if not image_file.is_file():
        raise FileNotFoundError("A local food photo is missing")
    data = image_file.read_bytes()
    if len(data) > 2 * 1024 * 1024:
        raise ValueError("A local food photo exceeds the 2 MB serverless limit")
    return data, image_mime(data)


def load_source(mysql_config):
    connection = mysql.connector.connect(**mysql_config)
    try:
        source = {}
        for table in TABLES:
            cursor = connection.cursor()
            cursor.execute(f"SELECT * FROM {table} ORDER BY {ORDER_COLUMN.get(table, 'id')}")
            source[table] = (tuple(cursor.column_names), cursor.fetchall())
            cursor.close()

        food_columns, food_rows = source["food_logs"]
        image_position = food_columns.index("image_path")
        images = [source_image(row[image_position]) for row in food_rows]
        return source, images
    finally:
        connection.close()


def schema_statements():
    schema = (ROOT / "schema_postgres.sql").read_text(encoding="utf-8")
    without_comments = "\n".join(
        line for line in schema.splitlines() if not line.lstrip().startswith("--")
    )
    return [statement.strip() for statement in without_comments.split(";") if statement.strip()]


def verify_target(cursor, source, images):
    for table in TABLES:
        columns, rows = source[table]
        cursor.execute(
            f"SELECT {', '.join(columns)} FROM {table} "
            f"ORDER BY {ORDER_COLUMN.get(table, 'id')}"
        )
        if cursor.fetchall() != rows:
            raise ValueError(f"Target table {table} does not match the local data")

    cursor.execute("SELECT image_data, image_mime FROM food_logs ORDER BY id")
    if cursor.fetchall() != images:
        raise ValueError("Target food photos do not match the local files")


def migrate(database_url, source, images, dry_run):
    connection = psycopg.connect(database_url, connect_timeout=10)
    try:
        cursor = connection.cursor()
        for statement in schema_statements():
            cursor.execute(statement)

        counts = {}
        for table in TABLES:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]

        if any(counts.values()):
            verify_target(cursor, source, images)
            if dry_run:
                connection.rollback()
                print("Dry run passed. Existing data matches; schema changes were rolled back.")
            else:
                connection.commit()
                print("Existing data matches; schema is up to date.")
            return

        for table in TABLES:
            columns, rows = source[table]
            insert_columns = columns + (("image_data", "image_mime") if table == "food_logs" else ())
            placeholders = ", ".join(["%s"] * len(insert_columns))
            insert_sql = f"INSERT INTO {table} ({', '.join(insert_columns)}) VALUES ({placeholders})"
            for index, row in enumerate(rows):
                values = row + images[index] if table == "food_logs" else row
                cursor.execute(insert_sql, values)

            # Imported IDs must advance the identity sequence before the app
            # inserts a new row. pg_get_serial_sequence supports IDENTITY.
            if table != "meal_plan_drafts":
                cursor.execute(
                    f"SELECT setval(pg_get_serial_sequence(%s, 'id'), "
                    f"GREATEST(COALESCE(MAX(id), 0), 1), COUNT(*) > 0) FROM {table}",
                    (table,),
                )

        verify_target(cursor, source, images)
        if dry_run:
            connection.rollback()
            print("Dry run passed. Schema, rows, photos, and ID sequences were rolled back.")
        else:
            connection.commit()
            print("Migration committed and verified.")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--env-file", type=Path, help="Private env file containing DATABASE_URL")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    mysql_config = {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", ""),
        "database": os.getenv("MYSQL_DATABASE", "nutrimind"),
    }
    if args.env_file:
        load_dotenv(args.env_file, override=True)
    database_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if not database_url:
        parser.error("DATABASE_URL is required; pass --env-file or set it in the environment")

    source, images = load_source(mysql_config)
    print("Local rows:", ", ".join(f"{table}={len(source[table][1])}" for table in TABLES))
    print("Local photos:", sum(data is not None for data, _ in images))
    migrate(database_url, source, images, args.dry_run)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Keep credentials and user records out of terminal/CI logs.
        print(f"Migration failed ({type(exc).__name__}). No changes were committed.", file=sys.stderr)
        sys.exit(1)

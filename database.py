"""Database connections for local MySQL and hosted PostgreSQL.

Set DATABASE_URL to a Neon PostgreSQL connection string in production. When it
is absent, the existing MYSQL_* settings keep the local development database.
"""

from flask import g, has_app_context
import mysql.connector
import psycopg
from psycopg.rows import dict_row

from config import DATABASE_URL, MYSQL_CONFIG, USE_POSTGRES


IntegrityError = (mysql.connector.IntegrityError, psycopg.IntegrityError)


class PostgresConnection:
    """Expose the cursor(dictionary=True) interface used by the Flask routes."""

    def __init__(self, connection):
        self._connection = connection

    def cursor(self, dictionary=False):
        if dictionary:
            return self._connection.cursor(row_factory=dict_row)
        return self._connection.cursor()

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()


def get_db():
    if USE_POSTGRES:
        connection = PostgresConnection(psycopg.connect(DATABASE_URL, connect_timeout=10))
    else:
        connection = mysql.connector.connect(**MYSQL_CONFIG)

    # A few legacy routes do not close their connections themselves. Flask
    # closes those after the response, including when a request raises.
    if has_app_context():
        g.setdefault("_db_connections", []).append(connection)
    return connection


def close_db_connections(_exception=None):
    if not has_app_context():
        return
    for connection in g.pop("_db_connections", []):
        try:
            connection.close()
        except Exception:
            pass

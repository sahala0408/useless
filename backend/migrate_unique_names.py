"""
One-off migration: make the dating pool hold one profile per object name.

Keeps the NEWEST row for each normalized name, drops the older ones, then
adds a UNIQUE index so the database itself refuses duplicates from now on.

Image files are never deleted here - only database rows. Older uploads
sometimes share a filename with a newer row, so removing files during a
cleanup can orphan a row that is being kept. Leaving the files costs a
little disk and nothing else.

Safe to run more than once.
"""

import sqlite3
import sys

DB = "objects.db"


def main():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    print("sqlite version:", sqlite3.sqlite_version)

    c.execute("SELECT COUNT(*) FROM objects")
    before = c.fetchone()[0]

    # newest row (highest id) wins for each normalized name
    c.execute("""
        SELECT id, object_name
        FROM objects
        WHERE id NOT IN (
            SELECT MAX(id) FROM objects GROUP BY LOWER(TRIM(object_name))
        )
        ORDER BY id
    """)
    doomed = c.fetchall()

    if not doomed:
        print("no duplicate names - nothing to remove")
    else:
        print(f"removing {len(doomed)} older duplicate row(s) (image files kept on disk):")
        for oid, name in doomed:
            print(f"  id={oid:<4} {name}")
        c.executemany("DELETE FROM objects WHERE id = ?", [(d[0],) for d in doomed])
        conn.commit()

    # now the index can be built
    try:
        c.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_objects_name_key
            ON objects (LOWER(TRIM(object_name)))
        """)
        conn.commit()
        print("UNIQUE index on LOWER(TRIM(object_name)) is in place")
    except sqlite3.OperationalError as err:
        conn.close()
        sys.exit(f"could not create the unique index: {err}")

    c.execute("SELECT COUNT(*) FROM objects")
    after = c.fetchone()[0]
    c.execute("SELECT id, object_name FROM objects ORDER BY object_name")
    rows = c.fetchall()

    print(f"\nrows: {before} -> {after}")
    print("pool is now:")
    for oid, name in rows:
        print(f"  id={oid:<4} {name}")

    # prove the constraint actually bites
    try:
        c.execute(
            "INSERT INTO objects (object_name, image_path, personality) VALUES (?,?,?)",
            ("  SPOON  ", "uploads/none.png", "{}"),
        )
        conn.rollback()
        print("\nWARNING: a duplicate 'SPOON' was accepted - the index is NOT working")
    except sqlite3.IntegrityError:
        print("\nverified: inserting '  SPOON  ' is rejected by the database")

    conn.close()


if __name__ == "__main__":
    main()

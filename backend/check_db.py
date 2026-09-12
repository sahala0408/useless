import sqlite3

conn = sqlite3.connect("objects.db")
cursor = conn.cursor()
cursor.execute("SELECT * FROM objects")
rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()
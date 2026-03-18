"""
独立脚本：初始化 visualizations.db 数据库
运行方式: python init_db.py
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "visualizations.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS visualizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            label TEXT NOT NULL,
            config_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            pseudo_bev TEXT NOT NULL,
            bev_after_voronoi TEXT NOT NULL,
            bev_after_conv TEXT NOT NULL,
            point_cloud TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    print(f"数据库已创建: {DB_PATH}")

if __name__ == "__main__":
    init_db()

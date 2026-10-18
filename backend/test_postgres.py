"""
Script kiểm tra kết nối trực tiếp đến PostgreSQL từ file .env.
Chạy script bằng lệnh: py test_postgres.py
"""
import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
db_url = os.getenv("DATABASE_URL", "")

print("=" * 60)
print("🔍 KIỂM TRA KẾT NỐI POSTGRESQL (pgAdmin4)...")
print(f"Chuỗi kết nối: {db_url.split('@')[-1] if '@' in db_url else db_url}")
print("=" * 60)

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version();")).fetchone()
        print("✅ KẾT NỐI POSTGRESQL THÀNH CÔNG RỰC RỠ!")
        print(f"Phiên bản: {result[0]}")
    print("=" * 60)
    print("🎉 Bây giờ bạn có thể chạy: py init_db.py để tạo 12 bảng vào pgAdmin4!")
    print("=" * 60)
except Exception as e:
    print(f"❌ KẾT NỐI THẤT BẠI:")

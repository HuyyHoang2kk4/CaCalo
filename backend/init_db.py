"""
Script khởi tạo toàn bộ các bảng trong Cơ sở dữ liệu theo schema đã định nghĩa.
Chạy script này bằng lệnh: py init_db.py
"""
import sys
import os

# Đảm bảo UTF-8 trên Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Thêm thư mục backend vào sys.path để import app dễ dàng
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect
from app.database import engine, Base
import app.models  # Import toàn bộ models để SQLAlchemy nhận diện metadata

def init_database():
    print("=" * 60)
    print("🚀 BẮT ĐẦU KHỞI TẠO CƠ SỞ DỮ LIỆU CACALO...")
    print("=" * 60)

    # Tạo tất cả các bảng
    Base.metadata.create_all(bind=engine)

    # Kiểm tra danh sách bảng đã được tạo
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    print(f"✅ ĐÃ TẠO THÀNH CÔNG {len(table_names)} BẢNG TRONG DATABASE:")
    for idx, table in enumerate(table_names, 1):
        columns = inspector.get_columns(table)
        print(f"  {idx:2d}. Bảng: [{table}] ({len(columns)} cột)")

    print("=" * 60)
    print("🎉 KHỞI TẠO HOÀN TẤT! SẴN SÀNG NẠP DỮ LIỆU MẪU.")
    print("=" * 60)

if __name__ == "__main__":
    init_database()

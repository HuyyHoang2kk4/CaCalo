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

def init_database(reset: bool = False):
    print("=" * 60)
    print("🚀 BẮT ĐẦU KHỞI TẠO CƠ SỞ DỮ LIỆU CACALO (POSTGRESQL)...")
    print("=" * 60)

    if reset:
        print("⚠️ PHÁT HIỆN THAM SỐ --reset: Đang xóa các bảng cũ để làm mới Schema...")
        Base.metadata.drop_all(bind=engine)
        print("✅ Đã xóa toàn bộ bảng cũ thành công.")

    # Tạo tất cả các bảng theo Schema mới nhất
    Base.metadata.create_all(bind=engine)

    # Kiểm tra danh sách bảng đã được tạo
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    print(f"✅ ĐÃ ĐỒNG BỘ THÀNH CÔNG {len(table_names)} BẢNG TRONG POSTGRESQL:")
    for idx, table in enumerate(table_names, 1):
        columns = inspector.get_columns(table)
        print(f"  {idx:2d}. Bảng: [{table}] ({len(columns)} cột)")

    print("=" * 60)
    print("🎉 KHỞI TẠO HOÀN TẤT! SẴN SÀNG NẠP DỮ LIỆU MẪU.")
    print("=" * 60)

if __name__ == "__main__":
    should_reset = "--reset" in sys.argv
    init_database(reset=should_reset)


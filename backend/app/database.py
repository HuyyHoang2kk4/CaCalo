"""
Cấu hình kết nối Cơ sở dữ liệu PostgreSQL sử dụng SQLAlchemy ORM.
Tối ưu hóa riêng cho môi trường PostgreSQL (quản trị qua pgAdmin) với Connection Pooling.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Nạp các biến môi trường từ file .env
load_dotenv()

# Lấy URL kết nối PostgreSQL từ file .env
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL or not DATABASE_URL.startswith("postgresql"):
    raise ValueError(
        "❌ LỖI KẾT NỐI: Dự án yêu cầu kết nối PostgreSQL! "
        "Vui lòng kiểm tra biến DATABASE_URL trong file .env (VD: postgresql://postgres:123456@localhost:5432/cacalo_db)"
    )

# Cấu hình Pool chuyên biệt cho PostgreSQL trong môi trường thực tế
engine = create_engine(
    DATABASE_URL,
    pool_size=10,             # Số kết nối thường trực duy trì trong pool
    max_overflow=20,          # Số kết nối bổ sung tối đa khi tải cao đột biến
    pool_timeout=30,          # Thời gian chờ tối đa (giây) trước khi báo lỗi timeout
    pool_recycle=1800,        # Tự động refresh kết nối sau 30 phút (tránh PostgreSQL đóng idle connection)
    pool_pre_ping=True,       # Tự động kiểm tra kết nối còn sống trước khi thực thi query (chống lỗi rớt mạng)
    echo=False                # Đổi thành True nếu cần debug chi tiết các câu lệnh SQL trên pgAdmin
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    Dependency cung cấp database session cho từng request và tự động đóng sau khi hoàn tất.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


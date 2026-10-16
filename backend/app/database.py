"""
Cấu hình kết nối Cơ sở dữ liệu sử dụng SQLAlchemy ORM.
Hỗ trợ SQLite cho môi trường phát triển cục bộ và PostgreSQL cho Production.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Nạp các biến môi trường từ file .env (nếu có)
load_dotenv()

# Lấy URL kết nối, ưu tiên PostgreSQL nếu có cấu hình trong .env
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cacalo.db")

# Nếu là SQLite, cần bật check_same_thread=False để tương thích với FastAPI đa luồng
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False  # Đổi thành True nếu muốn debug chi tiết các câu lệnh SQL
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

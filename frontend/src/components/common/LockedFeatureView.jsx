/**
 * MỤC ĐÍCH: Màn hình khóa tính năng dành cho khách chưa đăng nhập.
 * YÊU CẦU: Khách có thể dùng tự do tính năng Chụp ảnh quét món ăn,
 * nhưng khi vào Dashboard, Tủ lạnh hoặc Cá nhân hóa thì thông báo cần đăng nhập.
 */
import React from 'react';
import { Lock, Camera, LogIn, Sparkles, ArrowRight } from 'lucide-react';

export default function LockedFeatureView({ 
  featureName = 'Tính năng này', 
  description = 'Vui lòng đăng nhập để lưu trữ dữ liệu cá nhân hóa và theo dõi dinh dưỡng hàng ngày.',
  icon: Icon = Lock,
  onOpenAuth, 
  onSwitchToVision 
}) {
  return (
    <div className="locked-feature-container">
      <div className="locked-feature-card">
        <div className="locked-feature-icon-wrapper">
          <Icon size={32} />
        </div>
        
        <h2 className="locked-feature-title">{featureName}</h2>
        <p className="locked-feature-desc">{description}</p>

        <div className="locked-feature-actions">
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={onOpenAuth}
            style={{ 
              padding: '12px 20px', 
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <LogIn size={18} />
            <span>Đăng nhập hoặc Đăng ký ngay</span>
            <ArrowRight size={16} />
          </button>

          <button 
            type="button" 
            className="btn btn-outline" 
            onClick={onSwitchToVision}
            style={{ 
              padding: '10px 18px', 
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Camera size={16} color="var(--color-accent)" />
            <span>Dùng thử miễn phí: Quét món ăn AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}

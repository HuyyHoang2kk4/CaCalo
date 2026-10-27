/**
 * MỤC ĐÍCH: Màn hình Đăng nhập & Đăng ký chính (Login Screen).
 * YÊU CẦU: Hiển thị ngay khi người dùng chưa đăng nhập, bắt buộc xác thực trước khi truy cập ứng dụng.
 * TÍNH NĂNG:
 * - Đăng nhập tài khoản tiêu chuẩn với Email & Mật khẩu
 * - 2 Nút 1-Click đăng nhập nhanh kiểm thử: Demo User (demo@cacalo.vn) & Admin (admin@cacalo.vn)
 * - Đăng ký tài khoản mới kèm hồ sơ thể trạng ban đầu (Mifflin-St Jeor)
 * - Tự động lưu Token vào localStorage và cập nhật phiên làm việc
 */
import React, { useState } from 'react';
import { 
  Salad, LogIn, UserPlus, Sparkles, ShieldCheck, 
  AlertCircle, CheckCircle2, User, Mail, Lock, ArrowRight 
} from 'lucide-react';
import { loginUser, registerUser } from '../../services/api';

export default function LoginPage({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Initial health metrics for register
  const [gender, setGender] = useState('male');
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(65);
  const [goal, setGoal] = useState('maintain');

  // Đăng nhập nhanh 1-Click
  const handleQuickLogin = async (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await loginUser({ email: quickEmail, password: quickPassword });
      setSuccessMsg(`Chào mừng ${res.user?.full_name || 'bạn'} trở lại!`);
      setTimeout(() => {
        onAuthSuccess(res.user);
      }, 400);
    } catch (err) {
      setErrorMsg(err.message || 'Đăng nhập nhanh thất bại');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await loginUser({ email, password });
        setSuccessMsg(res.message || 'Đăng nhập thành công!');
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 400);
      } else {
        const res = await registerUser({
          email,
          password,
          full_name: fullName || 'Thành viên CaCalo',
          gender,
          birth_year: 2000,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          goal,
        });
        setSuccessMsg(res.message || 'Đăng ký tài khoản thành công!');
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 400);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Thao tác không thành công');
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        {/* Header thương hiệu CaCalo */}
        <div className="login-header-section">
          <div className="login-brand-logo">
            <Salad size={32} strokeWidth={2} />
          </div>
          <h1 className="login-brand-title">CaCalo</h1>
          <p className="login-brand-subtitle">
            Trợ lý dinh dưỡng AI & Đếm Calo thông minh
          </p>
        </div>

        {/* Nút 1-Click đăng nhập nhanh kiểm thử */}
        <div className="quick-login-panel">
          <div className="quick-login-label">
            <Sparkles size={14} color="var(--color-accent)" />
            <span>Tài khoản kiểm thử nhanh (1-Click):</span>
          </div>
          <div className="quick-login-buttons">
            <button
              type="button"
              id="btn-quick-login-demo"
              disabled={loading}
              className="btn btn-outline quick-btn"
              onClick={() => handleQuickLogin('demo@cacalo.vn', 'demo')}
              title="Đăng nhập tài khoản mẫu demo@cacalo.vn"
            >
              <span>⚡</span>
              <span>Người dùng Demo</span>
            </button>
            <button
              type="button"
              id="btn-quick-login-admin"
              disabled={loading}
              className="btn btn-outline quick-btn quick-btn-admin"
              onClick={() => handleQuickLogin('admin@cacalo.vn', 'admin123')}
              title="Đăng nhập tài khoản Quản trị admin@cacalo.vn"
            >
              <ShieldCheck size={14} />
              <span>Quản trị viên</span>
            </button>
          </div>
        </div>

        {/* Chuyển đổi tab Đăng nhập / Đăng ký */}
        <div className="auth-tab-switch">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setErrorMsg(''); }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setErrorMsg(''); }}
          >
            Đăng ký tài khoản
          </button>
        </div>

        {/* Thông báo lỗi / thành công */}
        {errorMsg && (
          <div className="alert-badge alert-error" style={{ marginBottom: '14px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert-badge alert-success" style={{ marginBottom: '14px' }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form đăng nhập / đăng ký */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Họ và tên</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email tài khoản</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                required
                minLength={mode === 'register' ? 6 : 1}
                placeholder={mode === 'register' ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu của bạn'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Phần thể trạng ban đầu nếu là đăng ký */}
          {mode === 'register' && (
            <div className="register-metrics-box" style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                🎯 Thiết lập nhanh thể trạng ban đầu:
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Giới tính</label>
                  <select 
                    value={gender} 
                    onChange={(e) => setGender(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Mục tiêu</label>
                  <select 
                    value={goal} 
                    onChange={(e) => setGoal(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  >
                    <option value="lose_weight">Giảm cân</option>
                    <option value="maintain">Giữ cân</option>
                    <option value="gain_weight">Tăng cân</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Chiều cao (cm)</label>
                  <input
                    type="number"
                    min="100"
                    max="230"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Cân nặng (kg)</label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            id="btn-auth-submit"
            disabled={loading}
            className="btn btn-primary btn-block"
            style={{ 
              marginTop: '16px', 
              padding: '12px', 
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                {mode === 'login' ? (
                  <>
                    <LogIn size={18} />
                    <span>Đăng nhập vào CaCalo</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>Hoàn tất đăng ký</span>
                  </>
                )}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer bảo mật */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Hệ thống bảo vệ dữ liệu thể trạng & dinh dưỡng an toàn theo chuẩn quốc tế.
        </div>
      </div>
    </div>
  );
}

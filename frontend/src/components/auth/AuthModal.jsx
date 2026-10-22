/**
 * MỤC ĐÍCH: Hộp thoại (Modal) Đăng nhập & Đăng ký tài khoản người dùng.
 * ĐẦU VÀO: isOpen (boolean), onClose (function), onAuthSuccess (function).
 * TÍNH NĂNG:
 * - Chuyển đổi linh hoạt giữa Đăng nhập & Đăng ký
 * - Nút 1-click điền tài khoản Demo để kiểm thử ngay lập tức
 * - Thu thập thông tin thể trạng ban đầu khi đăng ký (Chiều cao, Cân nặng, Mục tiêu)
 * - Tự động lưu Token và đồng bộ hồ sơ cá nhân hóa
 */
import React, { useState } from 'react';
import { X, LogIn, UserPlus, Sparkles, AlertCircle, CheckCircle2, User, Mail, Lock } from 'lucide-react';
import { loginUser, registerUser } from '../../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  if (!isOpen) return null;

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Registration initial metrics
  const [gender, setGender] = useState('male');
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(65);
  const [goal, setGoal] = useState('maintain');

  // Điền nhanh tài khoản demo
  const fillDemoAccount = () => {
    setEmail('demo@cacalo.vn');
    setPassword('demo');
    setErrorMsg('');
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
          onClose();
        }, 600);
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
        setSuccessMsg(res.message || 'Đăng ký thành công!');
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 600);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Thao tác không thành công');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="auth-icon-badge">
              {mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {mode === 'login' ? 'Đăng nhập CaCalo' : 'Tạo tài khoản mới'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {mode === 'login' 
                  ? 'Theo dõi dinh dưỡng và mục tiêu cá nhân hóa' 
                  : 'Khởi tạo hành trình dinh dưỡng thông minh của bạn'}
              </p>
            </div>
          </div>
          <button 
            className="btn-close-modal" 
            onClick={onClose} 
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
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

        {/* Nút Demo test nhanh */}
        {mode === 'login' && (
          <div className="demo-hint-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--color-accent)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tài khoản kiểm thử có sẵn:</span>
            </div>
            <button 
              type="button" 
              className="btn btn-outline btn-sm"
              onClick={fillDemoAccount}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              ⚡ Điền tài khoản Demo
            </button>
          </div>
        )}

        {/* Thông báo lỗi / thành công */}
        {errorMsg && (
          <div className="alert-badge alert-error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert-badge alert-success">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
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
            <label className="form-label">Email</label>
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
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Phần thông số cơ thể ban đầu nếu là đăng ký */}
          {mode === 'register' && (
            <div className="register-metrics-box">
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
            disabled={loading}
            className="btn btn-primary btn-block"
            style={{ marginTop: '16px', padding: '12px' }}
          >
            {loading ? 'Đang xử lý...' : (mode === 'login' ? 'Đăng nhập ngay' : 'Hoàn tất đăng ký')}
          </button>
        </form>
      </div>
    </div>
  );
}

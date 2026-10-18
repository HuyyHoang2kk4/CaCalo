/**
 * MỤC ĐÍCH: Thành phần Modal Camera WebRTC cho phép chụp ảnh trực tiếp từ máy tính/điện thoại.
 * ĐẦU VÀO: isOpen (boolean), onClose (function), onCapture (function nhận imageBlob).
 * ĐẦU RA: Khung giao diện camera với khung ngắm món ăn, nút bấm chụp và nút đổi camera.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';

export default function CameraModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (cam sau) hoặc 'user' (cam trước)
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Khởi động Camera WebRTC khi Modal mở ra
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    stopCamera();

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Lỗi mở Camera WebRTC:', err);
      setErrorMsg('Không thể truy cập camera. Vui lòng cấp quyền truy cập máy ảnh trong trình duyệt!');
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera();
          onCapture(blob);
          onClose();
        }
      },
      'image/jpeg',
      0.85
    );
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#1E293B',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header Camera */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#FFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} color="var(--color-accent)" />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Camera WebRTC Quét Món Ăn</span>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Khung ngắm Video Stream */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '380px',
            backgroundColor: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {errorMsg ? (
            <div style={{ color: '#F87171', padding: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 10px' }} />
              <p>{errorMsg}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />
              {/* Khung ngắm chụp ảnh ẩm thực (Target Viewfinder) */}
              <div
                style={{
                  position: 'absolute',
                  width: '240px',
                  height: '240px',
                  border: '2px dashed rgba(255, 255, 255, 0.6)',
                  borderRadius: '16px',
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-30px',
                    width: '100%',
                    textAlign: 'center',
                    color: '#FFF',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  Đặt bát/đĩa món ăn vào khung
                </div>
              </div>
            </>
          )}
        </div>

        {/* Thanh điều khiển chụp */}
        <div
          style={{
            padding: '18px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            backgroundColor: '#0F172A',
          }}
        >
          {/* Nút đổi camera trước/sau */}
          <button
            onClick={toggleFacingMode}
            disabled={isLoading || !!errorMsg}
            title="Đổi camera trước/sau"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={20} />
          </button>

          {/* Nút bấm chụp ảnh chính giữa */}
          <button
            onClick={handleCapture}
            disabled={isLoading || !!errorMsg}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              border: '4px solid #FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(249, 115, 22, 0.5)',
              transition: 'transform 0.1s ease',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#FFF' }} />
          </button>

          {/* Giữ cân đối giao diện */}
          <div style={{ width: '44px' }} />
        </div>
      </div>
    </div>
  );
}

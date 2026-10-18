/**
 * MỤC ĐÍCH: Tiện ích nén ảnh phía Client sử dụng HTML5 Canvas.
 * ĐẦU VÀO: File hoặc Blob ảnh người dùng tải lên hoặc chụp từ Camera.
 * ĐẦU RA: Blob ảnh JPEG chuẩn đã được resize (cạnh tối đa 1280px) và nén chất lượng 0.8 (dung lượng < 1MB).
 */

export const compressImage = (file, maxDimension = 1280, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Tệp không phải là định dạng hình ảnh hợp lệ'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Tính toán kích thước mới giữ nguyên tỷ lệ
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Không thể nén hình ảnh'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
};

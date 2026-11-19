/**
 * CHAAT KULTURE OS — High-Efficiency Client-Side Image Compressor
 * Resizes and compresses receipt/bill photos before saving and syncing to cloud.
 * Converts multi-megabyte camera photos into lightweight, highly legible JPEGs (~60-150KB),
 * preventing storage bloat and ensuring smooth GitHub Gist cloud synchronization.
 */

export async function compressImageFile(
  file: File,
  maxDimension = 1200,
  quality = 0.72
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Empty file content'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if dimensions exceed maxDimension
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
          if (!ctx) {
            // Fallback to original data URL if canvas context unavailable
            resolve(dataUrl);
            return;
          }

          // Fill white background in case of transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw resized image
          ctx.drawImage(img, 0, 0, width, height);

          // Export as compressed JPEG
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          console.warn('[ImageCompressor] Canvas export failed, using raw data URL:', err);
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressBase64Image(
  dataUrl: string,
  maxDimension = 1200,
  quality = 0.72
): Promise<string> {
  // If dataUrl is small (< 200KB) or not a valid image data URL, return as-is
  if (!dataUrl.startsWith('data:image/') || dataUrl.length < 200000) {
    return dataUrl;
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width <= maxDimension && height <= maxDimension && dataUrl.length < 350000) {
          resolve(dataUrl);
          return;
        }

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
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

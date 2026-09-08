// Resizes and compresses a cover photo client-side before it's stored. A
// phone photo or a TikTok/Instagram screenshot can be several MB — way more
// detail than a cover thumbnail ever needs — and Firestore caps documents at
// 1MB, so pushing one unresized would silently fail to sync. Downscaling to
// a small JPEG keeps every book comfortably under that limit and keeps
// IndexedDB usage sane for a library of hundreds of covers.
const MAX_DIMENSION = 480;
const JPEG_QUALITY = 0.72;

export function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas isn't supported in this browser"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error("Couldn't read that image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read that file"));
    reader.readAsDataURL(file);
  });
}

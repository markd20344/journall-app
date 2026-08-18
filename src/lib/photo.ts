// The "nobody answered" evidence photo needs to end up small enough to live
// as a plain field on a synced record (Firestore documents cap out at 1MB,
// and this app has no separate blob storage) — so every photo is downscaled
// and re-compressed client-side before it's stored, rather than kept at
// full camera resolution.
//
// Known limitation (v1): this doesn't read EXIF orientation, so a photo
// taken with the phone held in certain orientations can come out rotated.
// Fine for a doorstep evidence shot; a proper fix would re-orient the pixels
// using the EXIF tag before drawing to canvas.

const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.6;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = width > height ? max / width : max / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Downscales and JPEG-compresses an image file into a compact data URL. */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

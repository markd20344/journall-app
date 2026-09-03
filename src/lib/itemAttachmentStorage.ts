// Uploads/deletes photos attached to a Task/Item in Firebase Storage — same
// approach as family/storage.ts and for the same reason (a photo, even
// compressed, would risk blowing past Firestore's 1MB-per-document cap).
// Kept as its own small file rather than sharing family/storage.ts's
// helpers directly: paths here are per-user (users/{uid}/...), not
// per-family-tree, and this feature shouldn't need to touch — or risk
// breaking — the family tree module to ship.
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "../firebase/config";

// Generous enough to keep a phone photo legible, small enough to upload
// quickly on mobile data and stay cheap at scale.
const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_JPEG_QUALITY = 0.82;

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

async function compressImageToBlob(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, PHOTO_MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images");
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't compress that image"))),
      "image/jpeg",
      PHOTO_JPEG_QUALITY,
    );
  });
}

export interface UploadedItemPhoto {
  storagePath: string;
  downloadUrl: string;
}

/** Compresses and uploads a Task/Item photo, keyed by the attachment's own id. */
export async function uploadItemPhoto(attachmentId: string, file: File): Promise<UploadedItemPhoto> {
  if (!storage) throw new Error("Cloud storage isn't configured.");
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Sign in to attach photos.");
  const blob = await compressImageToBlob(file);
  const path = `users/${uid}/itemAttachments/${attachmentId}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath: path, downloadUrl };
}

export async function deleteItemPhoto(storagePath: string): Promise<void> {
  if (!storage) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    console.error(`Failed to delete storage file ${storagePath}`, err);
  }
}

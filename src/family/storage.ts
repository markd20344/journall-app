// Uploads photos/records to Firebase Storage (not Firestore — the whole
// point of using real blob storage is that a family archive's photos and
// scans, even compressed, would blow past Firestore's 1MB-per-document cap
// and be far more expensive to sync than a handful of small doc writes).
// Images are always resized/re-compressed client-side first to keep storage
// costs down at family scale; non-image files (e.g. a PDF scan) upload as-is
// since there's no cheap client-side way to shrink those.
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase/config";
import { FAMILY_TREE_ID } from "./config";

// Generous enough to keep a scanned document or old photo legible, small
// enough that a few thousand of these stays comfortably inside a few
// dollars/month of storage (see README for the cost math).
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

export interface UploadedFile {
  storagePath: string;
  downloadUrl: string;
}

async function uploadToPath(path: string, blob: Blob, contentType: string): Promise<UploadedFile> {
  if (!storage) throw new Error("Firebase Storage isn't configured.");
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType });
  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath: path, downloadUrl };
}

/** Compresses (if it's an image) and uploads a media photo, keyed by the media doc's id. */
export async function uploadMediaFile(mediaId: string, file: File): Promise<UploadedFile> {
  if (file.type.startsWith("image/")) {
    const blob = await compressImageToBlob(file);
    return uploadToPath(`trees/${FAMILY_TREE_ID}/media/${mediaId}.jpg`, blob, "image/jpeg");
  }
  return uploadToPath(`trees/${FAMILY_TREE_ID}/media/${mediaId}-${file.name}`, file, file.type || "application/octet-stream");
}

/**
 * Uploads a record (scanned document). Image scans are compressed like
 * photos; anything else (PDFs, mainly) uploads unmodified since a browser
 * can't cheaply shrink those client-side.
 */
export async function uploadRecordFile(recordId: string, file: File): Promise<UploadedFile & { fileName: string }> {
  if (file.type.startsWith("image/")) {
    const blob = await compressImageToBlob(file);
    const uploaded = await uploadToPath(`trees/${FAMILY_TREE_ID}/records/${recordId}.jpg`, blob, "image/jpeg");
    return { ...uploaded, fileName: file.name };
  }
  const uploaded = await uploadToPath(`trees/${FAMILY_TREE_ID}/records/${recordId}-${file.name}`, file, file.type || "application/octet-stream");
  return { ...uploaded, fileName: file.name };
}

export async function deleteStorageFile(storagePath: string): Promise<void> {
  if (!storage) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    console.error(`Failed to delete storage file ${storagePath}`, err);
  }
}

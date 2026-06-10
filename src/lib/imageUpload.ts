// Procesa una imagen subida por el usuario.
// Estrategia: comprimir en el navegador y subir a Firebase Storage (devuelve URL https,
// que la regla de Firestore ya acepta). Si Storage no está disponible, cae a un data URL
// embebido como respaldo (requiere que la regla de imagen acepte data:image/...).

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/src/lib/firebase';

const MAX_DIMENSION = 1280;       // lado mayor máximo en px
const TARGET_BYTES = 480 * 1024;  // objetivo del JPEG comprimido
const HARD_LIMIT_BYTES = 1500 * 1024;

export interface UploadResult {
  url: string;            // URL https de Storage, o data URL de respaldo
  via: 'storage' | 'dataurl';
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

interface Compressed { blob: Blob; dataUrl: string; }

async function compress(file: File): Promise<Compressed> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }
  const img = await loadImage(file);

  let { width, height } = img;
  if (width > height && width > MAX_DIMENSION) {
    height = Math.round((height * MAX_DIMENSION) / width);
    width = MAX_DIMENSION;
  } else if (height >= width && height > MAX_DIMENSION) {
    width = Math.round((width * MAX_DIMENSION) / height);
    height = MAX_DIMENSION;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > TARGET_BYTES && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > HARD_LIMIT_BYTES) {
    throw new Error('La imagen es demasiado pesada incluso comprimida. Probá con una más chica.');
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', quality);
  });

  return { blob, dataUrl };
}

/**
 * Comprime y sube la imagen. Intenta Firebase Storage primero (URL https);
 * si falla (Storage no habilitado, sin permisos, etc.), devuelve un data URL.
 * `pathPrefix` ayuda a organizar (ej. uid del organizador o id del evento).
 */
export async function uploadEventImage(file: File, pathPrefix: string): Promise<UploadResult> {
  const { blob, dataUrl } = await compress(file);

  try {
    const safePrefix = (pathPrefix || 'misc').replace(/[^a-zA-Z0-9_-]/g, '');
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, `event-images/${safePrefix}/${name}`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(storageRef);
    return { url, via: 'storage' };
  } catch (err) {
    // Respaldo: data URL embebido (sirve si la regla acepta data:image/...)
    console.warn('[uploadEventImage] Storage no disponible, uso data URL de respaldo:', err);
    return { url: dataUrl, via: 'dataurl' };
  }
}

// Compat: versión que solo devuelve un data URL (sin Storage).
export async function compressImageFile(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const { dataUrl } = await compress(file);
  return { dataUrl, bytes: dataUrl.length };
}

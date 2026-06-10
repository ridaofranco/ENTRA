// Comprime una imagen subida por el usuario (File) a un data URL JPEG liviano.
// No usamos Firebase Storage: la imagen queda embebida en el campo `image` del evento.
// Por eso la achicamos y comprimimos fuerte para no pasar el límite de Firestore (~1MB por doc).

const MAX_DIMENSION = 1280; // lado mayor máximo en px
const TARGET_BYTES = 480 * 1024; // objetivo: < ~480KB de data URL
const HARD_LIMIT_BYTES = 900 * 1024; // tope duro de seguridad (Firestore ~1MB)

export interface CompressResult {
  dataUrl: string;
  bytes: number;
}

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
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}

/**
 * Toma un File de imagen y devuelve un data URL JPEG comprimido.
 * Lanza error si el archivo no es imagen o si no se puede comprimir bajo el tope.
 */
export async function compressImageFile(file: File): Promise<CompressResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }

  const img = await loadImage(file);

  // Escalar manteniendo proporción
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
  // Fondo blanco por si la imagen tiene transparencia (JPEG no soporta alpha)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // Bajar calidad hasta entrar en el objetivo
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > TARGET_BYTES && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > HARD_LIMIT_BYTES) {
    throw new Error('La imagen es demasiado pesada incluso comprimida. Probá con una más chica o pegá un link.');
  }

  return { dataUrl, bytes: dataUrl.length };
}

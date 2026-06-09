import { removeBackground } from "@imgly/background-removal";

/**
 * Takes a File or Blob, returns a PNG Blob with background removed.
 * Throws on failure so caller can fallback to original.
 */
export async function removeBg(imageFile, onProgress) {
  const config = {
    progress: (key, current, total) => {
      if (onProgress) {
        onProgress(Math.round((current / total) * 100));
      }
    },
    // Use the faster "small" model — good enough for clothing
    model: "medium",
    output: {
      format: "image/png",
      quality: 0.9,
    },
  };

  const result = await removeBackground(imageFile, config);
  return result; // Blob
}

/**
 * Converts a Blob to a data URL for preview.
 */
export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a data URL to a Blob.
 */
export function dataURLToBlob(dataURL) {
  const [header, base64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
// apps/mobile/src/core/media/picker.ts · camera/gallery capture via expo-image-picker. Permissions are requested
// JUST-IN-TIME (guide §8) — only when the user taps capture, with a clear in-context prompt. Returns a PickedImage
// or null (user cancelled / denied). No upload here; processing + upload are separate steps.
import * as ImagePicker from 'expo-image-picker';
import type { PickedImage } from './types';

function toPicked(result: ImagePicker.ImagePickerResult): PickedImage | null {
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName ?? undefined };
}

/** Open the camera (after a JIT permission prompt). Returns null if denied/cancelled. */
export async function captureFromCamera(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, exif: false });
  return toPicked(result);
}

/** Open the gallery (after a JIT permission prompt). Returns null if denied/cancelled. */
export async function pickFromGallery(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, exif: false, selectionLimit: 1 });
  return toPicked(result);
}

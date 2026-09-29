import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

// The one place every form goes through to add a document photo and send it to Cloudinary.
// 1. pickPhoto(): take a photo or choose one from the gallery, then shrink it.
// 2. uploadPhotos(): send the photos to Cloudinary one at a time and get their links back.

const cloudinaryCloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cloudinaryUploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

// Photos are shrunk so their longest side is at most 1600 pixels and saved as JPEG.
// A 3-8 MB phone photo becomes about 0.2-0.5 MB: small enough for Cloudinary's free plan,
// sharp enough for an admin to read a license. Raise this to 2000 if documents look blurry.
const MAX_PHOTO_SIDE = 1600;
const JPEG_QUALITY = 0.7;

// Shows "Take photo" / "Choose from gallery". Gives back "camera", "gallery", or null for Cancel.
const askPhotoSource = () =>
  new Promise((resolve) => {
    Alert.alert(
      "Add a photo",
      "Take a new photo, or choose one from your gallery.",
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        { text: "Choose from gallery", onPress: () => resolve("gallery") },
        { text: "Take photo", onPress: () => resolve("camera") },
      ],
      // Tapping outside the pop-up counts as Cancel.
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });

// Makes the photo smaller (only if it is bigger than MAX_PHOTO_SIDE) and saves it as a JPEG.
// This also turns HEIC, PNG and other photo types into JPEG.
const shrinkPhoto = async (asset) => {
  const context = ImageManipulator.manipulate(asset.uri);
  const longestSide = Math.max(asset.width || 0, asset.height || 0);

  if (longestSide > MAX_PHOTO_SIDE) {
    // Giving only one side keeps the photo's shape.
    context.resize(asset.width >= asset.height ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE });
  }

  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
};

// Gives back a small JPEG photo ({ uri, width, height }), or null if the person cancelled.
// On the website there is no camera choice: the browser's file chooser opens right away.
export async function pickPhoto() {
  const source = Platform.OS === "web" ? "gallery" : await askPhotoSource();
  if (!source) return null;

  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera not allowed",
        "To take a photo, allow SakayNa to use the camera in your phone's Settings. You can also choose a photo from your gallery."
      );
      return null;
    }
  }

  // Photos only, no videos. Full quality here, because shrinkPhoto does the shrinking.
  const options = { mediaTypes: ["images"], quality: 1 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;

  return shrinkPhoto(result.assets[0]);
}

// Sends ONE photo to Cloudinary and gives back its link.
// "folder" groups the photos in Cloudinary; "name" is the start of the photo's file name there.
export async function uploadPhoto(photo, { folder, name }) {
  if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error("Cloudinary is not configured.");
  }

  const formData = new FormData();
  formData.append("upload_preset", cloudinaryUploadPreset);
  formData.append("folder", folder);
  formData.append("public_id", `${name}-${Date.now()}`);

  if (Platform.OS === "web") {
    const fileBlob = await (await fetch(photo.uri)).blob();
    formData.append("file", fileBlob, `${name}.jpg`);
  } else {
    formData.append("file", { uri: photo.uri, name: `${name}.jpg`, type: "image/jpeg" });
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const uploadResult = await response.json();

  if (!response.ok || !uploadResult.secure_url) {
    throw new Error(uploadResult.error?.message || "Cloudinary upload failed.");
  }

  return uploadResult.secure_url;
}

// Sends the photos ONE AT A TIME (not all at once), so slow mobile data has a better chance,
// and the screen can show "Uploading photo 2 of 4...". If one fails, it stops there.
// onProgress(current, total) is called before each photo is sent.
export async function uploadPhotos(photos, { folder, name }, onProgress) {
  const links = [];

  for (let index = 0; index < photos.length; index += 1) {
    onProgress?.(index + 1, photos.length);
    links.push(await uploadPhoto(photos[index], { folder, name: `${name}-${index + 1}` }));
  }

  return links;
}

function cloudName() {
  return (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "").trim();
}

export function cloudinaryImageUrl({ publicId, version, width, height, crop = "fill" } = {}) {
  const cloud = cloudName();
  if (!cloud || !publicId) return "";
  const transforms = ["f_auto", "q_auto"];
  if (width) transforms.push(`w_${Math.round(width)}`);
  if (height) transforms.push(`h_${Math.round(height)}`);
  if (width || height) transforms.push(`c_${crop}`);
  const v = version ? `/v${version}` : "";
  return `https://res.cloudinary.com/${cloud}/image/upload/${transforms.join(",")}${v}/${publicId}`;
}

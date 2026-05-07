import { supabase } from "@/lib/supabase";

export const CAT_IMAGES_BUCKET = "cat-images";

/** 单张图片上限（字节） */
export const MAX_CAT_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFromMime(mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/** 校验通过返回 null，否则返回中文错误说明。 */
export function validateCatImageFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return "仅支持 JPG、PNG、WebP 格式的图片。";
  }
  if (!extFromMime(file.type)) {
    return "图片类型无效。";
  }
  const lower = file.name.toLowerCase();
  const okExt =
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp");
  if (!okExt) {
    return "请使用 .jpg、.jpeg、.png 或 .webp 扩展名。";
  }
  if (file.size > MAX_CAT_IMAGE_BYTES) {
    return "图片大小不能超过 5MB。";
  }
  if (file.size <= 0) {
    return "文件无效。";
  }
  return null;
}

/**
 * 上传到 Storage，返回公开访问 URL。
 * @param pathPrefix 对象路径前缀（不含首尾斜杠），如 `uploads` 或 `cats/<uuid>`
 */
export async function uploadCatImage(
  file: File,
  pathPrefix: string,
): Promise<{ url: string } | { error: string }> {
  const validation = validateCatImageFile(file);
  if (validation) return { error: validation };

  const ext = extFromMime(file.type);
  if (!ext) return { error: "图片类型无效。" };

  const safePrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
  const path = `${safePrefix}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(CAT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data } = supabase.storage.from(CAT_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

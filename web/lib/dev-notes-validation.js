import { sanitizeMarkdown } from "@/lib/dev-notes";

export function validateDevNoteInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "入力内容を確認してください。" };
  }
  if (["title", "body", "category"].some((key) => typeof input[key] !== "string")) {
    return { error: "タイトル、本文、カテゴリーを入力してください。" };
  }

  const title = sanitizeMarkdown(input.title);
  const body = sanitizeMarkdown(input.body);
  const category = sanitizeMarkdown(input.category);
  const tags = Array.isArray(input.tags)
    ? [
        ...new Set(
          input.tags
            .filter((tag) => typeof tag === "string")
            .map((tag) => sanitizeMarkdown(tag).replace(/^#/, ""))
            .filter((tag) => tag && tag.length <= 30),
        ),
      ].slice(0, 12)
    : [];
  const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  const publishedAt = typeof input.publishedAt === "string" ? input.publishedAt : "";
  if (
    !title ||
    title.length > 120 ||
    !body ||
    body.length > 50_000 ||
    !category ||
    category.length > 40
  ) {
    return { error: "タイトル、本文、カテゴリーの文字数を確認してください。" };
  }
  if (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 2_000)) {
    return { error: "アイキャッチ画像にはHTTPSのURLを指定してください。" };
  }
  if (publishedAt && !Number.isFinite(Date.parse(publishedAt))) {
    return { error: "公開日時を確認してください。" };
  }

  const publishDate = publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString();
  return {
    note: {
      title,
      body,
      category,
      tags,
      imageUrl: imageUrl || null,
      summary:
        typeof input.summary === "string" ? sanitizeMarkdown(input.summary).slice(0, 300) : "",
      date: publishDate.slice(0, 10),
      publishedAt: publishDate,
      isPublished: input.isPublished === true,
    },
  };
}

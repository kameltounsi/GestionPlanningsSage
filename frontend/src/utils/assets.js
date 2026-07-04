export function safeImageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:|blob:|data:image\/|\/)/i.test(text)) return text;
  return "";
}

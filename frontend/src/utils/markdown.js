import { marked } from "marked";
import DOMPurify from "dompurify";

export function rendreMarkdown(source) {
  if (!source) return "";
  const html = marked.parse(source, { breaks: true });
  return DOMPurify.sanitize(html);
}

import { extractUrls, linkLabel } from "../lib/links";

interface Props {
  text: string;
}

/** Renders any URLs found in a block of free text as clickable links — the
 * textarea they live in can't contain a live <a> itself. */
export default function DetectedLinks({ text }: Props) {
  const urls = extractUrls(text);
  if (urls.length === 0) return null;

  return (
    <div className="detected-links">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="detected-link">
          🔗 {linkLabel(url)} ↗
        </a>
      ))}
    </div>
  );
}

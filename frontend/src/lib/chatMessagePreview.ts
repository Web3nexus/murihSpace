export function formatMessagePreview(msg?: { content?: string; type?: string; attachment_type?: string } | null): string {
  if (!msg) return "No messages yet";
  const content = typeof msg.content === "string" ? msg.content.trim() : "";
  const isCall =
    msg.type === "call" ||
    msg.attachment_type === "call" ||
    content.startsWith('{"call_id"') ||
    (content.startsWith("{") && content.includes('"call_id"'));

  if (isCall) {
    try {
      const d = JSON.parse(content);
      const isVideo = d.call_type === "video";
      const isMissed = d.status === "missed" || d.status === "declined";
      const dur = Number(d.duration) || 0;
      if (isMissed) {
        return isVideo ? "📹 Missed Video Call" : "📞 Missed Call";
      }
      if (dur > 0) {
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        const ds = m > 0 ? `${m}m ${s}s` : `${s}s`;
        return isVideo ? `📹 Video Call · ${ds}` : `📞 Voice Call · ${ds}`;
      }
      return isVideo ? "📹 Video Call" : "📞 Voice Call";
    } catch {
      return "📞 Call";
    }
  }

  if (msg.attachment_type === "image" || msg.type === "image") return "📷 Photo";
  if (msg.attachment_type === "video" || msg.type === "video") return "🎬 Video";
  if (msg.attachment_type === "voice" || msg.type === "voice") return "🎤 Voice message";
  if (msg.attachment_type === "file" || msg.type === "file") return "📎 File";

  if (!msg.content) return "No messages yet";
  return msg.content;
}

// Builds a pre-filled "ask if they're in" text for a kit-collection contact,
// opened via the sms: URI scheme so the phone's own Messages app shows the
// number and message ready to review — nothing is ever sent from here.

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || "";
  if (!first) return "there";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * The standard "will you be in tomorrow" message, personalized with the
 * contact's first name — for starting contact on a job, before they've
 * replied.
 */
export function initialContactMessage(customerName: string): string {
  const name = firstName(customerName);
  return `Hi ${name}, I’ve been asked to come and collect some BCA kit off you tomorrow. Will you be at home during the day? Are you still at the same address? Kind Rgds, Mark (BCA - Forde).`;
}

/**
 * Just a personalized greeting, left open for whatever comes next — for
 * replying once they've already responded, where the initial script no
 * longer applies and the message has to be specific to what they said.
 */
export function followUpMessage(customerName: string): string {
  return `Hi ${firstName(customerName)}, `;
}

// iOS and Android disagree on the separator between the number and the
// body param (iOS: &, Android: ?) — sniffing avoids sending an iPhone user
// to a blank Messages compose screen with the text lost.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** An sms: link that opens Messages with `phone` and `body` pre-filled, unsent. */
export function smsHref(phone: string, body: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  const separator = isIOS() ? "&" : "?";
  return `sms:${digits}${separator}body=${encodeURIComponent(body)}`;
}

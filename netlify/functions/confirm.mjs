// Sends Julie a confirmation text through Semaphore when she submits "Yes".
//
// Set these in Netlify → Site configuration → Environment variables:
//   SEMAPHORE_API_KEY  (required) your Semaphore API key
//   JULIE_NUMBER       (required) e.g. 09171234567
//   SMS_MESSAGE        (optional) replaces DEFAULT_MESSAGE below
//   SEMAPHORE_SENDER   (optional) approved sender name; Semaphore uses "SEMAPHORE" if empty
import { getStore } from "@netlify/blobs";

// Plain text only: emojis can show up as "?" on some phones and make the text cost more.
const DEFAULT_MESSAGE =
  "Hi Julie! It's official: breakfast tayo sa Saturday, 8:00 AM. " +
  "Text me if anything changes. See you! :)";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const apikey = Netlify.env.get("SEMAPHORE_API_KEY");
  const number = (Netlify.env.get("JULIE_NUMBER") || "").replace(/\D/g, "");
  const message = Netlify.env.get("SMS_MESSAGE") || DEFAULT_MESSAGE;
  const sender = Netlify.env.get("SEMAPHORE_SENDER");
  if (!apikey || !number) {
    console.error("SEMAPHORE_API_KEY or JULIE_NUMBER is not set");
    return json({ ok: false, error: "not configured" }, 500);
  }

  // Only ever text each number once, so nobody can reload the page and drain your credits.
  const store = getStore("sms-sent");
  if (await store.get(number)) return json({ ok: true, alreadySent: true });

  const body = new URLSearchParams({ apikey, number, message });
  if (sender) body.set("sendername", sender);

  const res = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body });
  const data = await res.text();
  if (!res.ok) {
    console.error("Semaphore error", res.status, data);
    return json({ ok: false, error: "sms failed" }, 502);
  }

  console.log("Semaphore response", data);
  await store.set(number, new Date().toISOString());
  return json({ ok: true });
};

export const config = { path: "/api/confirm" };

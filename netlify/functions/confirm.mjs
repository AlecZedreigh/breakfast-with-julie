// Texts Julie a confirmation from YOUR OWN phone number when she confirms "Yes".
// Uses the free "SMS Gateway for Android" app (sms-gate.app) in Cloud Server mode.
//
// Set these in Netlify → Site configuration → Environment variables:
//   SMSGATE_USERNAME  (required) shown in the app under "Cloud Server"
//   SMSGATE_PASSWORD  (required) shown in the app under "Cloud Server"
//   JULIE_NUMBER      (required) e.g. 09171234567
//   SMS_MESSAGE       (optional) replaces DEFAULT_MESSAGE below
import { getStore } from "@netlify/blobs";

const DEFAULT_MESSAGE =
  "Hi Julie! It's official: breakfast tayo sa Saturday, 8:00 AM. " +
  "Text me if anything changes. See you! :)";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// 09171234567 / 9171234567 / 639171234567 → +639171234567
const toInternational = raw => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63")) return "+" + digits;
  if (digits.startsWith("0")) return "+63" + digits.slice(1);
  return "+63" + digits;
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const username = Netlify.env.get("SMSGATE_USERNAME");
  const password = Netlify.env.get("SMSGATE_PASSWORD");
  const rawNumber = Netlify.env.get("JULIE_NUMBER") || "";
  const message = Netlify.env.get("SMS_MESSAGE") || DEFAULT_MESSAGE;
  if (!username || !password || !rawNumber) {
    console.log("SMS is off: SMSGATE_USERNAME, SMSGATE_PASSWORD or JULIE_NUMBER is not set");
    return json({ ok: false, error: "not configured" }, 503);
  }
  const number = toInternational(rawNumber);

  // Only ever text each number once, so reloading the page can't spam her.
  const store = getStore("sms-sent");
  if (await store.get(number)) return json({ ok: true, alreadySent: true });

  const res = await fetch("https://api.sms-gate.app/3rdparty/v1/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${username}:${password}`),
    },
    body: JSON.stringify({ textMessage: { text: message }, phoneNumbers: [number] }),
  });
  const data = await res.text();
  if (!res.ok) {
    console.error("SMS Gateway error", res.status, data);
    return json({ ok: false, error: "sms failed" }, 502);
  }

  console.log("SMS Gateway response", data);
  await store.set(number, new Date().toISOString());
  return json({ ok: true });
};

export const config = { path: "/api/confirm" };

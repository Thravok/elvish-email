import React, { useState, useEffect } from "react";

const SENDER_AVATAR_COLORS = [
  { id: "pink", bg: "linear-gradient(135deg, #ff80b5, #c14d85)", fg: "#fff7fb" },
  { id: "yellow", bg: "linear-gradient(135deg, #ffd36a, #b38316)", fg: "#fffaf0" },
  { id: "red", bg: "linear-gradient(135deg, #ff7b7b, #bb4040)", fg: "#fff5f5" },
  { id: "orange", bg: "linear-gradient(135deg, #ffad66, #c76321)", fg: "#fff7f0" },
  { id: "green", bg: "linear-gradient(135deg, #74dca8, #25865d)", fg: "#f4fff8" },
  { id: "blue", bg: "linear-gradient(135deg, #7aa8ff, #3f5bd1)", fg: "#f5f8ff" },
  { id: "dark-blue", bg: "linear-gradient(135deg, #7f8fb6, #35425e)", fg: "#f4f7fd" },
];
const SENDER_AVATAR_COLOR_MAP = SENDER_AVATAR_COLORS.reduce((acc, color) => {
  acc[color.id] = color;
  return acc;
}, {});

const SENDER_ICON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SENDER_ICON_CACHE_PREFIX = "elvish:sender-icon:";

const pendingIconFetches = new Map();

function senderAvatarInitial(label) {
  const raw = String(label || "").trim();
  if (!raw) return "?";
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  const cleaned = local.replace(/[^a-z0-9]/gi, "");
  return (cleaned[0] || local[0] || "?").toUpperCase();
}

function pickSenderAvatarColor(seed, preferredColor) {
  if (preferredColor && SENDER_AVATAR_COLOR_MAP[preferredColor]) return preferredColor;
  const value = String(seed || "").trim().toLowerCase();
  if (!value) return "blue";
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) {
    sum += value.charCodeAt(i) * (i + 1);
  }
  return SENDER_AVATAR_COLORS[sum % SENDER_AVATAR_COLORS.length].id;
}

function extractDomain(email) {
  if (!email || typeof email !== "string") return "";
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 0) return "";
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain.includes(".")) return "";
  return domain;
}

function getCachedSenderIcon(domain) {
  if (!domain) return null;
  try {
    const raw = localStorage.getItem(SENDER_ICON_CACHE_PREFIX + domain);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached.fetched_at !== "number") return null;
    const age = Date.now() - cached.fetched_at;
    if (age > SENDER_ICON_CACHE_TTL_MS) {
      localStorage.removeItem(SENDER_ICON_CACHE_PREFIX + domain);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function setCachedSenderIcon(domain, data) {
  if (!domain) return;
  try {
    localStorage.setItem(SENDER_ICON_CACHE_PREFIX + domain, JSON.stringify({
      ...data,
      fetched_at: Date.now(),
    }));
  } catch {
    // localStorage might be full or disabled
  }
}

async function fetchSenderIcon(domain) {
  if (!domain) return null;

  if (pendingIconFetches.has(domain)) {
    return pendingIconFetches.get(domain);
  }

  const fetchPromise = (async () => {
    try {
      const resp = await fetch(`/api/v1/mail/sender-icon?domain=${encodeURIComponent(domain)}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      setCachedSenderIcon(domain, data);
      return data;
    } catch {
      return null;
    } finally {
      pendingIconFetches.delete(domain);
    }
  })();

  pendingIconFetches.set(domain, fetchPromise);
  return fetchPromise;
}

export function useSenderIcon(email) {
  const domain = extractDomain(email);
  const [iconState, setIconState] = useState(() => {
    const cached = getCachedSenderIcon(domain);
    if (cached) {
      return { loading: false, data: cached };
    }
    return { loading: !!domain, data: null };
  });

  useEffect(() => {
    if (!domain) {
      setIconState({ loading: false, data: null });
      return;
    }

    const cached = getCachedSenderIcon(domain);
    if (cached) {
      setIconState({ loading: false, data: cached });
      return;
    }

    let cancelled = false;
    setIconState((prev) => ({ ...prev, loading: true }));

    fetchSenderIcon(domain).then((data) => {
      if (!cancelled) {
        setIconState({ loading: false, data });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [domain]);

  return iconState;
}

export function SenderAvatar({ senderLabel, senderId, profile }) {
  const visibleProfile = profile && profile.visible ? profile : null;
  const colorId = pickSenderAvatarColor(senderId || senderLabel, visibleProfile && visibleProfile.avatar_color);
  const palette = SENDER_AVATAR_COLOR_MAP[colorId] || SENDER_AVATAR_COLOR_MAP.blue;
  const label = visibleProfile ? (visibleProfile.primary_uid || visibleProfile.email || senderLabel) : senderLabel;
  const profileAvatarDataUrl = visibleProfile && visibleProfile.avatar_data_url ? visibleProfile.avatar_data_url : "";
  const showStatus = !!(visibleProfile && visibleProfile.status_badge_visible);

  const { data: iconData } = useSenderIcon(senderId);
  const brandIconUrl = iconData && iconData.icon_data_url ? iconData.icon_data_url : "";
  const iconSource = iconData ? iconData.source : "none";

  const avatarDataUrl = profileAvatarDataUrl || brandIconUrl;
  const isBIMI = !profileAvatarDataUrl && iconSource === "bimi";

  return (
    <div
      className={`mail-item-avatar ${avatarDataUrl ? "has-image" : ""} ${isBIMI ? "bimi-verified" : ""}`}
      style={{
        "--sender-avatar-bg": palette.bg,
        "--sender-avatar-fg": palette.fg,
      }}
      title={isBIMI ? `${label || "Sender"} (BIMI verified)` : (label || "Sender avatar")}
      aria-hidden="true"
    >
      {avatarDataUrl ? (
        <img src={avatarDataUrl} alt="" className="mail-item-avatar-image" />
      ) : (
        <span className="mail-item-avatar-initial">{senderAvatarInitial(label)}</span>
      )}
      {isBIMI && <span className="mail-item-avatar-bimi" title="BIMI verified sender"></span>}
      {showStatus && <span className="mail-item-avatar-status"></span>}
    </div>
  );
}

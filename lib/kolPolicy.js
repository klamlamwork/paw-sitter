export const KOL_RETURN_WINDOW_DAYS = 7;
export const KOL_REWARD_HOLD_DAYS = 7;
export const KOL_UPLOAD_TTL_MINUTES = 55;
export const KOL_ORPHAN_HOURS = 24;
export const KOL_COMMUNITY_VIDEO_MAX_SECONDS = 15 * 60;

export const KOL_LIMITS = {
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  videoMaxSeconds: 90,
  maxImages: 10,
  maxVideos: 1,
};

export const KOL_REWARDS = {
  verified_photo: 500,
  verified_video: 2000,
  community_photo: 300,
  community_video: 800,
};

export function rewardFor({ sourceType, hasVideo, hasPhoto }) {
  if (sourceType === "verified_purchase") {
    if (hasVideo) return KOL_REWARDS.verified_video;
    if (hasPhoto) return KOL_REWARDS.verified_photo;
    return 0;
  }
  if (hasVideo) return KOL_REWARDS.community_video;
  if (hasPhoto) return KOL_REWARDS.community_photo;
  return 0;
}

export function communityEquivalentPoints(verifiedPoints) {
  if (verifiedPoints >= KOL_REWARDS.verified_video) return KOL_REWARDS.community_video;
  if (verifiedPoints >= KOL_REWARDS.verified_photo) return KOL_REWARDS.community_photo;
  return 0;
}

export function rewardSourceKey(postId) {
  return `kol_post:${postId}:published_reward`;
}

export function laterDate(a, b) {
  const da = a ? new Date(a).getTime() : 0;
  const db = b ? new Date(b).getTime() : 0;
  return new Date(Math.max(da, db)).toISOString();
}

export function addDays(iso, days) {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function orderBlocksVerifiedReward(order) {
  if (!order) return true;
  const returnBlocked = !["none", "rejected"].includes(order.return_status || "none");
  const refundBlocked = !["none", "chargeback_won"].includes(order.refund_status || "none");
  return returnBlocked || refundBlocked;
}

export function verifiedRewardAvailableAt(order, publishedAt) {
  const hold = addDays(publishedAt || new Date().toISOString(), KOL_REWARD_HOLD_DAYS);
  return laterDate(order?.return_window_ends_at, hold);
}

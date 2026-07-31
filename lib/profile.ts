// Deterministic profile audit. Objective, checkable best-practices only — the
// subjective "is the bio compelling" judgment is left to the optional AI layer.
// Honest by design: these are established practices you control, not predictions.

import type { Profile } from "./types";

export interface ProfileCheck {
  id: string;
  label: string;
  pass: boolean;
  hint: string; // what to do when it fails (or a note when it passes)
}

const BIO_MIN = 40; // a one-liner handle-drop wastes the highest-value real estate
const BIO_MAX = 160; // X hard limit
const RATIO_FLAG = 2; // following > 2x followers reads as low-signal once you're established
const RATIO_MIN_FOLLOWING = 200; // ...but don't flag brand-new accounts

/** Run the objective checklist against the latest profile snapshot. */
export function auditProfile(p: Profile | null): ProfileCheck[] {
  const bio = (p?.bio ?? "").trim();
  const name = (p?.name ?? "").trim();
  const handle = (p?.handle ?? "").replace(/^@+/, "").trim().toLowerCase();
  const following = p?.following ?? null;
  const followers = p?.followers ?? null;

  const checks: ProfileCheck[] = [];

  checks.push({
    id: "has_bio",
    label: "Bio is filled in",
    pass: bio.length > 0,
    hint: bio.length > 0 ? "You have a bio." : "Empty bio — this is prime real estate. Add one.",
  });

  if (bio.length > 0) {
    checks.push({
      id: "bio_substance",
      label: "Bio says what you do (not just a name-drop)",
      pass: bio.length >= BIO_MIN,
      hint:
        bio.length >= BIO_MIN
          ? "Bio has enough substance to convey a value prop."
          : `Bio is only ${bio.length} chars — spell out who you help and how.`,
    });
    checks.push({
      id: "bio_within_limit",
      label: "Bio fits X's 160-char limit",
      pass: bio.length <= BIO_MAX,
      hint: bio.length <= BIO_MAX ? "Within limit." : `Bio is ${bio.length} chars — trim to 160.`,
    });
  }

  checks.push({
    id: "has_link",
    label: "Profile has a link",
    pass: !!(p?.url ?? "").trim(),
    hint: (p?.url ?? "").trim()
      ? "You have a link driving traffic."
      : "No link — add one (newsletter, site, or your best thread).",
  });

  checks.push({
    id: "has_pinned",
    label: "A tweet is pinned",
    pass: !!(p?.pinned_tweet ?? "").trim(),
    hint: (p?.pinned_tweet ?? "").trim()
      ? "You have a pinned tweet."
      : "Nothing pinned — pin your best-performing tweet so new visitors see it first.",
  });

  checks.push({
    id: "name_distinct",
    label: "Display name isn't just your @handle",
    pass: name.length > 0 && name.toLowerCase() !== handle && name.toLowerCase() !== `@${handle}`,
    hint:
      name.length > 0 && name.toLowerCase() !== handle
        ? "Display name adds identity beyond the handle."
        : "Use your real/brand name (people follow people), not just the @handle.",
  });

  if (following != null && followers != null) {
    const spammy = following > followers * RATIO_FLAG && following > RATIO_MIN_FOLLOWING;
    checks.push({
      id: "healthy_ratio",
      label: "Following/followers ratio looks credible",
      pass: !spammy,
      hint: spammy
        ? `Following ${following} vs ${followers} followers reads as low-signal — prune who you follow.`
        : "Ratio looks fine.",
    });
  }

  return checks;
}

/** 0–100 completeness score = share of checks passed. */
export function profileScore(checks: ProfileCheck[]): number {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
}

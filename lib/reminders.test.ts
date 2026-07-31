// Engine tests for the reminders builder. Run with: npm test  (Node 24 node:test,
// native TS type-stripping — no test framework dependency).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReminders, priorityRank, type ReminderInput } from "./reminders.ts";

// A baseline where NOTHING is due — every rule is satisfied.
function clear(): ReminderInput {
  return {
    today: "2026-07-31",
    dueDrafts: [],
    postsToday: 1,
    streak: 3,
    todayActive: true,
    repliesToday: 10,
    replyGoal: 10,
    targetsUnchecked: 0,
    followerLoggedToday: true,
  };
}

test("all-clear input produces no reminders", () => {
  assert.deepEqual(buildReminders(clear()), []);
});

test("each due draft becomes its own high-priority reminder", () => {
  const r = buildReminders({
    ...clear(),
    dueDrafts: [
      { id: 5, body: "first tweet" },
      { id: 9, body: "second tweet" },
    ],
  });
  const due = r.filter((x) => x.kind === "due_post");
  assert.equal(due.length, 2);
  assert.deepEqual(
    due.map((x) => x.id),
    ["due_post:5", "due_post:9"]
  );
  assert.ok(due.every((x) => x.priority === "high"));
});

test("due-draft body is collapsed and truncated to 100 chars", () => {
  const long = "a".repeat(200);
  const [r] = buildReminders({ ...clear(), dueDrafts: [{ id: 1, body: `x\n\n  ${long}` }] });
  assert.equal(r.body.length, 100);
});

test("streak_risk fires only when today inactive AND streak > 0", () => {
  assert.ok(
    buildReminders({ ...clear(), todayActive: false, streak: 4 }).some(
      (x) => x.kind === "streak_risk"
    )
  );
  // No streak → no risk reminder.
  assert.ok(
    !buildReminders({ ...clear(), todayActive: false, streak: 0 }).some(
      (x) => x.kind === "streak_risk"
    )
  );
  // Already active today → not at risk.
  assert.ok(
    !buildReminders({ ...clear(), todayActive: true, streak: 4 }).some(
      (x) => x.kind === "streak_risk"
    )
  );
});

test("post_today fires when nothing posted", () => {
  assert.ok(buildReminders({ ...clear(), postsToday: 0 }).some((x) => x.kind === "post_today"));
});

test("reply_goal reports the remaining count and singular grammar", () => {
  const many = buildReminders({ ...clear(), repliesToday: 3, replyGoal: 10 }).find(
    (x) => x.kind === "reply_goal"
  );
  assert.equal(many?.count, 7);
  assert.match(many!.body, /7 more replies/);

  const one = buildReminders({ ...clear(), repliesToday: 9, replyGoal: 10 }).find(
    (x) => x.kind === "reply_goal"
  );
  assert.match(one!.body, /1 more reply\b/);

  // Goal met → no reminder.
  assert.ok(
    !buildReminders({ ...clear(), repliesToday: 10, replyGoal: 10 }).some(
      (x) => x.kind === "reply_goal"
    )
  );
});

test("targets_unchecked pluralizes and carries a count", () => {
  const r = buildReminders({ ...clear(), targetsUnchecked: 1 }).find(
    (x) => x.kind === "targets_unchecked"
  );
  assert.equal(r?.count, 1);
  assert.match(r!.title, /1 reply target to check/);
});

test("follower_log is low priority and fires when not logged", () => {
  const r = buildReminders({ ...clear(), followerLoggedToday: false }).find(
    (x) => x.kind === "follower_log"
  );
  assert.equal(r?.priority, "low");
});

test("results are ordered most-urgent first", () => {
  const r = buildReminders({
    today: "2026-07-31",
    dueDrafts: [{ id: 1, body: "due" }],
    postsToday: 0,
    streak: 2,
    todayActive: false,
    repliesToday: 0,
    replyGoal: 10,
    targetsUnchecked: 2,
    followerLoggedToday: false,
  });
  const ranks = r.map((x) => priorityRank(x.priority));
  const sorted = [...ranks].sort((a, b) => b - a);
  assert.deepEqual(ranks, sorted);
  assert.equal(r[0].priority, "high");
  assert.equal(r[r.length - 1].kind, "follower_log");
});

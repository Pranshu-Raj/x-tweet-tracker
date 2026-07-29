// Reply framework catalog (F4). Deterministic, offline — no AI, no API.
// You write the actual words; these give you a proven structure to fill in.
// See docs/FEATURES.md §F4.

export interface ReplyFramework {
  name: string;
  intent: string;
  scaffold: string;
}

export const REPLY_FRAMEWORKS: ReplyFramework[] = [
  {
    name: "Add a specific example",
    intent: "Extend their point with a concrete case — specifics earn attention.",
    scaffold:
      "Concrete example of this: <a specific situation, tool, or number>.\n\nIt held because <the reason it worked>.",
  },
  {
    name: "Respectful disagree",
    intent: "Push back without being combative — disagreement drives replies.",
    scaffold:
      "One counter: <the exception or nuance> — because <your reason>.\n\nCurious if you've seen it go the other way.",
  },
  {
    name: "Extend the point",
    intent: "Take their idea one step further — shows you actually thought about it.",
    scaffold:
      "This also applies to <adjacent area>.\n\nSame principle, and it matters even more when <condition>.",
  },
  {
    name: "Sharp follow-up question",
    intent: "Ask something that invites them to say more — starts a thread.",
    scaffold:
      "Genuine question: how do you handle <the hard edge case>?\n\nThat's the part I keep getting stuck on.",
  },
  {
    name: "Personal data point",
    intent: "Share a first-hand result — lived experience is credible and repliable.",
    scaffold:
      "In my experience: <what you did> → <the specific outcome / number>.\n\nMatches what you're saying about <their point>.",
  },
];

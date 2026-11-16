export type MailStep = {
  day: number;
  subject: string;
  body: string;
};

export type MailSequence = {
  slug: string;
  name: string;
  audience: string;
  status: "Draft";
  steps: MailStep[];
};

export const sequences: MailSequence[] = [
  {
    slug: "after-the-first-conversation",
    name: "After the first conversation",
    audience: "Sales · Talking",
    status: "Draft",
    steps: [
      {
        day: 0,
        subject: "Good to meet you",
        body: "A short note after the first conversation, in the workspace’s own voice. The sender is not connected, so this stays a draft.",
      },
      {
        day: 3,
        subject: "The thing we left open",
        body: "A nudge toward the question that did not get answered. Still a draft. Nothing is queued.",
      },
      {
        day: 7,
        subject: "Should I close the book?",
        body: "A last polite check before the card goes quiet. This step will not send.",
      },
    ],
  },
  {
    slug: "welcome-to-the-shop",
    name: "Welcome to the shop",
    audience: "Onboarding · Welcome",
    status: "Draft",
    steps: [
      {
        day: 0,
        subject: "You are on the book",
        body: "The note a new client gets the day they are won. It will leave from the workspace’s own address, once a sender is connected.",
      },
      {
        day: 2,
        subject: "What we need from you",
        body: "Access, assets, and the one decision that unblocks setup. Placeholder copy only.",
      },
      {
        day: 6,
        subject: "The first small win",
        body: "A check that the first promised thing actually happened. Not scheduled.",
      },
    ],
  },
  {
    slug: "the-quiet-nudge",
    name: "The quiet nudge",
    audience: "Quiet for 7 days",
    status: "Draft",
    steps: [
      {
        day: 0,
        subject: "Still on my counter",
        body: "A gentle note for a person or organization with no touch in a week. Draft only.",
      },
      {
        day: 4,
        subject: "A smaller ask",
        body: "If the first note gets nothing, this one asks for less. It does not send.",
      },
      {
        day: 9,
        subject: "I will leave it here",
        body: "Closes the loop without a hard sell. Held until Mail is live.",
      },
    ],
  },
];

export function sequenceBySlug(slug: string) {
  return sequences.find((sequence) => sequence.slug === slug) ?? null;
}

export const agentScopes = [
  { id: "read_people", label: "Read people", detail: "Names, titles, and how to reach them." },
  { id: "read_organizations", label: "Read organizations", detail: "The companies on the book, and who belongs to them." },
  { id: "move_cards", label: "Move cards", detail: "Advance a sales or onboarding card one stage." },
  { id: "write_notes", label: "Write notes", detail: "Leave a note on the timeline, in the member’s name." },
];

export const sampleAudit = [
  {
    when: "Sample",
    who: "A future assistant",
    tool: "Read people",
    result: "Would list this workspace only",
  },
  {
    when: "Sample",
    who: "A future assistant",
    tool: "Move cards",
    result: "Would not run",
  },
  {
    when: "Sample",
    who: "A future assistant",
    tool: "Write notes",
    result: "Would ask first",
  },
];

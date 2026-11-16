import type { PipelineKind, StageKind } from "@/lib/types";

export const PIPELINES: {
  kind: PipelineKind;
  name: string;
  stages: { name: string; kind: StageKind }[];
}[] = [
  {
    kind: "sales",
    name: "Sales",
    stages: [
      { name: "New", kind: "open" },
      { name: "Talking", kind: "open" },
      { name: "Proposal", kind: "open" },
      { name: "Won", kind: "won" },
      { name: "Lost", kind: "lost" },
    ],
  },
  {
    kind: "onboarding",
    name: "Onboarding",
    stages: [
      { name: "Welcome", kind: "open" },
      { name: "Setup", kind: "open" },
      { name: "First win", kind: "open" },
      { name: "Steady", kind: "done" },
    ],
  },
];

export const ONBOARDING_STEPS = [
  "Kickoff note sent",
  "Access shared",
  "First win logged",
];

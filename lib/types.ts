export type Plan = "free" | "pro";
export type PipelineKind = "sales" | "onboarding";
export type StageKind = "open" | "won" | "lost" | "done";
export type ActivityKind = "note" | "stage_change" | "created";

export type BoardStage = {
  id: string;
  name: string;
  kind: StageKind;
  position: number;
};

export type BoardCard = {
  id: string;
  title: string;
  stageId: string;
  organizationName: string;
  personName: string | null;
  valueCents: number | null;
  quiet: boolean;
  checklistDone: number;
  checklistTotal: number;
  nextText: string | null;
};

export type TimelineItem = {
  id: string;
  kind: ActivityKind;
  body: string;
  when: string;
};

export type NextActionView = {
  id: string;
  text: string;
  dueOn: string;
  overdue: boolean;
};

export type LinkedCard = {
  id: string;
  title: string;
  stageName: string;
  href: string;
};

export type Choice = {
  id: string;
  name: string;
};

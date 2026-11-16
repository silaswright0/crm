import { and, eq } from "drizzle-orm";
import { daysAgo, isoDaysFromNow } from "@/lib/format";
import { ONBOARDING_STEPS, PIPELINES } from "@/lib/pipelines";
import type { Database } from "@/lib/db";
import {
  activities,
  cards,
  checklistItems,
  nextActions,
  organizations,
  people,
  pipelines,
  stages,
} from "@/lib/db/schema";
import type { ActivityKind } from "@/lib/types";

type SeedDb = Pick<Database, "insert" | "select">;

export async function seedWorkspace(database: SeedDb, workspaceId: string) {
  const existing = await database
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.workspaceId, workspaceId));
  if (existing.length > 0) return;

  const stageIds = new Map<string, string>();

  for (const pipeline of PIPELINES) {
    const [created] = await database
      .insert(pipelines)
      .values({ workspaceId, kind: pipeline.kind, name: pipeline.name })
      .returning({ id: pipelines.id });
    if (!created) throw new Error("Could not open a pipeline.");

    for (const [position, stage] of pipeline.stages.entries()) {
      const [row] = await database
        .insert(stages)
        .values({
          workspaceId,
          pipelineId: created.id,
          name: stage.name,
          position,
          kind: stage.kind,
        })
        .returning({ id: stages.id });
      if (!row) throw new Error("Could not open a stage.");
      stageIds.set(`${pipeline.kind}:${stage.name}`, row.id);
    }
  }

  const org = async (
    name: string,
    domain: string,
    industry: string,
    createdAt: Date,
  ) => {
    const [row] = await database
      .insert(organizations)
      .values({ workspaceId, name, domain, industry, createdAt, updatedAt: createdAt })
      .returning({ id: organizations.id });
    if (!row) throw new Error("Could not add an organization.");
    return row.id;
  };

  const person = async (input: {
    name: string;
    email: string;
    phone?: string;
    title?: string;
    organizationId?: string;
    createdAt: Date;
  }) => {
    const [row] = await database
      .insert(people)
      .values({
        workspaceId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        title: input.title,
        organizationId: input.organizationId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning({ id: people.id });
    if (!row) throw new Error("Could not add a person.");
    return row.id;
  };

  const northglass = await org("Northglass Studio", "northglass.studio", "Design", daysAgo(40));
  const harbor = await org("Harbor & Rye", "harborandrye.com", "Hospitality", daysAgo(36));
  const oven = await org("Little Oven", "littleoven.co", "Bakery", daysAgo(28));
  const fieldnote = await org("Fieldnote Press", "fieldnotepress.com", "Publishing", daysAgo(32));
  const lantern = await org("Quiet Lantern", "quietlantern.com", "Retail", daysAgo(48));
  const maple = await org("Maple Desk", "mapledesk.com", "Furniture", daysAgo(6));
  const kin = await org("Kin Goods", "kingoods.com", "Wholesale", daysAgo(24));
  const paper = await org("Paper Boat", "paperboat.press", "Editorial", daysAgo(21));

  const ada = await person({
    name: "Ada Voss",
    email: "ada@northglass.studio",
    phone: "415-555-0148",
    title: "Principal",
    organizationId: northglass,
    createdAt: daysAgo(40),
  });
  const miles = await person({
    name: "Miles Chen",
    email: "miles@northglass.studio",
    title: "Producer",
    organizationId: northglass,
    createdAt: daysAgo(40),
  });
  const ruth = await person({
    name: "Ruth Hale",
    email: "ruth@harborandrye.com",
    phone: "207-555-0194",
    title: "Owner",
    organizationId: harbor,
    createdAt: daysAgo(36),
  });
  const jonah = await person({
    name: "Jonah Peck",
    email: "jonah@harborandrye.com",
    title: "General manager",
    organizationId: harbor,
    createdAt: daysAgo(30),
  });
  const lila = await person({
    name: "Lila Ortiz",
    email: "lila@littleoven.co",
    phone: "503-555-0172",
    title: "Founder",
    organizationId: oven,
    createdAt: daysAgo(28),
  });
  const samir = await person({
    name: "Samir Shah",
    email: "samir@littleoven.co",
    title: "Baker",
    organizationId: oven,
    createdAt: daysAgo(20),
  });
  const edith = await person({
    name: "Edith Park",
    email: "edith@fieldnotepress.com",
    title: "Publisher",
    organizationId: fieldnote,
    createdAt: daysAgo(32),
  });
  const june = await person({
    name: "June Calder",
    email: "june@quietlantern.com",
    phone: "347-555-0116",
    title: "Buyer",
    organizationId: lantern,
    createdAt: daysAgo(48),
  });
  const theo = await person({
    name: "Theo Marsh",
    email: "theo@mapledesk.com",
    title: "Maker",
    organizationId: maple,
    createdAt: daysAgo(6),
  });
  const helen = await person({
    name: "Helen Cho",
    email: "helen@kingoods.com",
    title: "Buyer",
    organizationId: kin,
    createdAt: daysAgo(24),
  });
  const priya = await person({
    name: "Priya Nair",
    email: "priya@nair.studio",
    title: "Writer",
    createdAt: daysAgo(2),
  });
  const camille = await person({
    name: "Camille Brooks",
    email: "camille@paperboat.press",
    title: "Editor",
    organizationId: paper,
    createdAt: daysAgo(21),
  });

  const stage = (key: string) => {
    const id = stageIds.get(key);
    if (!id) throw new Error(`Missing stage ${key}`);
    return id;
  };

  const pipelineId = async (kind: "sales" | "onboarding") => {
    const [row] = await database
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(and(eq(pipelines.workspaceId, workspaceId), eq(pipelines.kind, kind)));
    if (!row) throw new Error(`Missing ${kind} pipeline`);
    return row.id;
  };

  const salesId = await pipelineId("sales");
  const onboardingId = await pipelineId("onboarding");

  const card = async (input: {
    pipelineId: string;
    stageId: string;
    organizationId: string;
    personId: string;
    title: string;
    valueCents?: number;
    createdAt: Date;
    checks?: { label: string; done: boolean }[];
  }) => {
    const [row] = await database
      .insert(cards)
      .values({
        workspaceId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        organizationId: input.organizationId,
        personId: input.personId,
        title: input.title,
        valueCents: input.valueCents,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning({ id: cards.id });
    if (!row) throw new Error("Could not add a card.");
    const steps = input.checks ?? (input.pipelineId === onboardingId
      ? ONBOARDING_STEPS.map((label) => ({ label, done: false }))
      : []);
    if (steps.length > 0) {
      await database.insert(checklistItems).values(
        steps.map((step, position) => ({
          cardId: row.id,
          label: step.label,
          done: step.done,
          position,
        })),
      );
    }
    return row.id;
  };

  const spring = await card({
    pipelineId: salesId,
    stageId: stage("sales:Talking"),
    organizationId: northglass,
    personId: ada,
    title: "Spring identity",
    valueCents: 420_000,
    createdAt: daysAgo(12),
  });
  const dining = await card({
    pipelineId: salesId,
    stageId: stage("sales:Proposal"),
    organizationId: harbor,
    personId: ruth,
    title: "Private dining site",
    valueCents: 1_280_000,
    createdAt: daysAgo(18),
  });
  const launch = await card({
    pipelineId: onboardingId,
    stageId: stage("onboarding:Setup"),
    organizationId: oven,
    personId: lila,
    title: "Shop launch",
    createdAt: daysAgo(9),
    checks: [
      { label: "Menu photographed", done: true },
      { label: "Domain pointed", done: false },
      { label: "First order week", done: false },
    ],
  });
  const reader = await card({
    pipelineId: onboardingId,
    stageId: stage("onboarding:First win"),
    organizationId: fieldnote,
    personId: edith,
    title: "Reader club",
    createdAt: daysAgo(16),
    checks: [
      { label: "Welcome note sent", done: true },
      { label: "Files shared", done: true },
      { label: "First issue shipped", done: false },
    ],
  });
  const windowCard = await card({
    pipelineId: salesId,
    stageId: stage("sales:Talking"),
    organizationId: lantern,
    personId: june,
    title: "Holiday window",
    valueCents: 90_000,
    createdAt: daysAgo(30),
  });
  const signs = await card({
    pipelineId: salesId,
    stageId: stage("sales:New"),
    organizationId: maple,
    personId: theo,
    title: "Showroom signs",
    valueCents: 240_000,
    createdAt: daysAgo(1),
  });
  const wholesale = await card({
    pipelineId: salesId,
    stageId: stage("sales:Won"),
    organizationId: kin,
    personId: helen,
    title: "Wholesale kit",
    valueCents: 310_000,
    createdAt: daysAgo(20),
  });

  const note = async (input: {
    cardId?: string;
    personId?: string;
    organizationId?: string;
    kind: ActivityKind;
    body: string;
    createdAt: Date;
  }) => {
    await database.insert(activities).values({
      workspaceId,
      cardId: input.cardId,
      personId: input.personId,
      organizationId: input.organizationId,
      kind: input.kind,
      body: input.body,
      createdAt: input.createdAt,
    });
  };

  await note({
    cardId: spring,
    personId: ada,
    organizationId: northglass,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(12),
  });
  await note({
    cardId: spring,
    personId: ada,
    organizationId: northglass,
    kind: "stage_change",
    body: "Moved from New to Talking.",
    createdAt: daysAgo(8),
  });
  await note({
    cardId: spring,
    personId: ada,
    organizationId: northglass,
    kind: "note",
    body: "Ada wants the mark to feel cut from metal, not drawn.",
    createdAt: daysAgo(1),
  });
  await note({
    cardId: spring,
    personId: miles,
    organizationId: northglass,
    kind: "note",
    body: "Miles will collect type samples before the next conversation.",
    createdAt: daysAgo(1),
  });

  await note({
    cardId: dining,
    personId: ruth,
    organizationId: harbor,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(18),
  });
  await note({
    cardId: dining,
    personId: ruth,
    organizationId: harbor,
    kind: "stage_change",
    body: "Moved from Talking to Proposal.",
    createdAt: daysAgo(2),
  });
  await note({
    cardId: dining,
    personId: jonah,
    organizationId: harbor,
    kind: "note",
    body: "Jonah will sit in when Ruth walks the proposal.",
    createdAt: daysAgo(2),
  });

  await note({
    cardId: launch,
    personId: lila,
    organizationId: oven,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(9),
  });
  await note({
    cardId: launch,
    personId: lila,
    organizationId: oven,
    kind: "stage_change",
    body: "Moved from Welcome to Setup.",
    createdAt: daysAgo(4),
  });
  await note({
    cardId: launch,
    personId: samir,
    organizationId: oven,
    kind: "note",
    body: "Samir sent the menu photos. The domain is still pointed at the old host.",
    createdAt: daysAgo(1),
  });

  await note({
    cardId: reader,
    personId: edith,
    organizationId: fieldnote,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(16),
  });
  await note({
    cardId: reader,
    personId: edith,
    organizationId: fieldnote,
    kind: "stage_change",
    body: "Moved from Setup to First win.",
    createdAt: daysAgo(3),
  });

  await note({
    cardId: windowCard,
    personId: june,
    organizationId: lantern,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(30),
  });
  await note({
    cardId: windowCard,
    personId: june,
    organizationId: lantern,
    kind: "stage_change",
    body: "Moved from New to Talking.",
    createdAt: daysAgo(16),
  });
  await note({
    cardId: windowCard,
    personId: june,
    organizationId: lantern,
    kind: "note",
    body: "June said she would confirm the window dates. Nothing since.",
    createdAt: daysAgo(16),
  });

  await note({
    cardId: signs,
    personId: theo,
    organizationId: maple,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(1),
  });

  await note({
    cardId: wholesale,
    personId: helen,
    organizationId: kin,
    kind: "created",
    body: "Opened the card.",
    createdAt: daysAgo(20),
  });
  await note({
    cardId: wholesale,
    personId: helen,
    organizationId: kin,
    kind: "stage_change",
    body: "Moved from Proposal to Won.",
    createdAt: daysAgo(5),
  });
  await note({
    cardId: wholesale,
    personId: helen,
    organizationId: kin,
    kind: "note",
    body: "Helen signed. The kit goes to onboarding when we are ready.",
    createdAt: daysAgo(5),
  });

  await note({
    personId: camille,
    organizationId: paper,
    kind: "note",
    body: "Camille asked for a look at the studio. No card yet.",
    createdAt: daysAgo(10),
  });
  await note({
    personId: priya,
    kind: "note",
    body: "Priya sent a manuscript sample. Not attached to a shop yet.",
    createdAt: daysAgo(2),
  });

  const step = async (input: {
    cardId: string;
    personId: string;
    organizationId: string;
    text: string;
    dueOn: string;
  }) => {
    await database.insert(nextActions).values({
      workspaceId,
      cardId: input.cardId,
      personId: input.personId,
      organizationId: input.organizationId,
      text: input.text,
      dueOn: input.dueOn,
    });
  };

  await step({
    cardId: spring,
    personId: ada,
    organizationId: northglass,
    text: "Send the revised mark",
    dueOn: isoDaysFromNow(1),
  });
  await step({
    cardId: dining,
    personId: ruth,
    organizationId: harbor,
    text: "Walk Ruth through the proposal",
    dueOn: isoDaysFromNow(3),
  });
  await step({
    cardId: launch,
    personId: lila,
    organizationId: oven,
    text: "Point the domain",
    dueOn: isoDaysFromNow(2),
  });
  await step({
    cardId: windowCard,
    personId: june,
    organizationId: lantern,
    text: "Ask June if the window is still open",
    dueOn: isoDaysFromNow(-10),
  });
  await step({
    cardId: signs,
    personId: theo,
    organizationId: maple,
    text: "Measure the showroom wall",
    dueOn: isoDaysFromNow(4),
  });
}

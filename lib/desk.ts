export const automationExamples = [
  {
    name: "After the first conversation",
    when: "A sales card enters Talking",
    then: "Email the person on the card that day.",
  },
  {
    name: "You are on the book",
    when: "An onboarding card enters Welcome",
    then: "Email them the day the sale is won.",
  },
  {
    name: "A form on your site",
    when: "A webhook arrives",
    then: "Email the address in the request.",
  },
];

export const mcpTools = [
  { group: "People", name: "list_people", detail: "Everyone on this book." },
  { group: "People", name: "get_person", detail: "One person, their organization, and their open cards." },
  { group: "People", name: "create_person", detail: "Add a person." },
  { group: "People", name: "update_person", detail: "Change a name, a title, or how to reach them." },
  { group: "Organizations", name: "list_organizations", detail: "The shops and companies on this book." },
  { group: "Organizations", name: "get_organization", detail: "One organization and the people on it." },
  { group: "Organizations", name: "create_organization", detail: "Add an organization." },
  { group: "Organizations", name: "update_organization", detail: "Change its name, domain, or industry." },
  { group: "Boards", name: "list_stages", detail: "The stages on Sales and Onboarding." },
  { group: "Boards", name: "list_cards", detail: "Open cards, with stage and value." },
  { group: "Boards", name: "get_card", detail: "One card, its checklist, and its timeline." },
  { group: "Boards", name: "create_card", detail: "Open a card on a stage." },
  { group: "Boards", name: "move_card", detail: "Move a card to another stage on the same board." },
  { group: "Boards", name: "update_card", detail: "Change the label, the person, or the value." },
  { group: "Boards", name: "delete_card", detail: "Take a card off the board." },
  { group: "Record", name: "add_note", detail: "Write on a person, an organization, or a card." },
  { group: "Record", name: "save_next_action", detail: "Set the next thing to do, and the day." },
  { group: "Record", name: "complete_next_action", detail: "Mark that next thing done." },
  { group: "Record", name: "toggle_checklist", detail: "Check or clear an onboarding step." },
  { group: "Automations", name: "list_automations", detail: "The rules on this book. The assistant does not send mail." },
] as const;

export function hookUrl(token: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/hooks/${token}`;
}

export function mcpEndpoint() {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/mcp`;
}

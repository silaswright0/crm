export type McpToolDef = {
  group: string;
  name: string;
  detail: string;
  writes: boolean;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

const textField = (description: string) => ({ type: "string", description });
const idField = (description: string) => ({ type: "string", description });

function tool(
  group: string,
  name: string,
  detail: string,
  writes: boolean,
  properties: Record<string, unknown> = {},
  required?: string[],
): McpToolDef {
  return {
    group,
    name,
    detail,
    writes,
    inputSchema: {
      type: "object",
      properties,
      ...(required ? { required } : {}),
      additionalProperties: false,
    },
  };
}

export const mcpTools: McpToolDef[] = [
  tool("People", "list_people", "Everyone on this book.", false),
  tool("People", "get_person", "One person, their organization, and their open cards.", false, { id: idField("Person id.") }, ["id"]),
  tool("People", "create_person", "Add a person.", true, { name: textField("Name."), email: textField("Email. Optional.") }, ["name"]),
  tool(
    "People",
    "update_person",
    "Change a name, a title, or how to reach them.",
    true,
    {
      id: idField("Person id."),
      name: textField("Name."),
      email: textField("Email. Empty clears it."),
      phone: textField("Phone. Empty clears it."),
      title: textField("Title. Empty clears it."),
      organizationId: idField("Organization id. Null clears it."),
    },
    ["id"],
  ),
  tool("Organizations", "list_organizations", "The shops and companies on this book.", false),
  tool("Organizations", "get_organization", "One organization and the people on it.", false, { id: idField("Organization id.") }, ["id"]),
  tool(
    "Organizations",
    "create_organization",
    "Add an organization.",
    true,
    { name: textField("Name."), domain: textField("Domain. Optional.") },
    ["name"],
  ),
  tool(
    "Organizations",
    "update_organization",
    "Change its name, domain, or industry.",
    true,
    {
      id: idField("Organization id."),
      name: textField("Name."),
      domain: textField("Domain. Empty clears it."),
      industry: textField("Industry. Empty clears it."),
    },
    ["id"],
  ),
  tool("Boards", "list_stages", "The stages on Sales and Onboarding.", false),
  tool(
    "Boards",
    "list_cards",
    "Cards on Sales, Onboarding, or both, with stage and value.",
    false,
    { kind: { type: "string", enum: ["sales", "onboarding"], description: "Optional board." } },
  ),
  tool("Boards", "get_card", "One card, its checklist, and its timeline.", false, { id: idField("Card id.") }, ["id"]),
  tool(
    "Boards",
    "create_card",
    "Open a card on a stage. The organization is found or added by name.",
    true,
    {
      stageId: idField("Stage id."),
      organization: textField("Organization name."),
      person: textField("Person name. Optional."),
      title: textField("Card title. Defaults to the organization."),
      value: textField("Dollars, on a sales card."),
    },
    ["stageId", "organization"],
  ),
  tool(
    "Boards",
    "move_card",
    "Move a card to another stage on the same board.",
    true,
    { cardId: idField("Card id."), stageId: idField("Stage id.") },
    ["cardId", "stageId"],
  ),
  tool(
    "Boards",
    "update_card",
    "Change the title, the person, or the value.",
    true,
    {
      id: idField("Card id."),
      title: textField("Title."),
      personId: idField("Person id. Null clears it."),
      value: textField("Dollars. Empty clears the value on a sales card."),
    },
    ["id"],
  ),
  tool("Boards", "delete_card", "Take a card off the board.", true, { id: idField("Card id.") }, ["id"]),
  tool(
    "Boards",
    "add_stage",
    "Add an open column. It sits before Won, Lost, or Steady.",
    true,
    {
      kind: { type: "string", enum: ["sales", "onboarding"], description: "Board." },
      name: textField("Column name."),
    },
    ["kind", "name"],
  ),
  tool(
    "Boards",
    "rename_stage",
    "Rename a column.",
    true,
    { stageId: idField("Stage id."), name: textField("Column name.") },
    ["stageId", "name"],
  ),
  tool(
    "Boards",
    "move_stage",
    "Move a column left or right.",
    true,
    {
      stageId: idField("Stage id."),
      direction: { type: "string", enum: ["left", "right"] },
    },
    ["stageId", "direction"],
  ),
  tool(
    "Boards",
    "delete_stage",
    "Remove an empty column. The last column on a board stays.",
    true,
    { stageId: idField("Stage id.") },
    ["stageId"],
  ),
  tool(
    "Record",
    "add_note",
    "Write on a person, an organization, or a card.",
    true,
    {
      body: textField("Note."),
      cardId: idField("Card id."),
      personId: idField("Person id."),
      organizationId: idField("Organization id."),
    },
    ["body"],
  ),
  tool(
    "Record",
    "save_comment",
    "Replace the comment on a card. Empty clears it.",
    true,
    { id: idField("Card id."), comment: textField("Comment.") },
    ["id", "comment"],
  ),
  tool(
    "Record",
    "save_next_action",
    "Set the next thing to do, and the day.",
    true,
    {
      text: textField("What to do."),
      dueOn: textField("YYYY-MM-DD. Defaults to today."),
      actionId: idField("Existing next step, to change it."),
      cardId: idField("Card id."),
      personId: idField("Person id."),
      organizationId: idField("Organization id."),
    },
    ["text"],
  ),
  tool(
    "Record",
    "complete_next_action",
    "Mark that next thing done.",
    true,
    { actionId: idField("Next step id.") },
    ["actionId"],
  ),
  tool(
    "Record",
    "toggle_checklist",
    "Check or clear an onboarding step.",
    true,
    { itemId: idField("Checklist item id.") },
    ["itemId"],
  ),
  tool("Mail", "get_mail_host", "The mail host for this book. The password and any Google token are not returned.", false),
  tool(
    "Mail",
    "save_mail_host",
    "Save the host, port, and from address. A blank password keeps the saved one.",
    true,
    {
      host: textField("SMTP host."),
      port: { type: "integer", description: "SMTP port." },
      fromAddress: textField("From address."),
      username: textField("SMTP username. Optional."),
      password: textField("SMTP password. Optional when one is already saved."),
    },
    ["host", "port", "fromAddress"],
  ),
  tool(
    "Mail",
    "list_mail",
    "Inbox, or Sent. Sent is letters the mail server accepted.",
    false,
    { box: { type: "string", enum: ["in", "out"], description: "in is Inbox. out is Sent." } },
    ["box"],
  ),
  tool(
    "Mail",
    "send_mail",
    "Send a letter now. It is stored only after the mail server accepts it.",
    true,
    {
      to: textField("Recipient email."),
      subject: textField("Subject."),
      body: textField("Letter."),
    },
    ["to", "subject", "body"],
  ),
  tool("Automations", "list_automations", "The rules on this book.", false),
  tool(
    "Automations",
    "create_stage_automation",
    "One letter, queued when a card enters a stage. The wait is whole days and hours, up to 90 days. Due letters leave on the hour.",
    true,
    {
      name: textField("Rule name."),
      stageId: idField("Stage id."),
      subject: textField("Subject."),
      body: textField("Letter."),
      delayDays: { type: "integer", description: "Whole days to wait, from 0 to 90. Hours are added on top. Together they cannot pass 90 days." },
      delayHours: { type: "integer", description: "Whole hours to wait, from 0 to 23. Any other number is refused." },
    },
    ["name", "stageId", "subject", "body"],
  ),
  tool(
    "Automations",
    "create_webhook_automation",
    "One letter, queued when a form POSTs an email to the hook URL. The wait is whole days and hours, up to 90 days. Due letters leave on the hour. Only 128 webhook automations per org.",
    true,
    {
      name: textField("Rule name."),
      subject: textField("Subject."),
      body: textField("Letter."),
      delayDays: { type: "integer", description: "Whole days to wait, from 0 to 90. Hours are added on top. Together they cannot pass 90 days." },
      delayHours: { type: "integer", description: "Whole hours to wait, from 0 to 23. Any other number is refused." },
    },
    ["name", "subject", "body"],
  ),
  tool("Automations", "delete_automation", "Remove a rule.", true, { id: idField("Rule id.") }, ["id"]),
  tool("Workspace", "rename_workspace", "Rename this book.", true, { name: textField("Workspace name.") }, ["name"]),
];

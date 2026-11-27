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

export { mcpTools } from "@/lib/mcp/catalog";

export function hookUrl(token: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/hooks/${token}`;
}

export function mcpEndpoint() {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/mcp`;
}

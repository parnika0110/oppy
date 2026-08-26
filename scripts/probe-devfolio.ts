import { DevfolioSource } from "@/lib/ingestion/sources/devfolio";

async function main() {
  const items = await new DevfolioSource().fetch();
  console.log(JSON.stringify({ provider: "Devfolio/MLH", received: items.length, examples: items.slice(0, 3).map((item) => ({ title: item.title, organization: item.organization, url: item.applicationLink, location: item.location, deadline: item.deadline ?? null, deadlineKind: item.deadlineKind })) }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

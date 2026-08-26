import { DevpostSource } from "@/lib/ingestion/sources/devpost";

async function main() {
  const items = await new DevpostSource().fetch();
  console.log(JSON.stringify({
    provider: "Devpost",
    received: items.length,
    examples: items.slice(0, 3).map((item) => ({
      title: item.title,
      organization: item.organization,
      url: item.applicationLink,
      location: item.location,
      deadline: item.deadline ?? null,
      deadlineKind: item.deadlineKind,
    })),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

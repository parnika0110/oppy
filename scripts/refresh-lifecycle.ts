import { refreshOpportunityLifecycle } from "@/lib/lifecycle";

refreshOpportunityLifecycle()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => { console.error(error); process.exitCode = 1; });

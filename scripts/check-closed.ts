import { getOpportunitiesCollection } from "../lib/mongodb";
async function run() {
  const c = await getOpportunitiesCollection();
  const all = await c.countDocuments();
  const closed = await c.countDocuments({ deadline: { $lt: new Date() } });
  
  // also check how many are definitively closed according to our logic
  const definitivelyClosedFilter = {
    $or: [
      { deadlineKind: { $in: ["verified", "source_provided"] }, deadline: { $lt: new Date() } },
      { applicationDeadline: { $type: "date", $lt: new Date() } },
      { registrationDeadline: { $type: "date", $lt: new Date() } },
      { eventEndDate: { $type: "date", $lt: new Date() }, applicationDeadline: { $in: [null, undefined] }, registrationDeadline: { $in: [null, undefined] }, deadline: { $in: [null, undefined] } },
      { eventDate: { $type: "date", $lt: new Date() }, eventEndDate: { $in: [null, undefined] }, applicationDeadline: { $in: [null, undefined] }, registrationDeadline: { $in: [null, undefined] }, deadline: { $in: [null, undefined] } },
    ],
  };
  const definitivelyClosed = await c.countDocuments(definitivelyClosedFilter);
  console.log("All:", all, "Closed (deadline passed):", closed, "Definitively Closed:", definitivelyClosed);
  process.exit(0);
}
run();

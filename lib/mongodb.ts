import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "oppy";

if (!uri) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Add it to .env.local (see .env.example)."
  );
}

console.log("[MongoDB] Connecting to configured database:", dbName);

/**
 * In dev, Next.js hot-reloads modules, which would otherwise create a new
 * MongoClient on every reload and exhaust connections. We cache the client
 * on the global object to survive reloads. In production, each serverless
 * function instance gets its own cached client for its lifetime.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

const options = {
  family: 4, // Force IPv4 to prevent IPv6 DNS timeout issues in Node.js >= 18
  serverSelectionTimeoutMS: 5000,
};
const client = new MongoClient(uri, options);

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    console.log("[MongoDB] Creating new global MongoClient in development...");
    global._mongoClientPromise = client.connect().then(c => {
      console.log("[MongoDB] Connected successfully!");
      return c;
    }).catch(err => {
      console.error("[MongoDB] Connection error:", err);
      global._mongoClientPromise = undefined; // Clear cached promise so next reload can retry
      throw err;
    });
  } else {
    console.log("[MongoDB] Reusing existing global MongoClient...");
  }
  clientPromise = global._mongoClientPromise;
} else {
  console.log("[MongoDB] Creating new MongoClient in production...");
  clientPromise = client.connect().then(c => {
    console.log("[MongoDB] Connected successfully!");
    return c;
  }).catch(err => {
    console.error("[MongoDB] Connection error:", err);
    throw err;
  });
}

export async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}

export async function getOpportunitiesCollection() {
  console.log("[MongoDB] Fetching 'opportunities' collection...");
  const db = await getDb();
  return db.collection("opportunities");
}

export async function getIngestionRunsCollection() {
  const db = await getDb();
  return db.collection("ingestionRuns");
}

export async function getUsersCollection() {
  const db = await getDb();
  return db.collection("users");
}

export async function getSessionsCollection() {
  const db = await getDb();
  return db.collection("sessions");
}

export async function getSavedOpportunitiesCollection() {
  const db = await getDb();
  return db.collection("savedOpportunities");
}

/**
 * Ensure the indexes PHASE 18 of the spec calls for exist. Safe to call
 * repeatedly — createIndex is a no-op if the index already exists with the
 * same spec. Called lazily from auth/saved routes rather than at import
 * time, so it never runs during `next build`'s static analysis pass (no
 * live Mongo connection then).
 */
let indexesEnsured = false;
export async function ensureUserIndexes() {
  if (indexesEnsured) return;
  const db = await getDb();
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("savedOpportunities").createIndex({ userId: 1, opportunityId: 1 }, { unique: true }),
    db.collection("recentlyViewed").createIndex({ userId: 1, viewedAt: -1 }),
  ]);
  indexesEnsured = true;
}

export default clientPromise;

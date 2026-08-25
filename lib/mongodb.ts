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

export default clientPromise;

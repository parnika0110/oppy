import { MongoClient, Db } from "mongodb";

// ── Lazy configuration ────────────────────────────────────────────────────
// MONGODB_URI is read on the FIRST actual database call, not at module import
// time.  This prevents the Lambda cold-start from crashing on AWS Amplify
// where server-side env vars may not yet be injected when the module graph
// is first resolved.

const DB_NAME = process.env.MONGODB_DB || "oppy";

const MONGO_OPTIONS = {
  family: 4, // Force IPv4 to prevent IPv6 DNS timeout issues in Node.js >= 18
  serverSelectionTimeoutMS: 5000,
};

// ── Client singleton ──────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let _clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  // Return cached promise if already created
  if (_clientPromise) return _clientPromise;

  // Read env var lazily — only when a real DB call is made
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Add it to .env.local (see .env.example)."
    );
  }

  /**
   * In dev, Next.js hot-reloads modules, which would otherwise create a new
   * MongoClient on every reload and exhaust connections. We cache the client
   * on the global object to survive reloads. In production, each serverless
   * function instance gets its own cached client for its lifetime.
   */
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      console.log("[MongoDB] Creating new global MongoClient in development...");
      global._mongoClientPromise = new MongoClient(uri, MONGO_OPTIONS)
        .connect()
        .then((c) => {
          console.log("[MongoDB] Connected successfully!");
          return c;
        })
        .catch((err) => {
          console.error("[MongoDB] Connection error:", err);
          global._mongoClientPromise = undefined;
          _clientPromise = null;
          throw err;
        });
    } else {
      console.log("[MongoDB] Reusing existing global MongoClient...");
    }
    _clientPromise = global._mongoClientPromise;
  } else {
    console.log("[MongoDB] Creating new MongoClient in production...");
    _clientPromise = new MongoClient(uri, MONGO_OPTIONS)
      .connect()
      .then((c) => {
        console.log("[MongoDB] Connected successfully!");
        return c;
      })
      .catch((err) => {
        console.error("[MongoDB] Connection error:", err);
        _clientPromise = null;
        throw err;
      });
  }

  return _clientPromise;
}

// ── Collection accessors (unchanged public API) ───────────────────────────

export async function getDb(): Promise<Db> {
  const connectedClient = await getClientPromise();
  return connectedClient.db(DB_NAME);
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

export async function getPasswordResetsCollection() {
  const db = await getDb();
  return db.collection("passwordResets");
}

export async function getApplicationTrackingCollection() {
  const db = await getDb();
  return db.collection("applicationTracking");
}

export async function getReminderLogCollection() {
  const db = await getDb();
  return db.collection("reminderLog");
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
    db.collection("passwordResets").createIndex({ email: 1, used: 1, expiresAt: 1 }),
    db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("applicationTracking").createIndex({ userId: 1, opportunityId: 1 }, { unique: true }),
    db.collection("applicationTracking").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("reminderLog").createIndex({ userId: 1, opportunityId: 1, reminderType: 1 }),
    db.collection("reminderLog").createIndex({ sentAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }), // TTL: auto-delete after 90 days
  ]);
  indexesEnsured = true;
}


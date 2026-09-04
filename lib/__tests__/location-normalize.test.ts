import { describe, it, expect } from "vitest";
import { normalizeLocation, locationCompatibility } from "../location-normalize";

describe("normalizeLocation", () => {
  it("normalizes India variants", () => {
    expect(normalizeLocation("India").country).toBe("India");
    expect(normalizeLocation("भारत").country).toBe("India");
    expect(normalizeLocation("Bharat").country).toBe("India");
    expect(normalizeLocation("Hindustan").country).toBe("India");
  });

  it("normalizes Karnataka variants", () => {
    expect(normalizeLocation("Karnataka").state).toBe("Karnataka");
    expect(normalizeLocation("ಕರ್ನಾಟಕ").state).toBe("Karnataka");
  });

  it("normalizes Bengaluru variants", () => {
    expect(normalizeLocation("Bengaluru").city).toBe("Bengaluru");
    expect(normalizeLocation("Bangalore").city).toBe("Bengaluru");
    expect(normalizeLocation("ಬೆಂಗಳೂರು").city).toBe("Bengaluru");
    expect(normalizeLocation("बेंगलुरु").city).toBe("Bengaluru");
  });

  it("normalizes Mumbai variants", () => {
    expect(normalizeLocation("Mumbai").city).toBe("Mumbai");
    expect(normalizeLocation("Bombay").city).toBe("Mumbai");
    expect(normalizeLocation("मुंबई").city).toBe("Mumbai");
  });

  it("normalizes remote variants", () => {
    expect(normalizeLocation("Remote").isRemote).toBe(true);
    expect(normalizeLocation("Online").isRemote).toBe(true);
    expect(normalizeLocation("Work from home").isRemote).toBe(true);
  });

  it("infers country from Indian cities", () => {
    const bengaluru = normalizeLocation("Bengaluru");
    expect(bengaluru.country).toBe("India");
    expect(bengaluru.state).toBe("Karnataka");
  });

  it("infers state from city", () => {
    const mumbai = normalizeLocation("Mumbai");
    expect(mumbai.state).toBe("Maharashtra");
    const chennai = normalizeLocation("Chennai");
    expect(chennai.state).toBe("Tamil Nadu");
  });

  it("handles compound locations", () => {
    const compound = normalizeLocation("Bengaluru, Karnataka, India");
    expect(compound.city).toBe("Bengaluru");
    expect(compound.state).toBe("Karnataka");
    expect(compound.country).toBe("India");
  });
});

describe("locationCompatibility", () => {
  it("remote to remote is exact", () => {
    const opp = normalizeLocation("Remote");
    const user = normalizeLocation("Remote");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("exact_city");
    expect(result.score).toBe(25);
  });

  it("remote is compatible with any country (low score to avoid false city labels)", () => {
    const opp = normalizeLocation("Remote");
    const user = normalizeLocation("India");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("remote_compatible");
    // Score < 10 so locOk = false in getMatchLevel — prevents Remote jobs
    // from being labeled with the user's city when filtering by city.
    expect(result.score).toBe(8);
  });

  it("Bengaluru matches Karnataka state", () => {
    const opp = normalizeLocation("Bengaluru");
    const user = normalizeLocation("Karnataka");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("exact_state");
    expect(result.score).toBe(22);
  });

  it("Bengaluru matches India country", () => {
    const opp = normalizeLocation("Bengaluru");
    const user = normalizeLocation("India");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("exact_country");
    expect(result.score).toBe(18);
  });

  it("Bangalore matches Karnataka (through normalization)", () => {
    const opp = normalizeLocation("Bangalore, Karnataka");
    const user = normalizeLocation("Karnataka");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("exact_state");
    expect(result.score).toBe(22);
  });

  it("India opportunity matches India preference", () => {
    const opp = normalizeLocation("India");
    const user = normalizeLocation("India");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("exact_country");
    expect(result.score).toBe(18);
  });

  it("US opportunity is penalized against India preference", () => {
    const opp = normalizeLocation("San Francisco, USA");
    const user = normalizeLocation("India");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("different_country");
    expect(result.score).toBe(-10);
  });

  it("Global opportunity has low but positive score", () => {
    const opp = normalizeLocation("Global");
    const user = normalizeLocation("India");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("global");
    expect(result.score).toBe(5);
  });

  it("Mumbai matches Maharashtra state", () => {
    const opp = normalizeLocation("Mumbai");
    const user = normalizeLocation("Maharashtra");
    const result = locationCompatibility(opp, user);
    expect(result.level).toBe("exact_state");
    expect(result.score).toBe(22);
  });
});

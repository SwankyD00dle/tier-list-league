import { describe, expect, it } from "vitest";
import type { ProfilePicture } from "../../database/schema/profile-picture";
import {
  DEFAULT_AVATAR_COUNT,
  defaultAvatarIndex,
  resolveDefaultProfilePicture,
  uuidToInt,
} from "../default-avatars";

const SAMPLE_UUIDS = [
  "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
  "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "01234567-89ab-cdef-0123-456789abcdef",
  "fedcba98-7654-3210-fedc-ba9876543210",
  "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  "12345678-1234-1234-1234-123456789012",
  "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "deadbeef-dead-beef-dead-beefdeadbeef",
];

function makeDefaultRow(slot: number): ProfilePicture {
  const name = String(slot).padStart(2, "0");
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: `default-row-${name}`,
    url: `https://blob.example.com/default-avatars/${name}.svg`,
    user: null,
    game: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("uuidToInt", () => {
  it("is deterministic for the same uuid", () => {
    const uuid = SAMPLE_UUIDS[0] ?? "";
    expect(uuidToInt(uuid)).toBe(uuidToInt(uuid));
  });

  it("returns a non-negative safe integer", () => {
    for (const uuid of SAMPLE_UUIDS) {
      const value = uuidToInt(uuid);
      expect(Number.isSafeInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("defaultAvatarIndex", () => {
  it("always returns a slot within range", () => {
    for (const uuid of SAMPLE_UUIDS) {
      const index = defaultAvatarIndex(uuid);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(DEFAULT_AVATAR_COUNT);
    }
  });

  it("is stable across calls for the same uuid", () => {
    const uuid = SAMPLE_UUIDS[0] ?? "";
    expect(defaultAvatarIndex(uuid)).toBe(defaultAvatarIndex(uuid));
  });

  it("honors a custom count", () => {
    for (const uuid of SAMPLE_UUIDS) {
      expect(defaultAvatarIndex(uuid, 4)).toBeLessThan(4);
    }
  });

  it("falls back to slot 0 for a non-positive count", () => {
    expect(defaultAvatarIndex(SAMPLE_UUIDS[0] ?? "", 0)).toBe(0);
  });

  it("spreads a set of uuids across more than one slot", () => {
    const slots = new Set(SAMPLE_UUIDS.map((uuid) => defaultAvatarIndex(uuid)));
    expect(slots.size).toBeGreaterThan(1);
  });
});

describe("resolveDefaultProfilePicture", () => {
  const defaults = Array.from({ length: DEFAULT_AVATAR_COUNT }, (_, slot) => makeDefaultRow(slot));

  it("returns null when no defaults are seeded", () => {
    expect(resolveDefaultProfilePicture([], SAMPLE_UUIDS[0] ?? "")).toBeNull();
  });

  it("maps a user to the slot chosen by defaultAvatarIndex", () => {
    for (const uuid of SAMPLE_UUIDS) {
      const picked = resolveDefaultProfilePicture(defaults, uuid);
      const expected = defaults[defaultAvatarIndex(uuid, defaults.length)];
      expect(picked?.url).toBe(expected?.url);
    }
  });
});

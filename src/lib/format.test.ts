import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatTime, weekdayShort } from "./format";

test("UTC serverda ham Toshkent soatini ko'rsatadi", () => {
  // 2026-09-27T08:20Z = Toshkentda 13:20
  const d = new Date("2026-09-27T08:20:00.000Z");
  assert.equal(formatTime(d), "13:20");
  assert.equal(formatDate(d), "27 sentabr, 2026");
});

test("kechqurungi vaqt sanani orqaga surmaydi", () => {
  // 2026-09-27T19:30Z = Toshkentda 28-sentabr 00:30
  const d = new Date("2026-09-27T19:30:00.000Z");
  assert.equal(formatDate(d), "28 sentabr, 2026");
  assert.equal(formatTime(d), "00:30");
});

test("hafta kuni Toshkent sanasidan olinadi", () => {
  // 2026-09-27 — yakshanba; 21:00Z esa Toshkentda dushanba
  assert.equal(weekdayShort(new Date("2026-09-27T10:00:00.000Z")), "Yak");
  assert.equal(weekdayShort(new Date("2026-09-27T21:00:00.000Z")), "Dush");
});

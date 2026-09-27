import assert from "node:assert/strict";
import test from "node:test";

import { formatPhone, phoneKey, samePhone } from "./phone";

test("har xil yozilgan bir xil raqam bir xil kalit beradi", () => {
  const variants = [
    "+998 90 123 45 67",
    "998901234567",
    "901234567",
    "(90) 123-45-67",
    "+998901234567",
  ];
  const keys = variants.map(phoneKey);
  assert.deepEqual(new Set(keys), new Set(["901234567"]));
});

test("qisqa yoki bo'sh raqam kalit bermaydi", () => {
  assert.equal(phoneKey(""), null);
  assert.equal(phoneKey(null), null);
  assert.equal(phoneKey("12345"), null);
});

test("boshqa raqam mos kelmaydi", () => {
  assert.ok(samePhone("+998901234567", "901234567"));
  assert.ok(!samePhone("+998901234567", "+998911234567"));
  // Kalit yo'q bo'lsa hech qachon mos deyilmaydi
  assert.ok(!samePhone("", ""));
});

test("saqlash ko'rinishi bir xilga keltiriladi", () => {
  assert.equal(formatPhone("90 123 45 67"), "+998901234567");
  assert.equal(formatPhone("998901234567"), "+998901234567");
  assert.equal(formatPhone("+998901234567"), "+998901234567");
  assert.equal(formatPhone("123"), null);
});

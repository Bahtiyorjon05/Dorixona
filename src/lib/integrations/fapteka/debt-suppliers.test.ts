import assert from "node:assert/strict";
import test from "node:test";

import { isDebtSupplier, normalizeSupplierName } from "./debt-suppliers";

test("kirilcha firma nomini lotinchaga o'giradi", () => {
  assert.equal(normalizeSupplierName("Фарм Люкс"), "farmlyuks");
  assert.equal(normalizeSupplierName("ООО «КУРАЦИО»"), "oookuratsio");
});

test("ro'yxatdagi firmalar qarz bo'lib yoziladi", () => {
  for (const name of [
    "БИОТЕК",
    "ООО \"Biotek\"",
    "ГРАНД ФАРМ",
    "Курацио",
    "OOO CURATIO",
    "МЕРОС",
    "ФАРМ ЛЮКС",
    "Farm-Luks MChJ",
    "ЮМАКС",
    "Yumaks",
  ]) {
    assert.equal(isDebtSupplier(name), true, name);
  }
});

test("F-Apteka'dagi aniq yozuvlar", () => {
  for (const name of ["Курацио", "гранд", "биотек", "мерос", "фарм люкс", "юмакс"]) {
    assert.equal(isDebtSupplier(name), true, name);
  }
});

test("boshqa firmalar qarzga yozilmaydi", () => {
  for (const name of ["НИКА ФАРМ", "Asklepiy", "ДОРИ-ДАРМОН", "", "Oxy Med"]) {
    assert.equal(isDebtSupplier(name), false, name);
  }
});

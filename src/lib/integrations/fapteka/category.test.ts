import assert from "node:assert/strict";
import test from "node:test";

import { categoryFromName, FAPTEKA_DEFAULT_CATEGORY, isAutoCategory } from "./category";

test("dori shaklini nomdan aniqlaydi", () => {
  assert.equal(categoryFromName("PARATSETAMOL TAB N20"), "Tabletka");
  assert.equal(categoryFromName("AMOKSIKLAV SUSP 100ML"), "Sirop va suspenziya");
  assert.equal(categoryFromName("DIKLOFENAK AMP 3ML N5"), "Ampula va in'ektsiya");
  assert.equal(categoryFromName("OMEPRAZOL KAPS 20MG"), "Kapsula");
  assert.equal(categoryFromName("LEVOMEKOL MAZ 40G"), "Malham, krem, gel");
  assert.equal(categoryFromName("SHPRITS 5ML N100"), "Tibbiy buyum");
});

test("noma'lum nom uchun standart toifa", () => {
  assert.equal(categoryFromName("QANDAYDIR YANGI TOVAR"), FAPTEKA_DEFAULT_CATEGORY);
  assert.equal(categoryFromName(""), FAPTEKA_DEFAULT_CATEGORY);
  assert.equal(categoryFromName(null), FAPTEKA_DEFAULT_CATEGORY);
});

test("odam qo'ygan toifa ustidan yozilmaydi", () => {
  assert.equal(isAutoCategory("F-Apteka"), true);
  assert.equal(isAutoCategory("Tabletka"), true);
  assert.equal(isAutoCategory(null), true);
  assert.equal(isAutoCategory("Bizning maxsus toifa"), false);
});

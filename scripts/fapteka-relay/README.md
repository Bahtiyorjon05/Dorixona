# F-Apteka → ERP ko'prigi

F-Apteka hisobot API'si (`192.168.0.104:8081`) dorixonaning ichki tarmog'ida
turadi. ERP sayti (Vercel) unga internetdan yetolmaydi. Shuning uchun bu skript
dorixona kompyuterida ishlaydi: har 15 daqiqada bugun va kechagi savdo, kirim,
qaytarish va spisanieni API'dan oladi va ERP'ga yuboradi.

Qoldiq bu skript orqali emas, SITE.exe orqali keladi. Unga tegilmaydi.

## O'rnatish (SITE.exe turgan kompyuterda)

**1. API ishlayotganini tekshirish.** Shu kompyuterdagi brauzerda oching:

```
http://192.168.0.104:8081/P_GetReport_XML?pDateFrom=21.09.2026&pDateTo=21.09.2026&pFilial_id=2&pReport_id=14
```

XML chiqishi kerak (`<...>` belgilari bilan). Chiqmasa, texnik bo'limdan
to'g'ri manzilni so'rang.

**2. Papkani ko'chirish.** `fapteka-relay.ps1` faylini `D:\FAptekaRelay\` ga qo'ying.

**3. Tokenni qo'yish.** Faylni Bloknot bilan oching va
`$Token = "BU_YERGA_TOKEN"` qatoriga SITE.exe'dagi TOCING tokenini yozing.

**4. Qo'lda sinash.** `cmd` ni oching va yozing:

```
powershell -NoProfile -ExecutionPolicy Bypass -File D:\FAptekaRelay\fapteka-relay.ps1
```

Har hisobot uchun `OK` yoki `XATO` qatori chiqadi. Hammasi
`D:\FAptekaRelay\relay.log` ga ham yoziladi.

**5. Avtomatik ishga tushirish.** `cmd` ni **administrator sifatida** oching:

```
schtasks /Create /TN "FApteka ERP" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File D:\FAptekaRelay\fapteka-relay.ps1" /SC MINUTE /MO 15 /RU SYSTEM /F
```

O'chirish kerak bo'lsa: `schtasks /Delete /TN "FApteka ERP" /F`

## ERP'da tekshirish

Supabase → SQL Editor:

```sql
SELECT "createdAt" + INTERVAL '5 hours' AS "toshkent_vaqti", "rowCount", "note", "keys"
FROM "IntegrationLog"
WHERE source = 'fapteka-report'
ORDER BY "createdAt" DESC
LIMIT 20;
```

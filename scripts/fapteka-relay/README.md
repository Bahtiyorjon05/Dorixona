# F-Apteka → ERP ko'prigi

F-Apteka hisobot API'si (`localhost:8081`) dorixona kompyuterining o'zida
turadi. ERP sayti (Vercel) unga internetdan yetolmaydi. Shuning uchun bu skript
dorixona kompyuterida ishlaydi: har 15 daqiqada bugun va kechagi savdo, kirim,
qaytarish va spisanieni API'dan oladi va ERP'ga yuboradi.

Qoldiq bu skript orqali emas, SITE.exe orqali keladi. Unga tegilmaydi.

## O'rnatish (SITE.exe turgan kompyuterda)

**1. API ishlayotganini tekshirish.** Shu kompyuterdagi brauzerda oching:

```
http://localhost:8081/P_GetReport_XML?pDateFrom=21.09.2026&pDateTo=21.09.2026&pFilial_id=2&pReport_id=14
```

XML chiqishi kerak (`<...>` belgilari bilan). Chiqmasa, API ishlayotganini
tekshiring: `netstat -ano | findstr :8081` — `LISTENING` bo'lishi kerak.

**2. Papkani ko'chirish.** `fapteka-relay.ps1` faylini `D:\FAptekaRelay\` ga qo'ying.

**3. Tokenni qo'yish.** Faylni Bloknot bilan oching va
`$Token = "BU_YERGA_TOKEN"` qatoriga SITE.exe'dagi TOCING tokenini yozing.

**4. Qo'lda sinash.** `cmd` ni oching va yozing:

```
powershell -NoProfile -ExecutionPolicy Bypass -File D:\FAptekaRelay\fapteka-relay.ps1
```

Har hisobot uchun `OK` yoki `XATO` qatori chiqadi. Hammasi
`D:\FAptekaRelay\relay.log` ga ham yoziladi.

Skript ishni F-Apteka API'sini bir marta chaqirib tekshirishdan boshlaydi.
Javob bermasa, kunlarni aylanib o'tirmaydi — nima qilish kerakligini yozib
to'xtaydi. Xato chiqsa, qaysi tomondan kelgani ko'rsatiladi:

| Yozuv | Ma'nosi |
| --- | --- |
| `XATO ... F-APTEKA: ...` | dorixona kompyuteridagi API javob bermadi |
| `XATO ... ERP: ...` | ERP sayti (Vercel) qabul qilmadi |
| `BOSH ...` | o'sha kuni hujjat bo'lmagan — normal holat |

**Kirim hujjatlari bazadan.** 20-hisobot protsedurasida `SELECT TOP 1 *`
turibdi — bir so'rovga bitta hujjat qaytaradi, qolgani yo'qoladi va firmaga
qarz yarim ko'rinadi (tekshirilgan: 29.09.2026 da 3 ta hujjat bo'lgan, hisobot
1 tasini bergan). Shuning uchun skript hujjatlarni F-Apteka bazasidan
o'zi o'qiydi (`INCOME` jadvali) va `/api/integrations/fapteka/sql` ga yuboradi.

Bazaga ulanish (login va parol) skriptda emas — yonidagi `sql.txt` faylida,
faqat shu kompyuterda turadi. Uni `install-tasks.ps1` o'zi yaratadi; qo'lda:
`Server=localhost;Database=NAPTSKLAD;User Id=<login>;Password=<parol>;TrustServerCertificate=True`.
Saytga faqat tayyor qatorlar ketadi. Faqat o'qiladi, hech narsa yozilmaydi.

**O'zini tuzatish.** API javob bermasa skript hisobot xizmatini (`ServiceReport`)
bir marta qayta yoqib ko'radi va davom etadi. Kompyuter yoqilganda xizmat
tarmoq tayyor bo'lmasdan turib boshlanib, 8081-portni egallay olmay to'xtab
qolishi mumkin (`Could not bind socket`) — shu holat o'zi tiklanadi.

Har 15 daqiqada tinimsiz urinmasligi uchun qayta yoqishlar orasida 30 daqiqa
kutiladi (`restart.stamp` fayli shuni belgilaydi). Vazifa SYSTEM nomidan
ishlagani uchun huquqi yetadi; qo'lda oddiy oynadan ishga tushirilsa
"administrator kerak" deb yozadi va qo'lda nima qilishni aytadi.

Xizmat kompyuter yoqilganda kech boshlanishi uchun bir marta shuni qo'ying
(administrator oynasida):

```
sc.exe config ServiceReport start= delayed-auto
```

Hujjat bo'lmaganda F-Apteka XML emas, `<HTML><BODY><B>200 OK</B></BODY></HTML>`
qaytaradi (39 bayt). Skript shuni matnidan tanib, ERP ga yubormaydi.

**Kirim qaysi filialdan so'raladi.** Kirim hujjatlari faqat omborda (filial 1)
bo'ladi — filial 2 va 3 uchun 1-hisobot bo'sh qaytaradi (tekshirildi
27.09.2026). Shuning uchun tovar haridi harajati "Umumiy" bo'lib yoziladi:
tovar kelganda u hali dorixonalarga bo'linmagan bo'ladi.

`F-APTEKA: Невозможно соединиться с удаленным сервером` chiqsa, hisobot
xizmati o'chiq. `netstat -ano | findstr :8081` da `LISTENING` bo'lishi kerak.

**5. Avtomatik ishga tushirish.** PowerShell'ni **administrator sifatida**
oching va bir marta ishga tushiring:

```
Invoke-WebRequest https://raw.githubusercontent.com/Bahtiyorjon05/Dorixona/main/scripts/fapteka-relay/install-tasks.ps1 -OutFile D:\FAptekaRelay\install-tasks.ps1 -UseBasicParsing
powershell -NoProfile -ExecutionPolicy Bypass -File D:\FAptekaRelay\install-tasks.ps1
```

`install-tasks.ps1` skriptlarni GitHub'dan yangilaydi va uchta vazifa yaratadi:

| Vazifa | Qachon | Nima qiladi |
|---|---|---|
| FApteka ERP | har 15 daqiqa + kompyuter yonganda | bugun va kechani yuboradi |
| FApteka ERP kunlik | har kuni 03:30 | oxirgi 30 kunni qayta yozadi |
| FApteka SITE nazorat | har 10 daqiqa | SITE.exe to'xtasa qayta ishga tushiradi |

Eski `schtasks /SC MINUTE` vazifasidan farqi: 12 daqiqadan oshgan ish
to'xtatiladi (eskisida 72 soat kutardi va shu orada yangisi boshlanmasdi),
xatoda qayta urinadi, kompyuter o'chiq bo'lganda o'tkazib yuborilgani
yonishi bilan ishlaydi.

**6. Ogohlantirish.** GitHub Actions (`.github/workflows/fapteka-holat.yml`)
har 15 daqiqada `/api/integrations/fapteka/holat` ni chaqiradi: savdo yoki
SITE.exe'dan 40 daqiqa hech narsa kelmasa, adminlarga Telegram'da xabar
boradi (08:00-23:00), tiklanganda ham. Holatni qo'lda ko'rish:
`https://dorixonaa.vercel.app/api/integrations/fapteka/holat`

**Antivirus.** 360 Total Security skriptni bir necha marta o'chirib yuborgan.
`install-tasks.ps1` papkani Windows Defender istisnosiga qo'shadi; boshqa
antivirus bo'lsa, `D:\FAptekaRelay` ni uning oq ro'yxatiga qo'shing.

O'chirish kerak bo'lsa:
`schtasks /Delete /TN "FApteka ERP" /F`, `schtasks /Delete /TN "FApteka ERP kunlik" /F`
va `schtasks /Delete /TN "FApteka SITE nazorat" /F`

## ERP'da tekshirish

Supabase → SQL Editor:

```sql
SELECT "createdAt" + INTERVAL '5 hours' AS "toshkent_vaqti", "rowCount", "note", "keys"
FROM "IntegrationLog"
WHERE source = 'fapteka-report'
ORDER BY "createdAt" DESC
LIMIT 20;
```

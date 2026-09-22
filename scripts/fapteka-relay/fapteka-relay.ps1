# F-Apteka -> ERP ko'prigi
#
# Oddiy ishlatish (bugun + kecha, hamma hisobot):
#   powershell -NoProfile -ExecutionPolicy Bypass -File fapteka-relay.ps1
#
# Eski kirimlardan tan narxni tortish (bir martalik, harajat yozilmaydi):
#   ... -File fapteka-relay.ps1 -Days 120 -Only incoming -CostOnly
#
# F-Apteka hisobot API'si (P_GetReport_XML) dorixonaning ichki tarmog'ida
# turadi, internetdan unga kirib bo'lmaydi. Bu skript dorixona kompyuterida
# ishlaydi: har safar bugun va kechagi savdo, kirim, qaytarish va
# spisanieni API'dan oladi va ERP saytiga yuboradi.
#
# O'rnatish: shu papkadagi README.md

param(
  [int]$Days,                # nechta kun ortga: bugun + oldingi kunlar
  [string]$Only,             # faqat bitta hisobot, masalan: incoming
  [switch]$CostOnly,         # kirimdan faqat tan narx olinadi
  [switch]$WithExpenses      # kirimni harajat sifatida ham yozish
)

# ---- Sozlamalar ------------------------------------------------------------
# API shu kompyuterning o'zida ishlaydi (127.0.0.1:8081 LISTENING), shuning
# uchun localhost. Tarmoq manzili (192.168.0.x) router qayta yonganda
# o'zgarib qoladi - localhost esa hech qachon o'zgarmaydi.
$ApiUrl  = "http://localhost:8081/P_GetReport_XML"
$ErpUrl  = "https://dorixonaa.vercel.app/api/integrations/fapteka/report"
$Token   = "BU_YERGA_TOKEN"            # Vercel'dagi FAPTEKA_SITE_TOKEN (SITE.exe TOCING bilan bir xil)
$Filials = @("2", "3")                 # 2 = Yunusobod, 3 = Shayxontohur
# Kirim va yetkazib beruvchiga qaytarish omborga (filial 1) yoziladi,
# dorixonalarga emas - shuning uchun ular boshqa filialdan so'raladi.
$ReportFilials = @{
  incoming       = @("1")
  supplierReturn = @("1")
}
$DaysDefault = 2                       # bugun + kecha
# Bu dorixonadagi API'da Ver.2 hisobotlari (14, 15, 11, 12) bo'sh qaytaradi,
# shuning uchun eski raqamlar ishlatiladi. API yangilansa, chap ustundagi
# nomni V2 ga (masalan retailSaleV2 = 14) o'zgartirish kifoya - ikkalasini
# birga qoldirmang, savdo ikki marta yozilib qoladi.
$Reports = [ordered]@{
  retailSale     = 4                   # Roznichnaya prodazha
  insuranceSale  = 5                   # Strahovka prodazha
  incoming       = 1                   # Prihody na sklad
  supplierReturn = 2                   # Vozvrat postavshchiku
  writeOff       = 3                   # Spisanie
}
# ----------------------------------------------------------------------------

if (-not $Days) { $Days = $DaysDefault }
if ($Only) {
  if (-not $Reports.Contains($Only)) {
    Write-Output "XATO  Bunday hisobot yo'q: $Only"
    exit 1
  }
  $single = [ordered]@{}
  $single[$Only] = $Reports[$Only]
  $Reports = $single
}
# Kirim odatda faqat tan narx uchun olinadi: harajatlar ERP ga qo'lda
# kiritilgani uchun avtomatik yozilsa ikki marta hisoblanib ketardi.
# Kerak bo'lsa -WithExpenses bilan yoqiladi.
$CostOnlyReports = @("incoming")
if ($WithExpenses) { $CostOnlyReports = @() }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# Ulanishlarni qayta ishlatish - har so'rovda yangi TLS qo'l berishuvi bo'lmasin
[Net.ServicePointManager]::DefaultConnectionLimit = 8
[Net.ServicePointManager]::Expect100Continue = $false
$LogFile = Join-Path $PSScriptRoot "relay.log"
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 5MB) { Remove-Item $LogFile }

function Write-Log([string]$Text) {
  $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $Text
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Output $line
}

# Xato bo'lsa, server javobining matnini ham ko'rsatadi
function Get-ErrorText($ErrorRecord) {
  $err = $ErrorRecord.Exception
  while ($err -and -not ($err -is [System.Net.WebException])) { $err = $err.InnerException }
  if ($err -and $err.Response) {
    $reader = New-Object System.IO.StreamReader($err.Response.GetResponseStream())
    return "$($err.Message) $($reader.ReadToEnd())"
  }
  return $ErrorRecord.Exception.Message
}

# Token skript ichida yozilmagan bo'lsa, yonidagi token.txt dan olinadi
if ($Token -eq "BU_YERGA_TOKEN") {
  $TokenFile = Join-Path $PSScriptRoot "token.txt"
  if (Test-Path $TokenFile) { $Token = (Get-Content $TokenFile -Raw).Trim() }
}
if ($Token -eq "BU_YERGA_TOKEN" -or -not $Token) {
  Write-Log "XATO  Token yo'q: skriptdagi `$Token qatoriga yozing yoki token.txt fayl qiling"
  exit 1
}

Write-Log "relay v5 boshlandi (kirim ombordan: F=1, tan narx QQS bilan)"

for ($i = $Days - 1; $i -ge 0; $i--) {
  $day = (Get-Date).Date.AddDays(-$i)
  $apiDate = $day.ToString("dd.MM.yyyy")
  $erpDate = $day.ToString("yyyy-MM-dd")

  foreach ($report in $Reports.Keys) {
    $reportId = $Reports[$report]
    # Nom $ReportFilials dan farq qilishi shart: PowerShell'da o'zgaruvchi
    # nomlari katta-kichik harfni ajratmaydi, aks holda jadval buziladi.
    $useFilials = $Filials
    if ($ReportFilials.ContainsKey($report)) { $useFilials = $ReportFilials[$report] }

    foreach ($filial in $useFilials) {
      $label = "$erpDate F=$filial $report (#$reportId)"
      $CostSuffix = ""
      if ($CostOnly -or $CostOnlyReports -contains $report) { $CostSuffix = "&costOnly=1" }
      try {
        $api = New-Object System.Net.WebClient
        $source = "{0}?pDateFrom={1}&pDateTo={1}&pFilial_id={2}&pReport_id={3}" -f $ApiUrl, $apiDate, $filial, $reportId
        $xml = $api.DownloadData($source)
        $contentType = $api.ResponseHeaders["Content-Type"]
        if (-not $contentType) { $contentType = "text/xml" }

        # Bo'sh javobni (o'sha kuni hujjat yo'q) serverga yubormaymiz -
        # 120 kunlik tortishda shu keraksiz so'rovlar butun vaqtni yeb qo'yadi.
        if ($xml.Length -lt 40) {
          Write-Log ("BOSH  {0}" -f $label)
          continue
        }

        $erp = New-Object System.Net.WebClient
        $erp.Headers.Add("Authorization", "Bearer $Token")
        $erp.Headers.Add("Content-Type", $contentType)
        $target = "{0}?report={1}&filial={2}&dateFrom={3}&dateTo={3}{4}" -f $ErpUrl, $report, $filial, $erpDate, $CostSuffix
        $answer = [System.Text.Encoding]::UTF8.GetString($erp.UploadData($target, "POST", $xml))
        Write-Log ("OK    {0}  {1} bayt  {2}" -f $label, $xml.Length, $answer)
      } catch {
        Write-Log ("XATO  {0}  {1}" -f $label, (Get-ErrorText $_))
      }
    }
  }
}

# F-Apteka API'sida qanday hisobotlar borligini topadi.
#
# Hujjatda 12 ta hisobot yozilgan, lekin protsedurada boshqalari ham
# bo'lishi mumkin. Bu skript 1 dan 60 gacha raqamlarni sinab ko'radi va
# ma'lumot qaytarganlarini ro'yxat qilib beradi.
#
# Ishga tushirish (dorixona kompyuterida):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\FAptekaRelay\fapteka-scan.ps1
#
# Natija ekranda va yonidagi scan-natija.txt faylida qoladi.

$ApiUrl   = "http://localhost:8081/P_GetReport_XML"
$Filial   = "2"                     # Yunusobod
$DateFrom = (Get-Date).AddDays(-7).ToString("dd.MM.yyyy")
$DateTo   = (Get-Date).ToString("dd.MM.yyyy")
$MaxId    = 60
$OutFile  = Join-Path $PSScriptRoot "scan-natija.txt"

"F-Apteka hisobotlari qidiruvi: $DateFrom - $DateTo, filial $Filial" | Tee-Object $OutFile

for ($id = 1; $id -le $MaxId; $id++) {
  $url = "{0}?pDateFrom={1}&pDateTo={2}&pFilial_id={3}&pReport_id={4}" -f $ApiUrl, $DateFrom, $DateTo, $Filial, $id
  try {
    $client = New-Object System.Net.WebClient
    $bytes = $client.DownloadData($url)
    if ($bytes.Length -lt 40) { continue }

    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    if (-not $text.StartsWith("<xmldata")) { continue }

    # Birinchi qatordagi maydon nomlarini ko'rsatamiz
    $sample = $text.Substring(0, [Math]::Min(320, $text.Length))
    $line = "#{0}  {1} bayt`n    {2}" -f $id, $bytes.Length, $sample
    $line | Tee-Object $OutFile -Append
  } catch {
    # Bunday hisobot yo'q yoki xato - jim o'tamiz
  }
}

"`nTugadi. Natija: $OutFile" | Tee-Object $OutFile -Append

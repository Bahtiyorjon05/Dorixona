# SITE.exe nazoratchisi
#
# SITE.exe ba'zan F-Apteka uzilishidan keyin jim to'xtab qoladi: oynasi
# ochiq, lekin qoldiq yubormaydi (27.09.2026 da shunday bo'ldi). Bu skript
# har 10 daqiqada qaraydi:
#   - SITE.exe umuman ishlamasa - ishga tushiradi;
#   - ishlayapti, lekin ERP'ga 20 daqiqadan beri qoldiq kelmagan bo'lsa -
#     qayta ishga tushiradi (qayta yoqishlar orasida kamida 30 daqiqa).
#
# Foydalanuvchi sessiyasida ishlaydi ("FApteka SITE nazorat" vazifasi),
# chunki SITE.exe oynali dastur. O'rnatish: install-tasks.ps1

$Site     = "D:\NAPTEKA\SITE\SITE.exe"
$HolatUrl = "https://dorixonaa.vercel.app/api/integrations/fapteka/holat"
$StaleMinutes  = 20
$CooldownMin   = 30
$Log   = Join-Path $PSScriptRoot "site-watchdog.log"
$Stamp = Join-Path $PSScriptRoot "site-restart.stamp"

if ((Test-Path $Log) -and (Get-Item $Log).Length -gt 2MB) { Remove-Item $Log }
function Write-Log([string]$Text) {
  Add-Content -Path $Log -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $Text) -Encoding UTF8
}
function Start-Site {
  Start-Process -FilePath $Site -WorkingDirectory (Split-Path $Site)
}

if (-not (Test-Path $Site)) { Write-Log "XATO  SITE.exe topilmadi: $Site"; exit 1 }

$proc = Get-Process SITE -ErrorAction SilentlyContinue
if (-not $proc) {
  Write-Log "SITE.exe ishlamayapti - ishga tushiramiz"
  Start-Site
  exit 0
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $holat = Invoke-RestMethod $HolatUrl -TimeoutSec 30
} catch {
  # Internet yo'q bo'lsa SITE.exe'ni bekorga qayta yoqmaymiz
  Write-Log ("ERP javob bermadi, tekshirib bo'lmadi: {0}" -f $_.Exception.Message)
  exit 0
}

$age = $holat.site.daqiqa
if ($null -eq $age -or $age -lt $StaleMinutes) { exit 0 }

# Yaqinda ishga tushgan bo'lsa birinchi yuborishini kutamiz
$started = ($proc | Sort-Object StartTime | Select-Object -First 1).StartTime
if ($started -and (New-TimeSpan -Start $started -End (Get-Date)).TotalMinutes -lt 15) { exit 0 }

if (Test-Path $Stamp) {
  $passed = (New-TimeSpan -Start (Get-Item $Stamp).LastWriteTime -End (Get-Date)).TotalMinutes
  if ($passed -lt $CooldownMin) { exit 0 }
}
Set-Content -Path $Stamp -Value (Get-Date).ToString("s") -Encoding ASCII

Write-Log ("SITE.exe {0} daqiqadan beri yubormayapti - qayta ishga tushiramiz" -f $age)
$proc | Stop-Process -Force
Start-Sleep -Seconds 5
Start-Site

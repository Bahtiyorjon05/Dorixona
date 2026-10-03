# F-Apteka -> ERP: Windows vazifalarini mustahkam qilib (qayta) yaratadi.
#
# Nega kerak: eski vazifalar `schtasks /SC MINUTE` bilan yaratilgan edi.
# Unda ishlash vaqti cheklovi 72 soat, yangi nusxa eski tugaguncha
# boshlanmaydi - relay bir marta osilib qolsa, 3 kun hech narsa kelmasdi.
# Kompyuter qayta yonganda ham kutib turardi.
#
# Endi:
#   FApteka ERP          - har 15 daqiqa + kompyuter yonganda, SYSTEM nomidan.
#                          12 daqiqadan oshsa to'xtatiladi, xatoda 3 marta
#                          qayta urinadi, o'tkazib yuborilgani darrov ishlaydi.
#   FApteka ERP kunlik   - har kuni 03:30, oxirgi 30 kunni qayta yozadi.
#   FApteka SITE nazorat - har 10 daqiqa, SITE.exe to'xtasa qayta ishga tushiradi
#                          (foydalanuvchi sessiyasida - SITE.exe oynali dastur).
#
# Skriptlarni ERP saytidan yangilaydi. token.txt va sql.txt (parollar) faqat
# shu kompyuterda turadi - GitHub'ga chiqmaydi.
#
# Ishga tushirish (administrator PowerShell'da, bir marta):
#   powershell -NoProfile -ExecutionPolicy Bypass -File D:\FAptekaRelay\install-tasks.ps1

$ErrorActionPreference = "Stop"
$Dir = "D:\FAptekaRelay"
# Skriptlar ERP saytidan olinadi (GitHub repo yopiq), token.txt bilan
$Raw = "https://dorixonaa.vercel.app/api/integrations/fapteka/skript"
$Exe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

$identity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $identity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "XATO  Administrator sifatida oching: Pusk -> PowerShell -> o'ng tugma -> Zapusk ot imeni administratora"
  exit 1
}

New-Item -ItemType Directory -Force $Dir | Out-Null

# Baza paroli endi skriptda emas, sql.txt da. Eski skriptda turgan bo'lsa,
# yangisini yuklashdan OLDIN o'sha yerdan ko'chirib olamiz.
$SqlFile = "$Dir\sql.txt"
if (-not (Test-Path $SqlFile) -and (Test-Path "$Dir\fapteka-relay.ps1")) {
  $old = [regex]::Match((Get-Content "$Dir\fapteka-relay.ps1" -Raw), '\$SqlConn\s*=\s*"([^"]*Password[^"]*)"')
  if ($old.Success) {
    Set-Content -Path $SqlFile -Value $old.Groups[1].Value -NoNewline -Encoding ASCII
    Write-Host "OK    baza ulanishi sql.txt ga ko'chirildi"
  }
}
if (-not (Test-Path $SqlFile)) {
  Write-Host "DIQQAT  $SqlFile yo'q - kirim hujjatlari bazadan olinmaydi"
}

if (-not (Test-Path "$Dir\token.txt")) {
  Write-Host "XATO  $Dir\token.txt yo'q - skriptlarni yuklab bo'lmaydi va relay ERP'ga yubora olmaydi"
  exit 1
}
$Token = (Get-Content "$Dir\token.txt" -Raw).Trim()
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
foreach ($file in "fapteka-relay.ps1", "site-watchdog.ps1", "install-tasks.ps1") {
  Invoke-WebRequest "$Raw/${file}?token=$Token" -OutFile "$Dir\$file" -UseBasicParsing
  Write-Host "OK    yuklandi: $file"
}

# Antivirus skriptlarni o'chirib yubormasin (360 shunday qilgan edi)
try { Add-MpPreference -ExclusionPath $Dir; Write-Host "OK    Defender istisnosi: $Dir" }
catch { Write-Host "DIQQAT  Defender istisnosi qo'shilmadi: $($_.Exception.Message)" }

function New-RelayAction([string]$File, [string]$Arguments = "") {
  $argLine = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dir\$File`" $Arguments".Trim()
  New-ScheduledTaskAction -Execute $Exe -Argument $argLine -WorkingDirectory $Dir
}

# Har kuni 00:00 dan boshlab N daqiqada bir - eng ishonchli "cheksiz" takror
function New-RepeatTrigger([int]$Minutes) {
  $trigger = New-ScheduledTaskTrigger -Daily -At "00:00"
  $trigger.Repetition = (New-ScheduledTaskTrigger -Once -At "00:00" `
    -RepetitionInterval (New-TimeSpan -Minutes $Minutes) `
    -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 59)).Repetition
  $trigger
}

function New-Settings([timespan]$Limit, [int]$Retries) {
  New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit $Limit `
    -RestartCount $Retries -RestartInterval (New-TimeSpan -Minutes 2)
}

$system = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# 1) Har 15 daqiqa + kompyuter yonganda
$boot = New-ScheduledTaskTrigger -AtStartup
$boot.Delay = "PT3M"
Register-ScheduledTask -TaskName "FApteka ERP" -Force `
  -Action (New-RelayAction "fapteka-relay.ps1") `
  -Trigger @((New-RepeatTrigger 15), $boot) `
  -Principal $system -Settings (New-Settings (New-TimeSpan -Minutes 12) 3) | Out-Null
Write-Host "OK    vazifa: FApteka ERP (har 15 daqiqa, yonganda ham)"

# 2) Kunlik tuzatish
Register-ScheduledTask -TaskName "FApteka ERP kunlik" -Force `
  -Action (New-RelayAction "fapteka-relay.ps1" "-Days 30") `
  -Trigger (New-ScheduledTaskTrigger -Daily -At "03:30") `
  -Principal $system -Settings (New-Settings (New-TimeSpan -Hours 2) 2) | Out-Null
Write-Host "OK    vazifa: FApteka ERP kunlik (03:30, oxirgi 30 kun)"

# 3) SITE.exe nazorati - shu foydalanuvchi sessiyasida
$user = "$env:USERDOMAIN\$env:USERNAME"
$logon = New-ScheduledTaskTrigger -AtLogOn -User $user
$logon.Delay = "PT2M"
Register-ScheduledTask -TaskName "FApteka SITE nazorat" -Force `
  -Action (New-RelayAction "site-watchdog.ps1") `
  -Trigger @((New-RepeatTrigger 10), $logon) `
  -Principal (New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest) `
  -Settings (New-Settings (New-TimeSpan -Minutes 3) 0) | Out-Null
Write-Host "OK    vazifa: FApteka SITE nazorat (har 10 daqiqa, $user)"

# Osilib qolgan eski relay nusxalari bo'lsa - to'xtatamiz
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match 'fapteka-relay\.ps1' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "OK    osilib qolgan relay to'xtatildi (PID $($_.ProcessId))" }

Start-ScheduledTask -TaskName "FApteka ERP"
Start-ScheduledTask -TaskName "FApteka SITE nazorat"
Write-Host ""
Write-Host "TAYYOR. Relay ishga tushirildi. 3 daqiqadan keyin tekshirish:"
Write-Host "  Get-Content $Dir\relay.log -Tail 5"

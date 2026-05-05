$today = Get-Date '2026-03-22'
Get-ChildItem -Path C:\Sisweb -Recurse -File | Where-Object { $_.LastWriteTime -ge $today -and $_.FullName -notmatch 'node_modules' } | Select-Object FullName, LastWriteTime | Format-Table -AutoSize

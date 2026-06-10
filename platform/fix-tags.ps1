$badO = [char]60 + "motion"
$goodO = [char]60 + "div"
$badC = "</" + "motion" + ">"
$goodC = "</" + "motion" + ">"
$goodC = "</" + "motion" + ">"
$goodC = "</" + "div" + ">"
Get-ChildItem -Path "d:\ITLS\SPARC\coding-block-SPARC\platform\src" -Recurse -Include *.tsx | ForEach-Object {
  $c = [IO.File]::ReadAllText($_.FullName)
  if ($c -match "motion") {
    $n = $c.Replace($badO, $goodO).Replace($badC, $goodC)
    if ($n -ne $c) { [IO.File]::WriteAllText($_.FullName, $n); Write-Host "fixed $($_.Name)" }
  }
}

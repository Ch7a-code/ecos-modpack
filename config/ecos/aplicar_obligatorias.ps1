# ECOS · aplica los ajustes obligatorios de config/ecos/obligatorias.txt (los demás ajustes de cada quien se respetan).
# Lo corre ecos-actualizar.bat (Prism, antes de abrir el juego) después de actualizar el modpack. No borra ni crea archivos.
$ErrorActionPreference = 'Continue'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = (Resolve-Path (Join-Path $aqui '..\..')).Path
$lista = Join-Path $aqui 'obligatorias.txt'
if (-not (Test-Path -LiteralPath $lista)) { exit 0 }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$cambios = 0
foreach ($l in [System.IO.File]::ReadAllLines($lista, $utf8)) {
  if ($l.Trim() -eq '' -or $l.TrimStart().StartsWith('#')) { continue }
  $p = $l.Split('|')
  if ($p.Count -lt 4) { continue }
  $f = Join-Path $base $p[0].Trim()
  $k = $p[1].Trim(); $v = $p[2].Trim(); $tipo = $p[3].Trim()
  if (-not (Test-Path -LiteralPath $f)) { continue }
  $txt = [System.IO.File]::ReadAllText($f, $utf8)
  $ke = [regex]::Escape($k)
  $vr = $v.Replace('$', '$$')
  if ($tipo -eq 'toml') { $re = '(?m)^([ \t]*)' + $ke + '[ \t]*=[^\r\n]*'; $rep = '${1}' + $k + ' = ' + $vr; $sep = $null }
  elseif ($tipo -eq 'prop') { $re = '(?m)^' + $ke + '=[^\r\n]*'; $rep = $k + '=' + $vr; $sep = '=' }
  elseif ($tipo -eq 'opt') { $re = '(?m)^' + $ke + ':[^\r\n]*'; $rep = $k + ':' + $vr; $sep = ':' }
  else { continue }
  if ([regex]::IsMatch($txt, $re)) { $nuevo = [regex]::Replace($txt, $re, $rep) }
  elseif ($sep) { $nuevo = $txt.TrimEnd("`r", "`n") + "`n" + $k + $sep + $v + "`n" }
  else { continue }
  if ($nuevo -ne $txt) {
    [System.IO.File]::WriteAllText($f, $nuevo, $utf8)
    $cambios++
    Write-Output ('ECOS: ' + $p[0].Trim() + ' -> ' + $k + ' = ' + $v)
  }
}
Write-Output ('ECOS: ajustes obligatorios aplicados (' + $cambios + ' cambio(s))')
exit 0

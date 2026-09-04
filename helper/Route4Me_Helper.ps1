# Route4Me Helper — a tiny local relay for the Route4Me Workaround tool.
#
# Why it exists: the browser refuses to call api.route4me.com directly from the
# tool (CORS). This script listens on http://127.0.0.1:8177 and forwards the
# tool's requests to api.route4me.com, nothing else. It talks only to Route4Me,
# accepts connections only from this machine, and stores nothing.
#
# Run it with Start_Helper.bat (or right-click > Run with PowerShell) and leave
# the window open while dispatching. Close the window to stop it.

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:8177/')
try { $listener.Start() } catch {
  Write-Host 'Could not start (is another copy already running?)' -ForegroundColor Red
  Read-Host 'Press Enter to close'; exit 1
}
Write-Host ''
Write-Host '  Route4Me Helper is running on http://127.0.0.1:8177' -ForegroundColor Green
Write-Host '  Leave this window open while you dispatch. Close it to stop.'
Write-Host ''

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $res.Headers.Add('Access-Control-Allow-Origin','*')
    $res.Headers.Add('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS')
    $res.Headers.Add('Access-Control-Allow-Headers','Content-Type')

    if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }

    if ($req.Url.AbsolutePath -eq '/ping') {
      $buf = [Text.Encoding]::UTF8.GetBytes('{"ok":true,"helper":"route4me"}')
      $res.ContentType = 'application/json'
      $res.OutputStream.Write($buf, 0, $buf.Length); $res.Close(); continue
    }

    if (-not $req.Url.AbsolutePath.StartsWith('/api/')) { $res.StatusCode = 404; $res.Close(); continue }

    # /api/<anything> -> https://api.route4me.com/<anything>   (host is fixed — this is not a general proxy)
    $target = 'https://api.route4me.com' + $req.Url.AbsolutePath.Substring(4) + $req.Url.Query
    $body = $null
    if ($req.HasEntityBody) {
      $sr = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $body = $sr.ReadToEnd()
    }
    $out = $null
    try {
      if ($null -ne $body -and $body.Length -gt 0) {
        $r = Invoke-WebRequest -Uri $target -Method $req.HttpMethod -Body $body -ContentType 'application/json' -UseBasicParsing
      } else {
        $r = Invoke-WebRequest -Uri $target -Method $req.HttpMethod -UseBasicParsing
      }
      $res.StatusCode = [int]$r.StatusCode
      $out = [Text.Encoding]::UTF8.GetBytes([string]$r.Content)
    } catch {
      $er = $_.Exception.Response
      if ($er) {
        $res.StatusCode = [int]$er.StatusCode
        $sr2 = New-Object IO.StreamReader($er.GetResponseStream())
        $out = [Text.Encoding]::UTF8.GetBytes($sr2.ReadToEnd())
      } else {
        $res.StatusCode = 502
        $out = [Text.Encoding]::UTF8.GetBytes('{"error":"helper could not reach api.route4me.com — check this machine''s internet"}')
      }
    }
    $res.ContentType = 'application/json'
    $res.OutputStream.Write($out, 0, $out.Length)
    $res.Close()
    Write-Host ("  {0}  {1} {2}" -f (Get-Date -Format 'HH:mm:ss'), $req.HttpMethod, ($req.Url.AbsolutePath)) -ForegroundColor DarkGray
  } catch {
    # one bad request must never kill the helper
  }
}

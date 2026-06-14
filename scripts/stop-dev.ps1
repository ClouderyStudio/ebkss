$ErrorActionPreference = 'SilentlyContinue'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ports = @(3000, 5173, 5174)
$connections = Get-NetTCPConnection -LocalPort $ports -State Listen
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
$stopped = New-Object System.Collections.Generic.HashSet[int]
$targets = New-Object System.Collections.Generic.HashSet[int]

function Add-StopTarget {
  param([int]$ProcessId)
  if ($stopped.Contains($ProcessId)) {
    return
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
  if (-not $process) {
    return
  }

  $commandLine = $process.CommandLine
  if ($commandLine -and (
      $commandLine.Contains($workspace) -or
      $commandLine.EndsWith(' src/index.js') -or
      $commandLine.Contains('node --watch src/index.js') -or
      $commandLine.Contains('node  --watch src/index.js') -or
      $commandLine.Contains('vite\bin\vite.js') -or
      $commandLine.Contains('vite/bin/vite.js')
    )) {
    [void]$targets.Add($ProcessId)
  }
}

foreach ($processId in $processIds) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
  if (-not $process) {
    continue
  }

  $chain = @($process)
  $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ParentProcessId)"
  while ($parent) {
    $chain += $parent
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($parent.ParentProcessId)"
  }

  $belongsToWorkspace = $chain | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($workspace)
  }
  $isKnownDevCommand = $chain | Where-Object {
    $_.CommandLine -and (
      $_.CommandLine.EndsWith(' src/index.js') -or
      $_.CommandLine.Contains('node --watch src/index.js') -or
      $_.CommandLine.Contains('node  --watch src/index.js') -or
      $_.CommandLine.Contains('vite\bin\vite.js') -or
      $_.CommandLine.Contains('vite/bin/vite.js')
    )
  }

  if ($belongsToWorkspace -or $isKnownDevCommand) {
    foreach ($item in $chain) {
      if ($item.CommandLine -and (
          $item.CommandLine.EndsWith(' src/index.js') -or
          $item.CommandLine.Contains('node --watch src/index.js') -or
          $item.CommandLine.Contains('node  --watch src/index.js') -or
          $item.CommandLine.Contains('vite')
        )) {
        Add-StopTarget -ProcessId $item.ProcessId
      }
    }
    Add-StopTarget -ProcessId $process.ProcessId
  }
}

foreach ($processId in $targets) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
  if ($process) {
    Stop-Process -Id $processId -Force
    [void]$stopped.Add($processId)
    Write-Output "Stopped ${processId}: $($process.CommandLine)"
  }
}

if ($stopped.Count -eq 0) {
  Write-Output 'No workspace dev processes found on ports 3000, 5173, or 5174.'
}

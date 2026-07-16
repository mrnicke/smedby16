#Requires -RunAsAdministrator

[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$Remove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ruleGroup = 'Smedby16 security hardening'
$rules = @(
  @{
    Name = 'Smedby16-Supabase-LocalOnly-Default'
    DisplayName = 'Smedby16 Supabase local-only (54320-54329)'
    Ports = '54320-54329'
  },
  @{
    Name = 'Smedby16-Supabase-LocalOnly-Verification'
    DisplayName = 'Smedby16 Supabase verification local-only (55320-55329)'
    Ports = '55320-55329'
  }
)

foreach ($definition in $rules) {
  $existing = Get-NetFirewallRule -Name $definition.Name -ErrorAction SilentlyContinue

  if ($Remove) {
    if ($null -ne $existing -and $PSCmdlet.ShouldProcess($definition.DisplayName, 'Remove firewall rule')) {
      Remove-NetFirewallRule -Name $definition.Name
      Write-Output "Removed: $($definition.DisplayName)"
    }
    continue
  }

  if ($null -eq $existing) {
    if ($PSCmdlet.ShouldProcess($definition.DisplayName, 'Create inbound block rule')) {
      New-NetFirewallRule `
        -Name $definition.Name `
        -DisplayName $definition.DisplayName `
        -Group $ruleGroup `
        -Description 'Blocks remote inbound access to local Supabase development ports. Windows loopback traffic remains available.' `
        -Enabled True `
        -Direction Inbound `
        -Action Block `
        -Profile Any `
        -Protocol TCP `
        -LocalPort $definition.Ports `
        -RemoteAddress Any | Out-Null
    }
    $existing = Get-NetFirewallRule -Name $definition.Name
  }

  $portFilter = $existing | Get-NetFirewallPortFilter
  if (
    $existing.Enabled -ne 'True' -or
    $existing.Direction -ne 'Inbound' -or
    $existing.Action -ne 'Block' -or
    $portFilter.Protocol -ne 'TCP' -or
    $portFilter.LocalPort -ne $definition.Ports
  ) {
    throw "Firewall rule '$($definition.Name)' exists but does not match the required fail-closed configuration."
  }

  Write-Output "Verified: $($definition.DisplayName)"
}

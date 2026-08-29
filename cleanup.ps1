Write-Host "Cleaning temporary files..."

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue


Write-Host "Cleanup completed."
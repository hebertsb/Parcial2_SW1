# run-backend.ps1 - Script para ejecutar NexusFlow Backend
# Ejecutar desde PowerShell: .\run-backend.ps1

$originalLocation = Get-Location

try {
    # Navegar al directorio del proyecto
    Set-Location "C:\Users\USUARIO\IdeaProjects\nexusflow-backend-v2"
    
    Write-Host "=== NexusFlow Backend ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Verificar si estamos en IntelliJ terminal
    if ($env:IDEA_LOGS) {
        Write-Host "Ejecutando desde IntelliJ IDEA" -ForegroundColor Green
        Write-Host ""
        # Ejecutar la aplicación con Spring Boot
        mvn spring-boot:run -DskipTests
    } else {
        Write-Host "No se detect� IntelliJ. Intentando con JDK del sistema..." -ForegroundColor Yellow
        Write-Host ""
        
        # Intentar con Maven
        mvn clean compile -DskipTests
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Compilaci�n exitosa!" -ForegroundColor Green
            Write-Host "Iniciando aplicaci�n..." -ForegroundColor Green
            mvn spring-boot:run -DskipTests
        } else {
            Write-Host ""
            Write-Host "ERROR: No se pudo compilar el proyecto." -ForegroundColor Red
            Write-Host "Recomendaci�n: Ejecuta la aplicaci�n desde IntelliJ IDEA presionando Shift+F10" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    Set-Location $originalLocation
}

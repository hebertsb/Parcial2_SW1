# run.bat - Script para ejecutar NexusFlow Backend con JDK correcto

$env:JAVA_HOME = "C:\Program Files\JetBrains\IntelliJ IDEA 2026.1\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "Usando JDK: $(java -version)"

cd "$PSScriptRoot"

Write-Host "Compilando proyecto..."
mvn clean package -DskipTests

Write-Host "Iniciando aplicacion..."
java -jar target/nexusflow-backend-0.0.1-SNAPSHOT.jar

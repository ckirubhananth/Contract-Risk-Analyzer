# Google Cloud Run Sidecar Deployment Script
# Make sure you are authenticated before running: gcloud auth login

$ProjectID = Read-Host "Enter your Google Cloud Project ID"
$GeminiKey = Read-Host "Enter your Gemini API Key"
$Region = Read-Host "Enter target deployment region [default: us-central1]"
if ([string]::IsNullOrWhiteSpace($Region)) { $Region = "us-central1" }

# 1. Check if gcloud is installed
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "Google Cloud SDK (gcloud CLI) is not installed. Please download it from: https://cloud.google.com/sdk"
    exit 1
}

# 2. Set project context
Write-Host "`nSetting project context to $ProjectID..." -ForegroundColor Cyan
gcloud config set project $ProjectID

# 3. Enable required APIs
Write-Host "`nEnabling required GCP APIs (this may take a minute)..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

# 4. Create Artifact Registry repository
Write-Host "`nChecking Artifact Registry repository..." -ForegroundColor Cyan
$RepoCheck = gcloud artifacts repositories describe contract-risk-analyzer --location=$Region --format="value(name)" 2>$null
if (-not $RepoCheck) {
    Write-Host "Creating Docker repository 'contract-risk-analyzer' in $Region..." -ForegroundColor Green
    gcloud artifacts repositories create contract-risk-analyzer --repository-format=docker --location=$Region --description="Docker repository for Contract Risk Analyzer"
} else {
    Write-Host "Docker repository already exists." -ForegroundColor Green
}

# 5. Build and submit backend image
Write-Host "`nBuilding and pushing Backend image to Cloud Build..." -ForegroundColor Cyan
gcloud builds submit --tag "$Region-docker.pkg.dev/$ProjectID/contract-risk-analyzer/backend:latest" --file Dockerfile.backend .

# 6. Build and submit frontend image
Write-Host "`nBuilding and pushing Frontend image to Cloud Build..." -ForegroundColor Cyan
# Copy Nginx prod config to frontend dir temporarily for build context
Copy-Item -Path "frontend/nginx.prod.conf" -Destination "frontend/nginx.prod.conf" -Force
gcloud builds submit --tag "$Region-docker.pkg.dev/$ProjectID/contract-risk-analyzer/frontend:latest" --file frontend/Dockerfile.prod frontend/

# 7. Create service deployment manifest
Write-Host "`nGenerating deployment service manifest..." -ForegroundColor Cyan
$Template = Get-Content -Path "gcp-service.template.yaml" -Raw
$Manifest = $Template -replace "PROJECT_ID", $ProjectID
$Manifest = $Manifest -replace "REGION", $Region
$Manifest = $Manifest -replace "GEMINI_API_KEY_PLACEHOLDER", $GeminiKey

$Manifest | Out-File -FilePath "service.yaml" -Encoding utf8

# 8. Deploy to Cloud Run
Write-Host "`nDeploying multi-container service to Cloud Run..." -ForegroundColor Cyan
gcloud run services replace service.yaml --platform managed --region $Region

# 9. Set IAM policy to allow public unauthenticated access
Write-Host "`nSetting permissions to allow public access..." -ForegroundColor Cyan
gcloud run services add-iam-policy-binding contract-risk-analyzer --member="allUsers" --role="roles/run.viewer" --region=$Region --platform managed

# 10. Clean up temporary deployment manifest (contains API Key secret)
Write-Host "`nCleaning up local temporary config files..." -ForegroundColor Cyan
if (Test-Path "service.yaml") { Remove-Item -Path "service.yaml" -Force }

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "You can find your service URL in the output above." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

#!/bin/bash
# Google Cloud Run Sidecar Deployment Script
# Make sure you are authenticated before running: gcloud auth login

set -e

echo -n "Enter your Google Cloud Project ID: "
read ProjectID
echo -n "Enter your Gemini API Key: "
read GeminiKey
echo -n "Enter target deployment region [default: us-central1]: "
read Region
if [ -z "$Region" ]; then
  Region="us-central1"
fi

# 1. Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: Google Cloud SDK (gcloud CLI) is not installed. Please download it from: https://cloud.google.com/sdk"
    exit 1
fi

# 2. Set project context
echo -e "\nSetting project context to $ProjectID..."
gcloud config set project $ProjectID

# 3. Enable required APIs
echo -e "\nEnabling required GCP APIs (this may take a minute)..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

# 4. Create Artifact Registry repository
echo -e "\nChecking Artifact Registry repository..."
if ! gcloud artifacts repositories describe contract-risk-analyzer --location="$Region" &> /dev/null; then
    echo "Creating Docker repository 'contract-risk-analyzer' in $Region..."
    gcloud artifacts repositories create contract-risk-analyzer --repository-format=docker --location="$Region" --description="Docker repository for Contract Risk Analyzer"
else
    echo "Docker repository already exists."
fi

# 5. Build and submit backend image
echo -e "\nBuilding and pushing Backend image to Cloud Build..."
gcloud builds submit --tag "${Region}-docker.pkg.dev/${ProjectID}/contract-risk-analyzer/backend:latest" --file Dockerfile.backend .

# 6. Build and submit frontend image
echo -e "\nBuilding and pushing Frontend image to Cloud Build..."
cp frontend/nginx.prod.conf frontend/nginx.prod.conf
gcloud builds submit --tag "${Region}-docker.pkg.dev/${ProjectID}/contract-risk-analyzer/frontend:latest" --file frontend/Dockerfile.prod frontend/

# 7. Create service deployment manifest
echo -e "\nGenerating deployment service manifest..."
sed -e "s/PROJECT_ID/${ProjectID}/g" \
    -e "s/REGION/${Region}/g" \
    -e "s/GEMINI_API_KEY_PLACEHOLDER/${GeminiKey}/g" \
    gcp-service.template.yaml > service.yaml

# 8. Deploy to Cloud Run
echo -e "\nDeploying multi-container service to Cloud Run..."
gcloud run services replace service.yaml --platform managed --region "$Region"

# 9. Set IAM policy to allow public unauthenticated access
echo -e "\nSetting permissions to allow public access..."
gcloud run services add-iam-policy-binding contract-risk-analyzer --member="allUsers" --role="roles/run.viewer" --region="$Region" --platform managed

# 10. Clean up temporary deployment manifest (contains API Key secret)
echo -e "\nCleaning up local temporary config files..."
if [ -f service.yaml ]; then
  rm -f service.yaml
fi

echo -e "\n========================================================"
echo "Deployment completed successfully!"
echo "You can find your service URL in the output above."
echo "========================================================"

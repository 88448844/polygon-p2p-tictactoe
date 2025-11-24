#!/usr/bin/env bash
# Deploy p2p-tic-tac-toe to Google Cloud Run

# ==== USER CONFIGURATION ==== #
# Replace the values below with your own GCP project details
PROJECT_ID="studio-7817843196-28639"   # e.g. my-awesome-project
REGION="us-central1"               # Cloud Run region
SERVICE_NAME="p2p-tic-tac-toe"         # Desired Cloud Run service name
# =========================== #

# Image name (will be pushed to Container Registry)
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# Authenticate with Google Cloud (opens a browser for login)
gcloud auth login

gcloud config set project "$PROJECT_ID"

# Enable required APIs (run once)
gcloud services enable run.googleapis.com containerregistry.googleapis.com

# Build the Docker image
docker build -t "$IMAGE_NAME" .

# Push the image to Container Registry
docker push "$IMAGE_NAME"

# Deploy to Cloud Run (allow unauthenticated access)
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 3000

# Show the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format "value(status.url)")

echo "\nDeployment complete! Service URL: $SERVICE_URL"

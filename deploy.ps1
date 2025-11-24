# P2P Betting App - Cloud Run Deployment Script

$PROJECT_ID = Read-Host "Enter your Google Cloud Project ID"
$SERVICE_NAME = "p2p-tic-tac-toe"   # Updated service name
$REGION = "us-central1"

Write-Host "Building and deploying to Google Cloud Run..." -ForegroundColor Cyan

# Set the GCP project
gcloud config set project $PROJECT_ID

# Build and deploy the container
# If you have a secret for the private key, create it first:
#   echo -n "YOUR_PRIVATE_KEY" | gcloud secrets create BETTING_PRIVATE_KEY --data-file=-
# Then uncomment the --set-secrets line below.

gcloud run deploy $SERVICE_NAME `
  --source . `
  --region=$REGION `
  --platform=managed `
  --allow-unauthenticated `
  --set-env-vars="NODE_ENV=production" `
  #--set-secrets="PRIVATE_KEY=BETTING_PRIVATE_KEY:latest" `

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Your app is live at:" -ForegroundColor Yellow
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"
Write-Host $SERVICE_URL

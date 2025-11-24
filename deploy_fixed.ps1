# deploy_fixed.ps1
# Automated Build & Deploy Script for P2P Tic-Tac-Toe

$PROJECT = "studio-7817843196-28639"
$SERVICE = "p2p-tic-tac-toe"
$REGION  = "us-central1"
# Hardcoding the image string to avoid interpolation issues
$IMAGE   = "gcr.io/studio-7817843196-28639/p2p-tic-tac-toe:latest"

Write-Host "Starting Deployment Process..." -ForegroundColor Cyan

# 1. Build Docker Image
Write-Host "Building Docker Image: $IMAGE" -ForegroundColor Yellow
docker build -t $IMAGE .
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

# 2. Push to Container Registry
Write-Host "Pushing Image to GCR..." -ForegroundColor Yellow
docker push $IMAGE
if ($LASTEXITCODE -ne 0) { Write-Error "Push failed"; exit 1 }

# 3. Deploy to Cloud Run
Write-Host "Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $SERVICE `
  --image $IMAGE `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --set-env-vars "NODE_ENV=production" `
  --set-secrets "PRIVATE_KEY=BETTING_PRIVATE_KEY:latest"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment Successful!" -ForegroundColor Green
    $url = gcloud run services describe $SERVICE --platform managed --region $REGION --format 'value(status.url)'
    Write-Host "App URL: $url" -ForegroundColor Cyan
} else {
    Write-Error "Deployment failed"
}

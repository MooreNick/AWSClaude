#!/bin/bash
# deploy.sh - Full deployment script for the RAG tool
# Deploys CDK infrastructure, builds frontend, and uploads to S3
# Usage: ./scripts/deploy.sh

# Exit immediately if any command fails
set -e

# Print each command before executing (useful for debugging)
set -x

# ============================================================================
# STEP 1: Verify prerequisites are installed
# ============================================================================
echo "=== Checking prerequisites ==="

# Check that Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check that Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed. Install Python 3.12+ from https://python.org"
    exit 1
fi

# Check that AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "ERROR: AWS CLI is not installed. Install from https://aws.amazon.com/cli/"
    exit 1
fi

# Check that CDK CLI is installed
if ! command -v cdk &> /dev/null; then
    echo "Installing AWS CDK CLI globally..."
    npm install -g aws-cdk
fi

# Verify AWS credentials are configured
echo "=== Verifying AWS credentials ==="
aws sts get-caller-identity || {
    echo "ERROR: AWS credentials not configured. Run 'aws configure' first."
    exit 1
}

# ============================================================================
# STEP 2: Install CDK dependencies and build Lambda layer
# ============================================================================
echo "=== Installing CDK dependencies ==="

# Navigate to the CDK directory
cd "$(dirname "$0")/../cdk"
# Install CDK npm dependencies
npm install

# Navigate to the backend directory
cd ../backend
# Create the Lambda layer directory structure
mkdir -p layers/dependencies/python
# Install Python dependencies into the layer directory
pip install -r requirements.txt -t layers/dependencies/python/

# ============================================================================
# STEP 3: Bootstrap CDK (first-time only)
# ============================================================================
echo "=== Bootstrapping CDK ==="
cd ../cdk

# Bootstrap CDK in the target account/region (safe to run multiple times)
cdk bootstrap

# ============================================================================
# STEP 4: Deploy CDK stacks
# ============================================================================
echo "=== Deploying CDK stacks ==="

# Deploy all stacks (RagToolStack + RagToolBedrockStack)
# --require-approval never: auto-approve IAM changes (remove for production)
cdk deploy --all --require-approval never

# ============================================================================
# STEP 5: Build and deploy frontend
# ============================================================================
echo "=== Building frontend ==="

# Navigate to the frontend directory
cd ../frontend
# Install frontend npm dependencies
npm install
# Build the production frontend bundle
npm run build

# ============================================================================
# STEP 6: Upload frontend to S3 and invalidate CloudFront cache
# ============================================================================
echo "=== Deploying frontend to S3 ==="

# Get the frontend bucket name from CloudFormation stack outputs
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
    --output text)

# Get the CloudFront distribution ID for cache invalidation
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text)

# Sync the built frontend files to S3
aws s3 sync dist/ "s3://${FRONTEND_BUCKET}/" --delete

# Invalidate the CloudFront cache so users see the latest version
aws cloudfront create-invalidation \
    --distribution-id "${DISTRIBUTION_ID}" \
    --paths "/*"

# ============================================================================
# STEP 7: Print deployment info
# ============================================================================
echo "=== Deployment complete! ==="

# Get the CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionUrl'].OutputValue" \
    --output text)

echo ""
echo "Application URL: ${CLOUDFRONT_URL}"
echo "Frontend Bucket: ${FRONTEND_BUCKET}"
echo "Distribution ID: ${DISTRIBUTION_ID}"
echo ""
echo "IMPORTANT: Update the allowed IPs in cdk/lib/config.ts and redeploy"
echo "to restrict access to your IP addresses."

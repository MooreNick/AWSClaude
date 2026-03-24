#!/bin/bash
# deploy.sh - Full deployment script for the RAG tool
# Usage: ./scripts/deploy.sh <knowledge_base_id> <data_source_id>
# If KB/DS IDs not provided, deploys without them (Lambdas won't work until set)

set -e
set -x

# Read optional KB and DS IDs from arguments
KB_ID="${1:-}"
DS_ID="${2:-}"

# ============================================================================
# STEP 1: Verify prerequisites
# ============================================================================
echo "=== Checking prerequisites ==="

command -v node &> /dev/null || { echo "ERROR: Node.js not installed. Get it from https://nodejs.org"; exit 1; }
command -v python3 &> /dev/null || { echo "ERROR: Python 3 not installed. Get it from https://python.org"; exit 1; }
command -v aws &> /dev/null || { echo "ERROR: AWS CLI not installed. Get it from https://aws.amazon.com/cli/"; exit 1; }
command -v cdk &> /dev/null || { echo "Installing AWS CDK CLI..."; npm install -g aws-cdk; }

echo "=== Verifying AWS credentials ==="
aws sts get-caller-identity || { echo "ERROR: AWS credentials not configured. Run 'aws configure'."; exit 1; }

# ============================================================================
# STEP 2: Build Lambda layer
# ============================================================================
echo "=== Building Lambda layer ==="

cd "$(dirname "$0")/../backend"
mkdir -p layers/dependencies/python
pip install -r requirements.txt -t layers/dependencies/python/

# ============================================================================
# STEP 3: Install CDK dependencies
# ============================================================================
echo "=== Installing CDK dependencies ==="

cd ../cdk
npm install

# ============================================================================
# STEP 4: Bootstrap CDK (safe to run multiple times)
# ============================================================================
echo "=== Bootstrapping CDK ==="
cdk bootstrap

# ============================================================================
# STEP 5: Deploy CDK stack
# ============================================================================
echo "=== Deploying RagToolStack ==="

# Build the deploy command with optional context parameters
DEPLOY_CMD="cdk deploy RagToolStack --require-approval broadening"

if [ -n "$KB_ID" ]; then
    DEPLOY_CMD="$DEPLOY_CMD -c knowledgeBaseId=$KB_ID"
fi
if [ -n "$DS_ID" ]; then
    DEPLOY_CMD="$DEPLOY_CMD -c dataSourceId=$DS_ID"
fi

eval $DEPLOY_CMD

# ============================================================================
# STEP 6: Build and deploy frontend
# ============================================================================
echo "=== Building frontend ==="

cd ../frontend
npm install
npm run build

echo "=== Deploying frontend to S3 ==="

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
    --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text)

aws s3 sync dist/ "s3://${FRONTEND_BUCKET}/" --delete

aws cloudfront create-invalidation \
    --distribution-id "${DISTRIBUTION_ID}" \
    --paths "/*"

# ============================================================================
# STEP 7: Print deployment info
# ============================================================================
echo ""
echo "=== Deployment complete! ==="

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionUrl'].OutputValue" \
    --output text)

DOCUMENTS_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DocumentsBucketName'].OutputValue" \
    --output text)

echo ""
echo "Application URL: ${CLOUDFRONT_URL}"
echo "Frontend Bucket: ${FRONTEND_BUCKET}"
echo "Documents Bucket: ${DOCUMENTS_BUCKET}"
echo "Distribution ID: ${DISTRIBUTION_ID}"
echo ""

if [ -z "$KB_ID" ]; then
    echo "WARNING: No Knowledge Base ID provided."
    echo "Create a KB in the Bedrock console, then redeploy:"
    echo "  ./scripts/deploy.sh YOUR_KB_ID YOUR_DS_ID"
fi

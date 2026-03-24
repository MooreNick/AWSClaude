#!/bin/bash
# seed-data.sh - Upload sample documents to S3 for testing
# Creates category folder structure and uploads any sample files
# Usage: ./scripts/seed-data.sh

# Exit on error
set -e

# ============================================================================
# Get the documents bucket name from CloudFormation outputs
# ============================================================================
DOCUMENTS_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DocumentsBucketName'].OutputValue" \
    --output text)

echo "Documents bucket: ${DOCUMENTS_BUCKET}"

# ============================================================================
# Create category folder markers in S3
# S3 doesn't have real folders, but empty objects with trailing / act as markers
# ============================================================================
echo "=== Creating category folders ==="

# Create the tech-approach folder marker
aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "tech-approach/" --content-length 0
echo "Created: tech-approach/"

# Create the organizational-approach folder marker
aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "organizational-approach/" --content-length 0
echo "Created: organizational-approach/"

# Create the past-performance folder marker
aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "past-performance/" --content-length 0
echo "Created: past-performance/"

# Create the resumes folder marker
aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "resumes/" --content-length 0
echo "Created: resumes/"

# ============================================================================
# Upload sample files if they exist in a local samples/ directory
# ============================================================================
SAMPLES_DIR="$(dirname "$0")/../samples"

if [ -d "${SAMPLES_DIR}" ]; then
    echo "=== Uploading sample files from ${SAMPLES_DIR} ==="
    # Upload all files in the samples directory, preserving subfolder structure
    aws s3 sync "${SAMPLES_DIR}" "s3://${DOCUMENTS_BUCKET}/"
    echo "Sample files uploaded successfully."
else
    echo "No samples/ directory found. Skipping sample upload."
    echo "To upload sample files, create a samples/ directory with subfolders"
    echo "matching category prefixes (tech-approach/, organizational-approach/, etc.)"
fi

# ============================================================================
# Trigger Knowledge Base sync
# ============================================================================
echo "=== Triggering Knowledge Base sync ==="

# Get the Knowledge Base ID from the Bedrock stack outputs
KB_ID=$(aws cloudformation describe-stacks \
    --stack-name RagToolBedrockStack \
    --query "Stacks[0].Outputs[?OutputKey=='KnowledgeBaseId'].OutputValue" \
    --output text)

# Get the Data Source ID from the Bedrock stack outputs
DS_ID=$(aws cloudformation describe-stacks \
    --stack-name RagToolBedrockStack \
    --query "Stacks[0].Outputs[?OutputKey=='DataSourceId'].OutputValue" \
    --output text)

if [ -n "${KB_ID}" ] && [ -n "${DS_ID}" ]; then
    # Start the ingestion job to process the uploaded documents
    aws bedrock-agent start-ingestion-job \
        --knowledge-base-id "${KB_ID}" \
        --data-source-id "${DS_ID}"
    echo "Ingestion job started. Documents will be indexed shortly."
else
    echo "WARNING: Could not find KB ID or Data Source ID."
    echo "You may need to set up the Bedrock Knowledge Base manually."
fi

echo ""
echo "=== Seed data complete ==="
echo "Upload your actual documents to s3://${DOCUMENTS_BUCKET}/<category>/"

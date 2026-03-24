#!/bin/bash
# seed-data.sh - Create S3 category folders and upload sample documents
# Usage: ./scripts/seed-data.sh [knowledge_base_id] [data_source_id]

set -e

KB_ID="${1:-}"
DS_ID="${2:-}"

# Get the documents bucket name from CloudFormation outputs
DOCUMENTS_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DocumentsBucketName'].OutputValue" \
    --output text)

echo "Documents bucket: ${DOCUMENTS_BUCKET}"

# Create category folder markers in S3
echo "=== Creating category folders ==="

aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "tech-approach/" --content-length 0
echo "Created: tech-approach/"

aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "organizational-approach/" --content-length 0
echo "Created: organizational-approach/"

aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "past-performance/" --content-length 0
echo "Created: past-performance/"

aws s3api put-object --bucket "${DOCUMENTS_BUCKET}" --key "resumes/" --content-length 0
echo "Created: resumes/"

# Upload sample files if they exist in a local samples/ directory
SAMPLES_DIR="$(dirname "$0")/../samples"

if [ -d "${SAMPLES_DIR}" ]; then
    echo "=== Uploading sample files from ${SAMPLES_DIR} ==="
    aws s3 sync "${SAMPLES_DIR}" "s3://${DOCUMENTS_BUCKET}/"
    echo "Sample files uploaded."
else
    echo "No samples/ directory found. Upload documents manually:"
    echo "  aws s3 cp your-file.pdf s3://${DOCUMENTS_BUCKET}/tech-approach/"
fi

# Trigger Knowledge Base sync if IDs are provided
if [ -n "${KB_ID}" ] && [ -n "${DS_ID}" ]; then
    echo "=== Triggering Knowledge Base sync ==="
    aws bedrock-agent start-ingestion-job \
        --knowledge-base-id "${KB_ID}" \
        --data-source-id "${DS_ID}"
    echo "Ingestion job started."
else
    echo ""
    echo "KB sync not triggered (no KB_ID/DS_ID provided)."
    echo "To sync: ./scripts/sync-knowledge-base.sh YOUR_KB_ID YOUR_DS_ID"
fi

echo ""
echo "=== Done ==="
echo "Documents bucket: s3://${DOCUMENTS_BUCKET}/"

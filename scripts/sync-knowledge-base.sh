#!/bin/bash
# sync-knowledge-base.sh - Manually trigger Bedrock Knowledge Base sync
# Run this after adding new documents to S3 to make them searchable
# Usage: ./scripts/sync-knowledge-base.sh

# Exit on error
set -e

# ============================================================================
# Get Knowledge Base and Data Source IDs from CloudFormation outputs
# ============================================================================

# Get the Knowledge Base ID
KB_ID=$(aws cloudformation describe-stacks \
    --stack-name RagToolBedrockStack \
    --query "Stacks[0].Outputs[?OutputKey=='KnowledgeBaseId'].OutputValue" \
    --output text)

# Get the Data Source ID
DS_ID=$(aws cloudformation describe-stacks \
    --stack-name RagToolBedrockStack \
    --query "Stacks[0].Outputs[?OutputKey=='DataSourceId'].OutputValue" \
    --output text)

echo "Knowledge Base ID: ${KB_ID}"
echo "Data Source ID: ${DS_ID}"

# Validate that both IDs were found
if [ -z "${KB_ID}" ] || [ -z "${DS_ID}" ]; then
    echo "ERROR: Could not retrieve KB or Data Source IDs from CloudFormation."
    echo "Make sure the RagToolBedrockStack has been deployed."
    exit 1
fi

# ============================================================================
# Start the ingestion job
# ============================================================================
echo "=== Starting ingestion job ==="

# Trigger the sync
RESULT=$(aws bedrock-agent start-ingestion-job \
    --knowledge-base-id "${KB_ID}" \
    --data-source-id "${DS_ID}" \
    --output json)

# Extract the job ID from the response
JOB_ID=$(echo "${RESULT}" | python3 -c "import sys, json; print(json.load(sys.stdin)['ingestionJob']['ingestionJobId'])")

echo "Ingestion job started: ${JOB_ID}"

# ============================================================================
# Monitor the ingestion job status
# ============================================================================
echo "=== Monitoring ingestion status ==="

while true; do
    # Check the current status of the ingestion job
    STATUS=$(aws bedrock-agent get-ingestion-job \
        --knowledge-base-id "${KB_ID}" \
        --data-source-id "${DS_ID}" \
        --ingestion-job-id "${JOB_ID}" \
        --query "ingestionJob.status" \
        --output text)

    echo "Status: ${STATUS}"

    # Check if the job has completed (successfully or with failure)
    if [ "${STATUS}" = "COMPLETE" ]; then
        echo "Ingestion completed successfully!"
        break
    elif [ "${STATUS}" = "FAILED" ]; then
        echo "ERROR: Ingestion failed!"
        # Get failure reason
        aws bedrock-agent get-ingestion-job \
            --knowledge-base-id "${KB_ID}" \
            --data-source-id "${DS_ID}" \
            --ingestion-job-id "${JOB_ID}"
        exit 1
    fi

    # Wait 10 seconds before checking again
    echo "Waiting 10 seconds..."
    sleep 10
done

# Print final statistics
echo "=== Ingestion statistics ==="
aws bedrock-agent get-ingestion-job \
    --knowledge-base-id "${KB_ID}" \
    --data-source-id "${DS_ID}" \
    --ingestion-job-id "${JOB_ID}" \
    --query "ingestionJob.statistics"

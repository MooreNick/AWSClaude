#!/bin/bash
# sync-knowledge-base.sh - Trigger Bedrock Knowledge Base sync
# Usage: ./scripts/sync-knowledge-base.sh <knowledge_base_id> <data_source_id>

set -e

KB_ID="${1:-}"
DS_ID="${2:-}"

if [ -z "$KB_ID" ] || [ -z "$DS_ID" ]; then
    echo "Usage: ./scripts/sync-knowledge-base.sh <knowledge_base_id> <data_source_id>"
    echo ""
    echo "Find these IDs in the AWS Console:"
    echo "  Bedrock > Knowledge bases > your KB > Details page"
    exit 1
fi

echo "Knowledge Base ID: ${KB_ID}"
echo "Data Source ID: ${DS_ID}"

# Start the ingestion job
echo "=== Starting ingestion job ==="

RESULT=$(aws bedrock-agent start-ingestion-job \
    --knowledge-base-id "${KB_ID}" \
    --data-source-id "${DS_ID}" \
    --output json)

JOB_ID=$(echo "${RESULT}" | python3 -c "import sys, json; print(json.load(sys.stdin)['ingestionJob']['ingestionJobId'])")

echo "Ingestion job started: ${JOB_ID}"

# Monitor the ingestion job status
echo "=== Monitoring ingestion status ==="

while true; do
    STATUS=$(aws bedrock-agent get-ingestion-job \
        --knowledge-base-id "${KB_ID}" \
        --data-source-id "${DS_ID}" \
        --ingestion-job-id "${JOB_ID}" \
        --query "ingestionJob.status" \
        --output text)

    echo "Status: ${STATUS}"

    if [ "${STATUS}" = "COMPLETE" ]; then
        echo "Ingestion completed successfully!"
        break
    elif [ "${STATUS}" = "FAILED" ]; then
        echo "ERROR: Ingestion failed!"
        aws bedrock-agent get-ingestion-job \
            --knowledge-base-id "${KB_ID}" \
            --data-source-id "${DS_ID}" \
            --ingestion-job-id "${JOB_ID}"
        exit 1
    fi

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

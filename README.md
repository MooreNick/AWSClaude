# RAG Document Tool - AWS-Powered Document Search, Generation & Audit

A fully AWS-hosted tool for searching, generating, and auditing documents using Retrieval Augmented Generation (RAG). Built with Amazon Bedrock Knowledge Bases, Lambda, API Gateway, CloudFront, and WAF.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Prerequisites](#prerequisites)
5. [Project Structure](#project-structure)
6. [Setup Instructions](#setup-instructions)
7. [Configuration](#configuration)
8. [Deployment](#deployment)
9. [Usage Guide](#usage-guide)
10. [Adding New Categories](#adding-new-categories)
11. [Troubleshooting](#troubleshooting)
12. [Cost Estimates](#cost-estimates)
13. [Security](#security)

---

## Overview

This tool provides three core capabilities:

1. **Search & Generate**: Upload a document or enter text, search for relevant reference documents in S3 using RAG, review results, then generate a new draft document matching the style of the references.
2. **File Manager**: Browse, upload, and delete documents in S3 organized by category folders. Uploaded files are automatically indexed for RAG search.
3. **Document Audit**: Upload two documents - one to audit and one containing criteria - and receive a structured report comparing the document against each extracted criterion.

All infrastructure runs entirely on AWS with IP-based access restriction.

---

## Architecture

```
                                AWS Cloud (us-east-1)
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  User (Allowed IP)                                                       │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────┐     ┌────────────┐     ┌──────────────────┐                │
│  │ AWS WAF  │────▶│ CloudFront │────▶│  S3 (Frontend)   │                │
│  │ IP Allow │     │    CDN     │     │  React SPA       │                │
│  └─────────┘     └─────┬──────┘     └──────────────────┘                │
│                         │ /api/*                                         │
│                         ▼                                                │
│               ┌───────────────┐     ┌──────────────────────┐            │
│               │ API Gateway   │────▶│ Lambda Functions     │            │
│               │ HTTP API v2   │     │ (Python 3.12)        │            │
│               └───────────────┘     │                      │            │
│                                     │ • search.py          │            │
│                                     │ • generate.py        │            │
│                                     │ • upload.py          │            │
│                                     │ • files.py           │            │
│                                     │ • audit.py           │            │
│                                     │ • categories.py      │            │
│                                     └──────┬───────────────┘            │
│                                            │                             │
│                    ┌───────────────────────┼──────────────────┐          │
│                    ▼                       ▼                  ▼          │
│          ┌──────────────┐     ┌──────────────────┐  ┌──────────────┐   │
│          │ S3 Documents │     │ Bedrock KB       │  │ Bedrock LLM  │   │
│          │ Bucket       │     │ + S3 Vectors     │  │ Claude Haiku │   │
│          │              │     │ + Titan Embed V2 │  │ Claude Sonnet│   │
│          │ /tech-approach/│   └──────────────────┘  └──────────────┘   │
│          │ /org-approach/ │                                              │
│          │ /past-perf/    │                                              │
│          │ /resumes/      │                                              │
│          └──────────────┘                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### AWS Services Used

| Service | Purpose | Cost Impact |
|---------|---------|-------------|
| **S3** | Document storage + frontend hosting | ~$1-3/month |
| **CloudFront** | CDN, HTTPS, routes /api/* to API Gateway | ~$1-2/month |
| **WAF** | IP-based access restriction | ~$6/month |
| **API Gateway v2** | HTTP API routing to Lambda | <$1/month |
| **Lambda** | Backend compute (Python 3.12) | ~$1-5/month |
| **Bedrock Knowledge Bases** | Managed RAG (chunking, embedding, retrieval) | No extra charge |
| **Bedrock - Titan Embed V2** | Text-to-vector embeddings | <$1/month |
| **Bedrock - Claude 3.5 Haiku** | RAG generation (draft documents) | ~$5-15/month |
| **Bedrock - Claude Sonnet** | Document audit analysis | ~$2-10/month |

**Estimated total: ~$20-50/month** for ~5 users, ~100 queries/day, ~500 documents.

---

## Features

### Search & Generate
- Upload a PDF, DOCX, or TXT file and/or type a text query
- Select a document category to narrow the search (or search all)
- Select a writing tone (Professional, Technical, Conversational, Formal, Concise)
- View matching documents with relevance scores and relevant passages
- Select which results to use as references
- Generate a new draft document matching the style of selected references
- Copy generated text to clipboard

### File Manager
- Browse all documents in S3, filtered by category
- Upload new documents to any category
- Delete documents from S3
- Automatic Knowledge Base sync after upload

### Document Audit
- Upload any document to audit + any reference file containing criteria
- LLM extracts criteria from the reference (works with any format)
- Structured report: each criterion gets MEETS / PARTIALLY MEETS / DOES NOT MEET
- Evidence quotes and improvement recommendations

---

## Prerequisites

Before setting up this tool, ensure you have the following installed on your machine:

1. **Node.js 18+** - Download from https://nodejs.org/
   - Verify: `node --version` (should show v18.x or higher)
   - Verify: `npm --version` (should show 9.x or higher)

2. **Python 3.12+** - Download from https://python.org/
   - Verify: `python3 --version` (should show 3.12.x or higher)
   - Verify: `pip3 --version`

3. **AWS CLI v2** - Download from https://aws.amazon.com/cli/
   - Verify: `aws --version` (should show aws-cli/2.x)
   - Configure: `aws configure` (enter your Access Key, Secret Key, and region `us-east-1`)

4. **AWS CDK CLI** - Install globally via npm:
   ```bash
   npm install -g aws-cdk
   ```
   - Verify: `cdk --version`

5. **AWS Account** with:
   - IAM user or role with Administrator access (for CDK deployment)
   - Bedrock model access enabled (see Setup Instructions)

---

## Project Structure

```
AWSClaude/
├── README.md                          # This file
├── setup-steps.csv                    # Step-by-step setup guide (CSV)
├── cdk/                               # AWS CDK Infrastructure as Code
│   ├── package.json                   # CDK npm dependencies
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── cdk.json                       # CDK app configuration
│   ├── bin/app.ts                     # CDK app entry point
│   └── lib/
│       ├── config.ts                  # CENTRAL CONFIG: categories, IPs, models
│       ├── rag-stack.ts               # S3, Lambda, API GW, CloudFront, WAF
│       └── bedrock-stack.ts           # Bedrock Knowledge Base, Data Source
├── backend/                           # Python Lambda function code
│   ├── requirements.txt               # Python dependencies
│   ├── shared/                        # Shared utilities
│   │   ├── config.py                  # Backend configuration (reads env vars)
│   │   ├── document_parser.py         # PDF/DOCX/TXT text extraction
│   │   ├── s3_utils.py                # S3 operations (upload, list, delete)
│   │   ├── bedrock_utils.py           # Bedrock model invocation wrappers
│   │   └── knowledge_base.py          # Bedrock KB Retrieve + Ingestion
│   └── handlers/                      # Lambda function handlers
│       ├── search.py                  # POST /api/search
│       ├── generate.py                # POST /api/generate
│       ├── upload.py                  # POST /api/upload
│       ├── files.py                   # GET/DELETE /api/files
│       ├── audit.py                   # POST /api/audit
│       └── categories.py             # GET /api/categories
├── frontend/                          # React frontend application
│   ├── package.json                   # Frontend npm dependencies
│   ├── vite.config.ts                 # Vite build configuration
│   ├── tailwind.config.js             # Tailwind CSS configuration
│   ├── index.html                     # HTML entry point
│   └── src/
│       ├── main.tsx                   # React app entry point
│       ├── App.tsx                    # Router and layout setup
│       ├── api/client.ts             # API client (axios)
│       ├── types/index.ts            # TypeScript interfaces
│       ├── config/categories.ts      # Default category config
│       ├── pages/                    # Page components
│       │   ├── SearchPage.tsx        # Search & Generate workflow
│       │   ├── FilesPage.tsx         # S3 File Manager
│       │   └── AuditPage.tsx         # Document Audit
│       └── components/               # Reusable UI components
│           ├── Layout.tsx            # Nav bar and page wrapper
│           ├── FileUploader.tsx      # Drag-and-drop file upload
│           ├── CategorySelector.tsx  # Category dropdown
│           ├── ToneSelector.tsx      # Tone dropdown
│           ├── SearchResults.tsx     # Results with checkboxes
│           ├── GeneratedOutput.tsx   # Generated draft display
│           ├── FileBrowser.tsx       # S3 file table
│           └── AuditReport.tsx       # Audit results display
└── scripts/                          # Deployment and utility scripts
    ├── deploy.sh                     # Full deployment script
    ├── seed-data.sh                  # Create S3 folders + upload samples
    └── sync-knowledge-base.sh        # Manually trigger KB sync
```

---

## Setup Instructions

### Step 1: Enable Bedrock Model Access

Before deploying, you must enable access to the required Bedrock models:

1. Sign in to the **AWS Console** in the **us-east-1** region
2. Navigate to **Amazon Bedrock** > **Model access** (left sidebar)
3. Click **Manage model access**
4. Enable the following models:
   - **Amazon Titan Text Embeddings V2** (amazon.titan-embed-text-v2:0)
   - **Anthropic Claude 3.5 Haiku** (anthropic.claude-3-5-haiku-20241022-v1:0)
   - **Anthropic Claude Sonnet** (anthropic.claude-sonnet-4-20250514-v1:0)
5. Click **Request model access** and wait for approval (usually instant for Titan, may take minutes for Claude)

### Step 2: Configure Your IP Addresses

Edit `cdk/lib/config.ts` and replace the placeholder IP with your actual IP address(es):

```typescript
export const ALLOWED_IPS: string[] = [
  'YOUR.PUBLIC.IP.ADDRESS/32',  // Replace with your actual public IP
  // Add more IPs as needed
];
```

To find your public IP: visit https://whatismyip.com

### Step 3: Install Dependencies

```bash
# Install CDK dependencies
cd cdk
npm install

# Install Python dependencies for Lambda layer
cd ../backend
mkdir -p layers/dependencies/python
pip install -r requirements.txt -t layers/dependencies/python/

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 4: Bootstrap CDK (First Time Only)

```bash
cd cdk
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

Replace `YOUR_ACCOUNT_ID` with your 12-digit AWS account ID (find it via `aws sts get-caller-identity`).

### Step 5: Deploy Infrastructure

```bash
cd cdk
cdk deploy --all
```

This creates two CloudFormation stacks:
- **RagToolStack**: S3 buckets, Lambda, API Gateway, CloudFront, WAF
- **RagToolBedrockStack**: Bedrock Knowledge Base, Data Source

Note the outputs - you'll need the CloudFront URL, bucket names, and KB ID.

### Step 6: Set Up Bedrock Knowledge Base (Manual Steps)

> **Important**: The CDK creates the Bedrock KB framework, but you may need to complete the vector store configuration manually in the AWS Console, especially if using S3 Vectors.

1. Go to **Amazon Bedrock** > **Knowledge bases** in the AWS Console
2. Find the knowledge base created by CDK (named `rag-tool-kb`)
3. Verify the data source points to your documents S3 bucket
4. If the vector store needs configuration, follow the console wizard

### Step 7: Update Lambda Environment Variables

After the Bedrock stack deploys, update the Lambda functions with the actual Knowledge Base ID and Data Source ID:

```bash
# Get the IDs from CloudFormation outputs
KB_ID=$(aws cloudformation describe-stacks --stack-name RagToolBedrockStack \
    --query "Stacks[0].Outputs[?OutputKey=='KnowledgeBaseId'].OutputValue" --output text)
DS_ID=$(aws cloudformation describe-stacks --stack-name RagToolBedrockStack \
    --query "Stacks[0].Outputs[?OutputKey=='DataSourceId'].OutputValue" --output text)

# Update each Lambda function's environment variables
for fn in SearchFunction GenerateFunction UploadFunction FilesFunction AuditFunction CategoriesFunction; do
    aws lambda update-function-configuration \
        --function-name "RagToolStack-${fn}*" \
        --environment "Variables={KNOWLEDGE_BASE_ID=${KB_ID},DATA_SOURCE_ID=${DS_ID},DOCUMENTS_BUCKET=$(aws cloudformation describe-stacks --stack-name RagToolStack --query "Stacks[0].Outputs[?OutputKey=='DocumentsBucketName'].OutputValue" --output text)}"
done
```

### Step 8: Build and Deploy Frontend

```bash
cd frontend
npm run build

# Get bucket name and deploy
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)
aws s3 sync dist/ "s3://${FRONTEND_BUCKET}/" --delete

# Invalidate CloudFront cache
DIST_ID=$(aws cloudformation describe-stacks --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*"
```

### Step 9: Upload Documents and Sync

```bash
# Upload documents to S3 category folders
aws s3 cp your-tech-doc.pdf s3://YOUR-DOCUMENTS-BUCKET/tech-approach/
aws s3 cp your-resume.pdf s3://YOUR-DOCUMENTS-BUCKET/resumes/

# Trigger Knowledge Base sync
./scripts/sync-knowledge-base.sh
```

### Step 10: Access the Application

Get the CloudFront URL:
```bash
aws cloudformation describe-stacks --stack-name RagToolStack \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionUrl'].OutputValue" --output text
```

Open the URL in your browser (from an allowed IP address).

---

## Configuration

### Central Configuration File: `cdk/lib/config.ts`

This is the single source of truth for the entire application:

- **CATEGORIES**: Document categories (add new ones here)
- **ALLOWED_IPS**: IP addresses/CIDRs allowed to access the tool
- **BEDROCK_MODELS**: Model IDs for embedding, generation, and audit
- **RESOURCE_NAMES**: AWS resource naming conventions
- **TONE_OPTIONS**: Available writing tones for generation
- **DOCUMENT_PROCESSING**: Chunk size and supported file types

---

## Adding New Categories

To add a new document category (e.g., "Cost Volume"):

1. **Edit `cdk/lib/config.ts`** - Add a new entry to the CATEGORIES array:
   ```typescript
   {
     id: 'cost-volume',
     label: 'Cost Volume',
     s3Prefix: 'cost-volume/',
     description: 'Cost proposals and pricing volumes',
   },
   ```

2. **Redeploy CDK**: `cd cdk && cdk deploy --all`

3. **Create the S3 folder**: `aws s3api put-object --bucket YOUR-BUCKET --key "cost-volume/" --content-length 0`

4. **Upload documents**: `aws s3 cp your-cost-doc.pdf s3://YOUR-BUCKET/cost-volume/`

5. **Sync Knowledge Base**: `./scripts/sync-knowledge-base.sh`

The new category will automatically appear in the frontend dropdowns.

---

## Troubleshooting

### "Access Denied" when accessing the application
- Your IP is not in the WAF allowlist. Update `ALLOWED_IPS` in `cdk/lib/config.ts` and redeploy.

### Search returns no results
- Documents may not be indexed yet. Run `./scripts/sync-knowledge-base.sh` and wait for completion.
- Check that documents are in the correct S3 category folder.

### Lambda timeout errors
- The audit function may need more time for large documents. Increase the timeout in `rag-stack.ts`.

### "Model not available" errors
- Ensure you've enabled Bedrock model access (Step 1 of setup).
- Check that you're deploying in `us-east-1` where the models are available.

### Frontend not updating after deploy
- Run CloudFront cache invalidation: `aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"`

---

## Cost Estimates

For a small team (~5 users, ~100 queries/day, ~500 documents):

| Service | Monthly Cost |
|---------|-------------|
| S3 (Standard) | $1-3 |
| CloudFront | $1-2 |
| WAF | $6 |
| API Gateway | <$1 |
| Lambda | $1-5 |
| Bedrock Titan Embed | <$1 |
| Bedrock Claude Haiku | $5-15 |
| Bedrock Claude Sonnet | $2-10 |
| **Total** | **~$20-50** |

---

## Security

- **IP Restriction**: AWS WAF blocks all traffic except from allowed IP CIDRs
- **No Public S3**: All buckets use BlockPublicAccess; frontend served via CloudFront OAC
- **Encryption**: SSE-S3 encryption on all S3 buckets
- **IAM Least Privilege**: Lambda roles only have permissions they need
- **HTTPS Only**: CloudFront enforces HTTPS for all connections
- **Origin Verification**: Custom header prevents direct API Gateway access

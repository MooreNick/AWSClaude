# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Document Assistant — a React (Vite) frontend that talks to an AWS Lambda backend via API Gateway. Three workflows: S3 document management for RAG, RAG-powered content generation, and document compliance auditing.

## Current State / What Has Been Done

The frontend code at `/home/ubuntu/frontend` has been **fully adapted** to work with the AWS Lambda backend at `/home/ubuntu/AWSClaude` (cloned from https://github.com/MooreNick/AWSClaude). All API translation is complete — the frontend now sends JSON with base64-encoded files instead of multipart/form-data, routes map to the correct backend endpoints, and option values match the backend config.

### What remains to be done

1. **Deploy the backend CDK stack** (requires AWS credentials — see Deployment section below)
2. **Create a Bedrock Knowledge Base** (manual step in AWS Console — see Prerequisites)
3. **Update WAF IP allowlist** in `cdk/lib/config.ts` with the new EC2 public IP
4. **Build and deploy the frontend** to the S3/CloudFront created by CDK

## Frontend Commands

```bash
cd /home/ubuntu/frontend
npm run dev        # Dev server on 0.0.0.0:3000 (proxies /api → API Gateway)
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Architecture

### Frontend (`/home/ubuntu/frontend`)

React/Vite app. All API calls go through `src/config/apiAdapter.js`, which translates between frontend component expectations and the backend Lambda API (base64 encoding, route mapping, response normalization).

Key files:
- **`src/config/apiAdapter.js`** — API translation layer (routes, base64, params, responses). This is where all backend communication logic lives.
- **`src/config/options.js`** — Single source of truth for search-types, doc-types, and tones. Values use hyphens (e.g. `tech-approach`) to match backend S3 prefixes. Tone IDs are lowercase (e.g. `professional`, `formal`).
- **`src/config/api.js`** — Axios instance; base URL from `VITE_API_URL` env var.
- **`src/pages/Documents.jsx`** — S3 document management (list/upload)
- **`src/pages/Generate.jsx`** — Multi-phase RAG workflow (search → review → generate)
- **`src/pages/Audit.jsx`** — Document compliance auditing
- **`.env.production`** — Sets `VITE_API_URL=` (empty) for CloudFront same-origin routing

### Backend (`/home/ubuntu/AWSClaude`)

Cloned from https://github.com/MooreNick/AWSClaude. Serverless AWS stack deployed via CDK:

- **6 Lambda functions** in `backend/handlers/`: categories, files, upload, search, generate, audit
- **Shared utilities** in `backend/shared/`: bedrock_utils, config, document_parser, knowledge_base, s3_utils
- **CDK stack** in `cdk/`: defines all AWS infrastructure
- **Deploy script**: `scripts/deploy.sh <KB_ID> <DS_ID>`

### Backend API Endpoints

| Method | Path | Content-Type | Purpose |
|--------|------|-------------|---------|
| GET | `/api/categories` | — | List available categories and tones |
| GET | `/api/files?category=X` | — | List docs in S3 |
| POST | `/api/upload` | application/json | Upload file `{ filename, content (base64), category }` |
| POST | `/api/search` | application/json | RAG retrieval `{ query, category?, file_content? (base64), filename? }` |
| POST | `/api/generate` | application/json | Generate doc `{ query, passages[], tone }` |
| POST | `/api/audit` | application/json | Audit `{ document_content (base64), document_filename, criteria_content (base64), criteria_filename }` |

### AWS Services

- **S3** — document storage (category-prefixed) + frontend static hosting
- **Lambda** — 6 handler functions for business logic
- **API Gateway HTTP API** — routes `/api/*` to Lambda handlers
- **Bedrock** — Claude 3.5 Haiku (generation), Claude Sonnet 4 (auditing), Titan V2 (embeddings)
- **Bedrock Knowledge Base** — vector indexing and RAG retrieval
- **CloudFront** — CDN serving frontend + forwarding `/api/*` to API Gateway
- **WAF** — IP-based access control on CloudFront
- **CDK** — infrastructure-as-code (TypeScript)

### Production Hosting (CloudFront)

CloudFront serves as unified entry point:
- Default behavior → S3 bucket (frontend static files)
- `/api/*` behavior → API Gateway origin
- Same-origin = no CORS needed
- WAF IP allowlist controls access

## Deployment Instructions

### Prerequisites (AWS Console — do these first)

1. **Enable Bedrock model access** in us-east-1:
   - `amazon.titan-embed-text-v2:0` (embeddings)
   - `anthropic.claude-3-5-haiku-20241022-v1:0` (generation)
   - `anthropic.claude-sonnet-4-20250514-v1:0` (auditing)
   - Go to: AWS Console → Bedrock → Model access → Enable specific models

2. **Create a Bedrock Knowledge Base** (must be done manually before CDK deploy):
   - Go to: AWS Console → Bedrock → Knowledge bases → Create
   - Name: `rag-tool-kb`
   - Embedding model: Titan Text Embeddings V2
   - Vector store: use default (Amazon OpenSearch Serverless)
   - Data source: S3 — you'll point this to the documents bucket **after** CDK creates it, OR create the KB first and note the IDs
   - Chunking: 512 tokens, 20% overlap
   - **Note the Knowledge Base ID and Data Source ID** — you'll need these for deployment

3. **Determine your public IP** for WAF allowlisting:
   ```bash
   curl -s ifconfig.me
   ```

### Step 1: Update WAF IP allowlist

Edit `/home/ubuntu/AWSClaude/cdk/lib/config.ts`, find the `ALLOWED_IPS` array and replace `0.0.0.0/32` with your actual IP:

```typescript
export const ALLOWED_IPS: string[] = [
  'YOUR.PUBLIC.IP/32',
];
```

### Step 2: Install CDK globally

```bash
npm install -g aws-cdk
```

### Step 3: Deploy the backend

```bash
cd /home/ubuntu/AWSClaude
chmod +x scripts/deploy.sh

# The deploy script builds Lambda layers, installs CDK deps, bootstraps, and deploys
# It also tries to build the repo's own frontend — we'll use our frontend instead
# Pass KB and DS IDs if you have them:
./scripts/deploy.sh <KNOWLEDGE_BASE_ID> <DATA_SOURCE_ID>

# Or deploy without KB (Lambda search/generate won't work until set):
./scripts/deploy.sh
```

**Note:** The deploy script builds the repo's `/home/ubuntu/AWSClaude/frontend/` (TypeScript/Tailwind). After it deploys, we overwrite with our frontend build. Alternatively, you can run CDK deploy manually:

```bash
cd /home/ubuntu/AWSClaude/backend
mkdir -p layers/dependencies/python
pip install -r requirements.txt -t layers/dependencies/python/

cd /home/ubuntu/AWSClaude/cdk
npm install
cdk bootstrap
cdk deploy RagToolStack --require-approval broadening \
  -c knowledgeBaseId=<KB_ID> \
  -c dataSourceId=<DS_ID>
```

### Step 4: Note the CDK outputs

After deployment, get the stack outputs:

```bash
aws cloudformation describe-stacks --stack-name RagToolStack \
  --query "Stacks[0].Outputs" --output table
```

You need:
- **DistributionUrl** — the CloudFront URL (your app's public URL)
- **FrontendBucketName** — S3 bucket for frontend static files
- **DocumentsBucketName** — S3 bucket for RAG documents
- **DistributionId** — for cache invalidation

### Step 5: Build and deploy the frontend

```bash
cd /home/ubuntu/frontend
npm run build

# Get bucket name and distribution ID from stack outputs
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name RagToolStack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name RagToolStack \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

# Upload to S3
aws s3 sync dist/ "s3://${FRONTEND_BUCKET}/" --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*"
```

### Step 6: Connect Knowledge Base to Documents Bucket

If you created the KB before CDK deploy, update its data source to point to the `DocumentsBucketName` bucket. If you created the KB after, sync it:

```bash
cd /home/ubuntu/AWSClaude
chmod +x scripts/sync-knowledge-base.sh
./scripts/sync-knowledge-base.sh <KNOWLEDGE_BASE_ID> <DATA_SOURCE_ID>
```

### Step 7: Seed sample data (optional)

```bash
chmod +x /home/ubuntu/AWSClaude/scripts/seed-data.sh
./scripts/seed-data.sh
```

### Step 8: Verify

1. Open the CloudFront URL in your browser
2. Test Document Library: list files, upload a small .txt file
3. Test Generate: enter context, select options, verify retrieval and generation
4. Test Audit: upload two files, verify issues display

## Development (local dev server against deployed backend)

For iterating on the frontend against the deployed API Gateway:

```bash
# Option A: Use Vite proxy (update target in vite.config.js)
cd /home/ubuntu/frontend
# Edit vite.config.js proxy target to your API Gateway URL
npm run dev

# Option B: Set env var directly
VITE_API_URL=https://<api-gateway-url> npm run dev
```

The Vite proxy in `vite.config.js` forwards `/api/*` to the target (no path rewrite — backend expects `/api` prefix).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Document Assistant — a React (Vite) frontend that talks to an AWS Lambda backend via API Gateway. Three workflows: S3 document management for RAG, RAG-powered content generation, and document compliance auditing.

## Current State — Fully Deployed

The entire stack is deployed and live. The frontend has been adapted to work with the AWS Lambda backend (JSON with base64-encoded files, correct route mapping, option values matching backend config).

### Deployed Infrastructure

| Resource | Value |
|----------|-------|
| **App URL** | `https://d3jwts8kiyxdij.cloudfront.net` |
| **API Gateway** | `https://ejijo61aeh.execute-api.us-east-1.amazonaws.com` |
| **Frontend Bucket** | `023530626172-rag-frontend` |
| **Documents Bucket** | `023530626172-rag-documents` |
| **CloudFront Distribution ID** | `E25VNHJIPOOYU` |
| **Knowledge Base ID** | `EYOS38B1QP` |
| **Data Source ID** | `FBMDB4ZGS3` |
| **WAF** | Default allow — manage access via AWS Console |

### Knowledge Base Sync

After uploading documents to the Documents bucket, sync the Knowledge Base to index them:

```bash
cd /home/ubuntu/AWSClaude
chmod +x scripts/sync-knowledge-base.sh
./scripts/sync-knowledge-base.sh EYOS38B1QP FBMDB4ZGS3
```

To seed sample data and trigger a sync:

```bash
chmod +x scripts/seed-data.sh
./scripts/seed-data.sh EYOS38B1QP FBMDB4ZGS3
```

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

## Redeployment Instructions

If you need to redeploy or update the stack:

### Redeploy CDK stack

```bash
cd /home/ubuntu/AWSClaude/cdk
cdk deploy RagToolStack --require-approval never \
  -c knowledgeBaseId=EYOS38B1QP \
  -c dataSourceId=FBMDB4ZGS3
```

### Rebuild and deploy frontend

```bash
cd /home/ubuntu/frontend
npm run build
aws s3 sync dist/ "s3://023530626172-rag-frontend/" --delete
aws cloudfront create-invalidation --distribution-id E25VNHJIPOOYU --paths "/*"
```

### Sync Knowledge Base (after uploading documents)

```bash
cd /home/ubuntu/AWSClaude
./scripts/sync-knowledge-base.sh EYOS38B1QP FBMDB4ZGS3
```

### Seed sample data (optional)

```bash
cd /home/ubuntu/AWSClaude
./scripts/seed-data.sh EYOS38B1QP FBMDB4ZGS3
```

### WAF IP management

WAF is set to allow all IPs by default. To restrict access, edit IP allowlists in `cdk/lib/config.ts` (`ALLOWED_IPS` for IPv4, `ALLOWED_IPS_V6` for IPv6) and change the WAF default action back to `block` in `cdk/lib/rag-stack.ts`, then redeploy.

### Fresh deployment (new AWS account)

1. Enable Bedrock model access in us-east-1 (Titan Embed V2, Claude 3.5 Haiku, Claude Sonnet 4)
2. Install CDK: `npm install -g aws-cdk`
3. Build Lambda layer: `cd backend && mkdir -p layers/dependencies/python && pip install -r requirements.txt -t layers/dependencies/python/`
4. Bootstrap and deploy: `cd cdk && npm install && cdk bootstrap && cdk deploy RagToolStack --require-approval never`
5. Create Bedrock Knowledge Base (name: `rag-tool-kb`, embedding: Titan V2, vector store: OpenSearch Serverless, data source: S3 documents bucket, chunking: 512 tokens / 20% overlap)
6. Redeploy with KB IDs: `cdk deploy RagToolStack --require-approval never -c knowledgeBaseId=<KB_ID> -c dataSourceId=<DS_ID>`
7. Build and deploy frontend to the S3 frontend bucket
8. Verify all three workflows at the CloudFront URL

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

# RAG Document Tool - AWS-Powered Document Search, Generation & Audit

Fully AWS-hosted tool for searching, generating, and auditing documents using Retrieval Augmented Generation (RAG). Uses Amazon Bedrock Knowledge Bases, Lambda, API Gateway, CloudFront, and WAF.

---

## What This Tool Does

1. **Search & Generate** — Upload a document or type text. The tool finds relevant reference documents in S3 using vector search, shows you the matches with relevant passages, then generates a new draft matching the style of the references.
2. **File Manager** — Browse, upload, and delete documents in S3 organized by category folders. New uploads are automatically indexed for search.
3. **Document Audit** — Upload a document and a criteria reference file. The tool extracts every requirement from the reference and evaluates your document against each one.

---

## Architecture

```
User (Allowed IP) → WAF → CloudFront → S3 (React frontend)
                                      → API Gateway → Lambda → S3 (documents)
                                                             → Bedrock KB (RAG search)
                                                             → Bedrock LLM (Claude)
```

| Service | Role | ~Cost/month |
|---------|------|-------------|
| S3 | Document storage + frontend hosting | $2-8 |
| CloudFront + WAF | CDN, HTTPS, IP restriction | $7-8 |
| API Gateway v2 | HTTP API routing | <$1 |
| Lambda (Python 3.12) | Backend compute | $1-5 |
| Bedrock KB + S3 Vectors | Managed RAG pipeline | $1-5 |
| Bedrock Titan Embed V2 | Text embeddings | <$1 |
| Bedrock Claude Haiku | Draft generation | $5-15 |
| Bedrock Claude Sonnet | Document audit | $2-10 |
| **Total** | | **~$20-50** |

---

## Prerequisites

Install these on the machine where you will run deployment commands:

1. **Node.js 18+** — https://nodejs.org/ (verify: `node --version`)
2. **Python 3.12+** — https://python.org/ (verify: `python3 --version`)
3. **AWS CLI v2** — https://aws.amazon.com/cli/ (verify: `aws --version`)
4. **AWS CDK CLI** — `npm install -g aws-cdk` (verify: `cdk --version`)
5. **AWS account** with an IAM user that has:
   - AdministratorAccess (for CDK deployment)
   - `aws-marketplace:Subscribe` permission (for Bedrock model auto-subscription)

Configure credentials: `aws configure` → enter Access Key, Secret Key, region `us-east-1`, output `json`

---

## Setup Instructions (Complete Deployment Guide)

### Step 1: Complete the Anthropic First-Time-Use Form

Bedrock models are enabled by default in commercial regions. Amazon Titan models work immediately. **Anthropic Claude models require a one-time use case form** per account.

1. Sign in to **AWS Console** → region **us-east-1 (N. Virginia)**
2. Go to **Amazon Bedrock** → **Model catalog** (left sidebar)
3. Click on any **Anthropic Claude** model (e.g., Claude 3.5 Haiku)
4. You'll be prompted to fill out a First Time Use form:
   - Company name, website, intended users, industry, use case description
   - Example use case: "Internal document search and generation tool"
5. Submit. **Access is granted immediately.**
6. If you are NOT prompted, your account already has access. Verify by running a test in **Bedrock > Playground**.

### Step 2: Configure Your IP Address

1. Go to https://whatismyip.com and note your **IPv4 address**
2. Edit `cdk/lib/config.ts`, find `ALLOWED_IPS`, replace the placeholder:
   ```typescript
   export const ALLOWED_IPS: string[] = [
     '203.0.113.45/32',  // Your actual IP here
   ];
   ```

### Step 3: Build the Lambda Layer

```bash
cd backend
mkdir -p layers/dependencies/python
pip install -r requirements.txt -t layers/dependencies/python/
```

This installs `pypdf` and `python-docx` into the Lambda layer directory. (boto3 is already in the Lambda runtime.)

### Step 4: Install CDK Dependencies

```bash
cd cdk
npm install
```

### Step 5: Bootstrap CDK (First Time Only)

```bash
cdk bootstrap
```

### Step 6: Deploy Core Infrastructure (First Pass — Without KB)

```bash
cdk deploy RagToolStack --require-approval broadening
```

Type **y** when prompted to approve IAM changes. Takes 5-10 minutes.

**Save the output values:**
- `DistributionUrl` — your application URL
- `DocumentsBucketName` — where documents go
- `FrontendBucketName` — where the frontend goes
- `DistributionId` — for cache invalidation

Retrieve them anytime: `aws cloudformation describe-stacks --stack-name RagToolStack --query "Stacks[0].Outputs" --output table`

### Step 7: Create S3 Category Folders

Replace `BUCKET` with your `DocumentsBucketName`:

```bash
aws s3api put-object --bucket BUCKET --key "tech-approach/" --content-length 0
aws s3api put-object --bucket BUCKET --key "organizational-approach/" --content-length 0
aws s3api put-object --bucket BUCKET --key "past-performance/" --content-length 0
aws s3api put-object --bucket BUCKET --key "resumes/" --content-length 0
```

### Step 8: Upload Your Documents

```bash
aws s3 cp your-tech-proposal.pdf s3://BUCKET/tech-approach/
aws s3 cp your-resume.pdf s3://BUCKET/resumes/
# Or upload a whole folder:
aws s3 sync ./my-docs/ s3://BUCKET/tech-approach/
```

### Step 9: Create Bedrock Knowledge Base (AWS Console)

1. **Bedrock** → **Knowledge bases** (left sidebar, under Orchestration) → **Create**
2. Select **"Create a knowledge base with a vector store"**
3. **KB details:** Name: `rag-tool-kb`, let Bedrock create a new IAM role → **Next**
4. **Data source:** Type: **Amazon S3**, browse and select your documents bucket → **Next**
5. **Embeddings model:** Select **Titan Text Embeddings V2**, dimensions 1024 → **Next**
6. **Vector database:** Select **Quick create a new vector store** → **Amazon S3 Vectors** → **Next**
7. **Review** → **Create knowledge base**. Wait for status: **Ready** (1-3 min)
8. **Record the Knowledge Base ID** (top of KB detail page, e.g., `ABCDEFGHIJ`)
9. **Record the Data Source ID** (in Data sources section, e.g., `XXXXXXXXXX`)

### Step 10: Sync the Knowledge Base

On the KB detail page → Data source section → select your data source → click **Sync**. Wait for the green success banner.

Or via CLI:
```bash
aws bedrock-agent start-ingestion-job --knowledge-base-id YOUR_KB_ID --data-source-id YOUR_DS_ID
```

### Step 11: Redeploy CDK with Knowledge Base IDs

Now redeploy with the KB and DS IDs so Lambda functions can access the Knowledge Base:

```bash
cd cdk
cdk deploy RagToolStack -c knowledgeBaseId=YOUR_KB_ID -c dataSourceId=YOUR_DS_ID --require-approval broadening
```

### Step 12: Build and Deploy Frontend

```bash
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://YOUR_FRONTEND_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Step 13: Test the Application

Open your `DistributionUrl` in a browser (from an allowed IP).

1. **File Manager tab** — verify your uploaded documents appear
2. **Search & Generate tab** — enter a query, select a category, click Search
3. **Audit tab** — upload two files and run an audit

---

## Adding New Categories

1. Edit `cdk/lib/config.ts` — add entry to CATEGORIES array
2. Redeploy: `cd cdk && cdk deploy RagToolStack -c knowledgeBaseId=X -c dataSourceId=Y`
3. Create S3 folder: `aws s3api put-object --bucket BUCKET --key "new-category/" --content-length 0`
4. Upload documents and sync KB
5. Rebuild frontend: `cd frontend && npm run build && aws s3 sync dist/ s3://FRONTEND_BUCKET/ --delete`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 403 Forbidden | Your IP isn't in the WAF allowlist. Update `ALLOWED_IPS` in config.ts, redeploy. |
| Search returns nothing | KB not synced. Go to Bedrock > KB > Sync. Wait a few minutes after sync completes. |
| Lambda timeout | Audit timeout is 180s. For very large docs, increase in rag-stack.ts and redeploy. |
| Model errors | Complete the Anthropic First Time Use form (Step 1). Verify in Bedrock Playground. |
| Frontend stale | Invalidate CloudFront: `aws cloudfront create-invalidation --distribution-id ID --paths "/*"` |
| Module not found in Lambda | Lambda layer not built. Run Step 3 again, then redeploy CDK. |

---

## Security

- **IP restriction**: WAF blocks all traffic except allowed CIDRs
- **No public S3**: All buckets use BlockPublicAccess; frontend via CloudFront OAC
- **Encryption**: SSE-S3 on all buckets
- **IAM least privilege**: Lambda roles have only required permissions
- **HTTPS only**: CloudFront enforces HTTPS
- **Origin verification**: Custom header prevents bypassing WAF via direct API Gateway access

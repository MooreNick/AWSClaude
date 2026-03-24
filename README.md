# RAG Document Tool - AWS-Powered Document Search, Generation & Audit

Fully AWS-hosted tool for searching, generating, and auditing documents using Retrieval Augmented Generation (RAG). Uses Amazon Bedrock Knowledge Bases, Lambda, API Gateway, CloudFront, and WAF.

**You do NOT need admin rights on your computer.** The entire setup runs in AWS CloudShell (a free browser-based terminal inside the AWS Console that already has Node.js, Python, AWS CLI, and CDK pre-installed).

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

- An **AWS account** you can log into at https://console.aws.amazon.com/
- Your IAM user must have **AdministratorAccess** and **AWSMarketplaceFullAccess** policies attached
- That's it. **No local software installation needed.** Everything runs in AWS CloudShell.

---

## Setup Instructions

**All commands in this guide are run inside AWS CloudShell** (a free browser terminal in the AWS Console). See Step 1 below to open it.

For the most detailed step-by-step instructions with inputs, outputs, and troubleshooting for every step, see **setup-steps.csv**.

---

### Step 1: Open AWS CloudShell

1. Sign in to **AWS Console** at https://console.aws.amazon.com/
2. Set region to **us-east-1** (top-right dropdown → US East N. Virginia)
3. Click the **CloudShell icon** (looks like a terminal `>_` in the top navigation bar, near the search bar)
4. Wait for the terminal to initialize (first time takes ~30 seconds)

CloudShell comes with Node.js, Python, AWS CLI, git, and CDK already installed.

### Step 2: Complete the Anthropic First-Time-Use Form

1. Go to **Amazon Bedrock** → **Model catalog** (left sidebar)
2. Click on any **Anthropic Claude** model (e.g., Claude 3.5 Haiku)
3. Fill out the First Time Use form and submit
4. Access is granted immediately

### Step 3: Clone the Repository into CloudShell

```bash
git clone https://github.com/MooreNick/AWSClaude.git
cd AWSClaude
```

### Step 4: Configure Your IP Address

Find your IP at https://whatismyip.com, then edit the config:

```bash
nano cdk/lib/config.ts
```

Find the `ALLOWED_IPS` array and replace `0.0.0.0/32` with your IP (e.g., `203.0.113.45/32`). Press Ctrl+O to save, Ctrl+X to exit.

### Step 5: Build Lambda Layer and Install CDK Dependencies

```bash
cd backend
mkdir -p layers/dependencies/python
pip install -r requirements.txt -t layers/dependencies/python/
cd ../cdk
npm install
```

### Step 6: Bootstrap and Deploy Infrastructure (First Pass)

```bash
cdk bootstrap
cdk deploy RagToolStack --require-approval broadening
```

Type **y** when prompted. Save the output values (DistributionUrl, DocumentsBucketName, FrontendBucketName, DistributionId).

### Step 7: Create S3 Folders and Upload Documents

```bash
# Replace BUCKET with your DocumentsBucketName from Step 6
aws s3api put-object --bucket BUCKET --key "tech-approach/" --content-length 0
aws s3api put-object --bucket BUCKET --key "organizational-approach/" --content-length 0
aws s3api put-object --bucket BUCKET --key "past-performance/" --content-length 0
aws s3api put-object --bucket BUCKET --key "resumes/" --content-length 0
```

Upload documents from your local machine to CloudShell using the **Actions → Upload file** button in the CloudShell toolbar, then:

```bash
aws s3 cp uploaded-file.pdf s3://BUCKET/tech-approach/
```

### Step 8: Create Bedrock Knowledge Base (Console Wizard)

1. **Bedrock** → **Knowledge bases** → **Create** → **Create a knowledge base with a vector store**
2. Name: `rag-tool-kb`, let Bedrock create IAM role → **Next**
3. Data source: **Amazon S3**, select your documents bucket → **Next**
4. Embeddings: **Titan Text Embeddings V2**, dimensions 1024 → **Next**
5. Vector store: **Quick create** → **Amazon S3 Vectors** → **Next**
6. **Create knowledge base**. Wait for Ready status.
7. Copy the **Knowledge Base ID** and **Data Source ID**

### Step 9: Sync the Knowledge Base

On the KB detail page → Data source → **Sync**. Wait for green banner.

### Step 10: Redeploy with Knowledge Base IDs

Back in CloudShell:

```bash
cd ~/AWSClaude/cdk
cdk deploy RagToolStack -c knowledgeBaseId=YOUR_KB_ID -c dataSourceId=YOUR_DS_ID --require-approval broadening
```

### Step 11: Build and Deploy Frontend

```bash
cd ~/AWSClaude/frontend
npm install
npm run build
aws s3 sync dist/ s3://YOUR_FRONTEND_BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Step 12: Access the Application

Open your `DistributionUrl` in a browser from an allowed IP address.

---

## Adding New Categories

1. In CloudShell: `nano ~/AWSClaude/cdk/lib/config.ts` — add entry to CATEGORIES
2. `cd ~/AWSClaude/cdk && cdk deploy RagToolStack -c knowledgeBaseId=X -c dataSourceId=Y`
3. Create S3 folder, upload docs, sync KB
4. Rebuild frontend: `cd ~/AWSClaude/frontend && npm run build && aws s3 sync dist/ s3://FRONTEND_BUCKET/ --delete`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 403 Forbidden | Your IP isn't allowed. Update ALLOWED_IPS in config.ts, redeploy. |
| Search returns nothing | KB not synced. Bedrock > KB > Sync. Wait 2-3 min. |
| CloudShell session expired | CloudShell preserves files in ~/. Just `cd ~/AWSClaude` and continue. |
| CloudShell storage full | CloudShell has 1GB storage. Delete node_modules and reinstall if needed. |
| Lambda timeout | Increase timeout in rag-stack.ts and redeploy. |
| Model errors | Complete Anthropic First Time Use form. Test in Bedrock Playground. |

---

## Security

- **IP restriction**: WAF blocks all traffic except allowed CIDRs
- **No public S3**: All buckets use BlockPublicAccess
- **Encryption**: SSE-S3 on all buckets
- **IAM least privilege**: Lambda roles have only required permissions
- **HTTPS only**: CloudFront enforces HTTPS
- **Origin verification**: Custom header prevents bypassing WAF

#!/usr/bin/env node
// app.ts - CDK application entry point
// Instantiates all stacks and wires them together

// Import the CDK core library
import * as cdk from 'aws-cdk-lib';
// Import our main infrastructure stack (S3, Lambda, API GW, CloudFront, WAF)
import { RagStack } from '../lib/rag-stack';
// Import our Bedrock-specific stack (Knowledge Base, Data Source)
import { BedrockStack } from '../lib/bedrock-stack';
// Import configuration for the deployment region
import { AWS_REGION } from '../lib/config';

// Create the CDK application instance
const app = new cdk.App();

// Define the AWS environment (account and region) for deployment
// The account is resolved from the current AWS CLI credentials at deploy time
const env: cdk.Environment = {
  // Use the account from AWS CLI credentials or CDK_DEFAULT_ACCOUNT env var
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // Use our configured region (us-east-1)
  region: AWS_REGION,
};

// ============================================================================
// STACK 1: RagStack - Core infrastructure
// Creates S3 buckets, Lambda functions, API Gateway, CloudFront, and WAF
// ============================================================================
const ragStack = new RagStack(app, 'RagToolStack', {
  // Deploy to our configured environment
  env,
  // Description shown in the CloudFormation console
  description: 'RAG Tool - Core infrastructure (S3, Lambda, API GW, CloudFront, WAF)',
});

// ============================================================================
// STACK 2: BedrockStack - AI/ML infrastructure
// Creates Bedrock Knowledge Base and S3 Data Source
// Depends on RagStack because it needs the documents S3 bucket
// ============================================================================
const bedrockStack = new BedrockStack(app, 'RagToolBedrockStack', {
  // Deploy to the same environment
  env,
  // Description shown in the CloudFormation console
  description: 'RAG Tool - Bedrock Knowledge Base and Data Source',
  // Pass the documents bucket from the main stack
  documentsBucket: ragStack.documentsBucket,
});

// Ensure BedrockStack deploys after RagStack (it depends on the S3 bucket)
bedrockStack.addDependency(ragStack);

// Synthesize the CloudFormation templates
app.synth();

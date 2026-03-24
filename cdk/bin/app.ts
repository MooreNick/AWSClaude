#!/usr/bin/env node
// app.ts - CDK application entry point
// Deploys the single RagToolStack containing all infrastructure
// Bedrock Knowledge Base is created via the AWS Console (not CDK)

// Import the CDK core library
import * as cdk from 'aws-cdk-lib';
// Import the main infrastructure stack
import { RagStack } from '../lib/rag-stack';
// Import configuration for the deployment region
import { AWS_REGION } from '../lib/config';

// Create the CDK application instance
const app = new cdk.App();

// Define the AWS environment for deployment
const env: cdk.Environment = {
  // Resolved from AWS CLI credentials at deploy time
  account: process.env.CDK_DEFAULT_ACCOUNT,
  // Deploy to us-east-1 for Bedrock model availability
  region: AWS_REGION,
};

// Deploy the single stack containing all infrastructure:
// S3 buckets, Lambda functions, API Gateway, CloudFront, WAF
// Pass knowledgeBaseId and dataSourceId via CDK context:
//   cdk deploy -c knowledgeBaseId=XXXXX -c dataSourceId=XXXXX
const ragStack = new RagStack(app, 'RagToolStack', {
  env,
  description: 'RAG Tool - S3, Lambda, API Gateway, CloudFront, WAF',
});

// Synthesize the CloudFormation template
app.synth();

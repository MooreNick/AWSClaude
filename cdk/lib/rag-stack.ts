// rag-stack.ts - Main CDK stack defining all AWS infrastructure
// Creates: S3 buckets, CloudFront, WAF, API Gateway, Lambda functions, IAM roles
// Bedrock Knowledge Base is created via AWS Console, IDs passed via CDK context

// Import AWS CDK core library for stack and construct definitions
import * as cdk from 'aws-cdk-lib';
// Import the Constructs library for the base Construct class
import { Construct } from 'constructs';
// Import S3 module for creating storage buckets
import * as s3 from 'aws-cdk-lib/aws-s3';
// Import Lambda module for serverless function definitions
import * as lambda from 'aws-cdk-lib/aws-lambda';
// Import API Gateway v2 (HTTP API) for REST endpoint routing
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
// Import API Gateway v2 Lambda integration for connecting routes to Lambda
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
// Import CloudFront for CDN and frontend hosting
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
// Import CloudFront origins for S3 and HTTP origins
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// Import WAFv2 for IP-based access control
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
// Import IAM for role and policy definitions
import * as iam from 'aws-cdk-lib/aws-iam';
// Import path module for resolving file paths to Lambda code
import * as path from 'path';
// Import our central configuration values
import {
  ALLOWED_IPS,
  RESOURCE_NAMES,
  AWS_REGION,
  BEDROCK_MODELS,
} from './config';

// Main infrastructure stack containing all resources
export class RagStack extends cdk.Stack {
  // Expose the documents bucket for reference
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // Call the parent Stack constructor
    super(scope, id, props);

    // ========================================================================
    // CDK CONTEXT PARAMETERS - Passed at deploy time via -c flags
    // These come from the Bedrock Knowledge Base created in the AWS Console
    // Deploy: cdk deploy -c knowledgeBaseId=XXXXX -c dataSourceId=XXXXX
    // ========================================================================
    const knowledgeBaseId = this.node.tryGetContext('knowledgeBaseId') || '';
    const dataSourceId = this.node.tryGetContext('dataSourceId') || '';

    // ========================================================================
    // S3 BUCKET - Document Storage
    // Stores all RAG reference documents organized by category prefix folders
    // ========================================================================
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      // Unique bucket name using account ID
      bucketName: `${this.account}-${RESOURCE_NAMES.documentsBucketSuffix}`,
      // Block all public access for security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Enable server-side encryption with S3-managed keys
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Enable versioning to protect against accidental overwrites
      versioned: true,
      // Allow CDK to delete the bucket on stack destroy (dev convenience)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // Auto-delete objects when bucket is removed
      autoDeleteObjects: true,
      // Enable CORS for frontend file uploads
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // ========================================================================
    // S3 BUCKET - Frontend Static Assets
    // Hosts the built React application (HTML, JS, CSS)
    // ========================================================================
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${this.account}-${RESOURCE_NAMES.frontendBucketSuffix}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ========================================================================
    // IAM ROLE - Lambda Execution Role
    // Grants Lambda functions access to S3, Bedrock, and CloudWatch Logs
    // ========================================================================
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for RAG tool Lambda functions',
      managedPolicies: [
        // Basic Lambda execution for CloudWatch Logs
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // S3 read/write access on the documents bucket
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:ListBucket',
          's3:DeleteObject',
          's3:GetBucketLocation',
        ],
        resources: [
          this.documentsBucket.bucketArn,
          `${this.documentsBucket.bucketArn}/*`,
        ],
      })
    );

    // Bedrock model invocation permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.embedding}`,
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.generation}`,
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.audit}`,
        ],
      })
    );

    // Bedrock Knowledge Base retrieval permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:Retrieve',
          'bedrock:RetrieveAndGenerate',
        ],
        resources: [`arn:aws:bedrock:${AWS_REGION}:${this.account}:knowledge-base/*`],
      })
    );

    // Bedrock Knowledge Base ingestion sync permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:StartIngestionJob',
          'bedrock:GetIngestionJob',
          'bedrock:ListIngestionJobs',
        ],
        resources: [`arn:aws:bedrock:${AWS_REGION}:${this.account}:knowledge-base/*`],
      })
    );

    // ========================================================================
    // LAMBDA LAYER - Shared Python Dependencies
    // Built from backend/requirements.txt during deployment
    // Must run: cd backend && mkdir -p layers/dependencies/python && pip install -r requirements.txt -t layers/dependencies/python/
    // ========================================================================
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      // Path to pre-built layer directory (created by deploy.sh or manual pip install)
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/layers/dependencies')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Python dependencies: pypdf, python-docx',
    });

    // ========================================================================
    // ENVIRONMENT VARIABLES - Shared across all Lambda functions
    // ========================================================================
    const lambdaEnvironment: Record<string, string> = {
      // S3 bucket name for document storage
      DOCUMENTS_BUCKET: this.documentsBucket.bucketName,
      // AWS region for Bedrock API calls
      AWS_BEDROCK_REGION: AWS_REGION,
      // Knowledge Base ID from CDK context (created via console)
      KNOWLEDGE_BASE_ID: knowledgeBaseId,
      // Data Source ID from CDK context (created via console)
      DATA_SOURCE_ID: dataSourceId,
    };

    // ========================================================================
    // LAMBDA FUNCTIONS - One per API endpoint
    // ========================================================================

    // Helper function to create a Lambda with consistent configuration
    const createLambda = (name: string, handler: string, timeout: number = 30): lambda.Function => {
      return new lambda.Function(this, name, {
        runtime: lambda.Runtime.PYTHON_3_12,
        // Package the entire backend directory as the Lambda code
        code: lambda.Code.fromAsset(path.join(__dirname, '../../backend')),
        // Handler format: directory.file.function
        handler: handler,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(timeout),
        memorySize: 512,
        layers: [dependenciesLayer],
        environment: lambdaEnvironment,
        description: `RAG Tool - ${name}`,
      });
    };

    // POST /api/search - RAG retrieval against Knowledge Base
    const searchFn = createLambda('SearchFunction', 'handlers.search.handler', 60);
    // POST /api/generate - Draft document generation using Claude
    const generateFn = createLambda('GenerateFunction', 'handlers.generate.handler', 120);
    // POST /api/upload - File upload to S3 + KB sync trigger
    const uploadFn = createLambda('UploadFunction', 'handlers.upload.handler', 60);
    // GET/DELETE /api/files - List and delete files in S3
    const filesFn = createLambda('FilesFunction', 'handlers.files.handler', 30);
    // POST /api/audit - Document audit comparison using Claude Sonnet
    const auditFn = createLambda('AuditFunction', 'handlers.audit.handler', 180);
    // GET /api/categories - Return available categories and tone options
    const categoriesFn = createLambda('CategoriesFunction', 'handlers.categories.handler', 10);

    // ========================================================================
    // API GATEWAY - HTTP API (v2)
    // ========================================================================
    const httpApi = new apigwv2.HttpApi(this, 'RagToolApi', {
      apiName: 'rag-tool-api',
      description: 'RAG Tool API - Routes requests to Lambda handlers',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['*'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Route definitions - connect URL paths to Lambda functions
    httpApi.addRoutes({
      path: '/api/search',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('SearchIntegration', searchFn),
    });
    httpApi.addRoutes({
      path: '/api/generate',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('GenerateIntegration', generateFn),
    });
    httpApi.addRoutes({
      path: '/api/upload',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('UploadIntegration', uploadFn),
    });
    httpApi.addRoutes({
      path: '/api/files',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration('FilesIntegration', filesFn),
    });
    httpApi.addRoutes({
      path: '/api/files',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new apigwv2Integrations.HttpLambdaIntegration('FilesDeleteIntegration', filesFn),
    });
    httpApi.addRoutes({
      path: '/api/audit',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('AuditIntegration', auditFn),
    });
    httpApi.addRoutes({
      path: '/api/categories',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration('CategoriesIntegration', categoriesFn),
    });

    // ========================================================================
    // WAF - IP-based access restriction
    // ========================================================================

    // IP Set with allowed addresses
    const ipSet = new wafv2.CfnIPSet(this, 'AllowedIpSet', {
      name: 'rag-tool-allowed-ips',
      scope: 'CLOUDFRONT',
      ipAddressVersion: 'IPV4',
      addresses: ALLOWED_IPS,
      description: 'IP addresses allowed to access the RAG tool',
    });

    // Web ACL: default BLOCK, allow only listed IPs
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: RESOURCE_NAMES.wafAclName,
      scope: 'CLOUDFRONT',
      defaultAction: { block: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'rag-tool-waf',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'allow-listed-ips',
          priority: 0,
          action: { allow: {} },
          statement: {
            ipSetReferenceStatement: {
              arn: ipSet.attrArn,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'rag-tool-allowed-ips',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // ========================================================================
    // CLOUDFRONT - CDN serving frontend and proxying API calls
    // ========================================================================

    // Origin Access Control for secure S3 access
    const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC', {
      description: 'OAC for RAG tool frontend bucket',
    });

    // Parse API Gateway URL to get the domain name for the HTTP origin
    const apiDomainName = cdk.Fn.select(2, cdk.Fn.split('/', httpApi.apiEndpoint));

    // Create the CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'RAG Tool - Frontend and API distribution',
      // Default: serve React SPA from S3
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
          originAccessControl: oac,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // /api/* routes proxy to API Gateway
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomainName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            customHeaders: {
              [RESOURCE_NAMES.originVerifyHeader]: RESOURCE_NAMES.originVerifySecret,
            },
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      // SPA routing: return index.html for 403/404 so React Router handles it
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      // Attach WAF for IP restriction
      webAclId: webAcl.attrArn,
    });

    // ========================================================================
    // STACK OUTPUTS - Values needed after deployment
    // ========================================================================

    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Application URL (open in browser from an allowed IP)',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend deployment',
    });

    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      description: 'S3 bucket for document storage',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway endpoint URL',
    });
  }
}

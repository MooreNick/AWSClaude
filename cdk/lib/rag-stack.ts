// rag-stack.ts - Main CDK stack defining all core AWS infrastructure
// Creates: S3 buckets, CloudFront, WAF, API Gateway, Lambda functions, IAM roles

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
  CATEGORIES,
  ALLOWED_IPS,
  RESOURCE_NAMES,
  AWS_REGION,
  BEDROCK_MODELS,
  DOCUMENT_PROCESSING,
  TONE_OPTIONS,
} from './config';

// Main infrastructure stack containing all non-Bedrock resources
export class RagStack extends cdk.Stack {
  // Expose the documents bucket so the Bedrock stack can reference it
  public readonly documentsBucket: s3.Bucket;
  // Expose the API URL so the frontend can be configured to call it
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // Call the parent Stack constructor with the provided scope, id, and props
    super(scope, id, props);

    // ========================================================================
    // S3 BUCKET - Document Storage
    // Stores all RAG reference documents organized by category prefix folders
    // ========================================================================
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      // Auto-generate a unique bucket name using the stack name
      bucketName: `${this.account}-${RESOURCE_NAMES.documentsBucketSuffix}`,
      // Block all public access for security
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Enable server-side encryption with S3-managed keys
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Enable versioning to protect against accidental overwrites
      versioned: true,
      // Allow CDK to delete the bucket when the stack is destroyed (dev convenience)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // Auto-delete objects when bucket is removed (dev convenience)
      autoDeleteObjects: true,
      // Enable CORS so the frontend can upload files directly
      cors: [
        {
          // Allow GET and PUT from any origin (CloudFront will restrict access)
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          // Allow requests from any origin (WAF handles IP restriction)
          allowedOrigins: ['*'],
          // Allow common headers needed for file uploads
          allowedHeaders: ['*'],
        },
      ],
    });

    // ========================================================================
    // S3 BUCKET - Frontend Static Assets
    // Hosts the built React application (HTML, JS, CSS)
    // ========================================================================
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      // Auto-generate a unique bucket name for the frontend
      bucketName: `${this.account}-${RESOURCE_NAMES.frontendBucketSuffix}`,
      // Block all public access - CloudFront OAC will be the only accessor
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // Enable encryption for the frontend assets
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Allow cleanup on stack deletion
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // Auto-delete objects when bucket is removed
      autoDeleteObjects: true,
    });

    // ========================================================================
    // IAM ROLE - Lambda Execution Role
    // Grants Lambda functions access to S3, Bedrock, and CloudWatch Logs
    // ========================================================================
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      // Allow the Lambda service to assume this role
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      // Descriptive name for the role
      description: 'Execution role for RAG tool Lambda functions',
      // Attach the basic Lambda execution policy for CloudWatch Logs
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant Lambda read/write access to the documents S3 bucket
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        // Allow all S3 operations needed for file management
        actions: [
          's3:GetObject',      // Read document contents
          's3:PutObject',      // Upload new documents
          's3:ListBucket',     // List files in category folders
          's3:DeleteObject',   // Remove documents if needed
          's3:GetBucketLocation', // Required for some SDK operations
        ],
        // Restrict to only our documents bucket and its contents
        resources: [
          this.documentsBucket.bucketArn,              // Bucket-level operations (ListBucket)
          `${this.documentsBucket.bucketArn}/*`,       // Object-level operations (Get/Put/Delete)
        ],
      })
    );

    // Grant Lambda permission to invoke Bedrock models for embeddings and LLM
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        // Allow invoking Bedrock models for generation and embeddings
        actions: [
          'bedrock:InvokeModel',          // Call LLM and embedding models
          'bedrock:InvokeModelWithResponseStream', // Stream LLM responses
        ],
        // Allow access to the specific models we use
        resources: [
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.embedding}`,
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.generation}`,
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.audit}`,
        ],
      })
    );

    // Grant Lambda permission to use Bedrock Knowledge Base for RAG retrieval
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        // Allow querying the Knowledge Base
        actions: [
          'bedrock:Retrieve',                    // Retrieve relevant document chunks
          'bedrock:RetrieveAndGenerate',          // Combined retrieve + LLM generation
        ],
        // Allow access to any Knowledge Base in this account/region
        resources: [`arn:aws:bedrock:${AWS_REGION}:${this.account}:knowledge-base/*`],
      })
    );

    // Grant Lambda permission to trigger Knowledge Base sync after uploads
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        // Allow starting ingestion jobs to sync new documents
        actions: [
          'bedrock:StartIngestionJob',     // Trigger document processing
          'bedrock:GetIngestionJob',        // Check sync status
          'bedrock:ListIngestionJobs',      // List recent sync jobs
        ],
        // Allow access to any Knowledge Base in this account/region
        resources: [`arn:aws:bedrock:${AWS_REGION}:${this.account}:knowledge-base/*`],
      })
    );

    // ========================================================================
    // LAMBDA LAYER - Shared Python Dependencies
    // Contains third-party libraries (pypdf, python-docx) used by all handlers
    // ========================================================================
    const dependenciesLayer = new lambda.LayerVersion(this, 'DependenciesLayer', {
      // Path to the layer code (dependencies are installed here during build)
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/layers/dependencies')),
      // Use Python 3.12 runtime for compatibility
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      // Description for identification in the AWS console
      description: 'Shared Python dependencies: pypdf, python-docx, etc.',
    });

    // ========================================================================
    // ENVIRONMENT VARIABLES - Shared across all Lambda functions
    // ========================================================================
    const lambdaEnvironment: Record<string, string> = {
      // S3 bucket name for document storage
      DOCUMENTS_BUCKET: this.documentsBucket.bucketName,
      // AWS region for Bedrock API calls
      AWS_BEDROCK_REGION: AWS_REGION,
      // Bedrock model IDs serialized as JSON for the backend to parse
      BEDROCK_MODELS: JSON.stringify(BEDROCK_MODELS),
      // Categories serialized as JSON for the backend to parse
      CATEGORIES: JSON.stringify(CATEGORIES),
      // Tone options serialized as JSON for the backend to parse
      TONE_OPTIONS: JSON.stringify(TONE_OPTIONS),
      // Document processing config serialized as JSON
      DOCUMENT_PROCESSING: JSON.stringify(DOCUMENT_PROCESSING),
      // Knowledge Base ID will be set after Bedrock stack creates it
      KNOWLEDGE_BASE_ID: '', // Updated via BedrockStack output
    };

    // ========================================================================
    // LAMBDA FUNCTIONS - One per API endpoint for clarity and independent scaling
    // ========================================================================

    // Helper function to create a Lambda with consistent configuration
    const createLambda = (name: string, handler: string, timeout: number = 30): lambda.Function => {
      return new lambda.Function(this, name, {
        // Use Python 3.12 runtime
        runtime: lambda.Runtime.PYTHON_3_12,
        // Path to the backend code directory
        code: lambda.Code.fromAsset(path.join(__dirname, '../../backend')),
        // Handler path: handlers/<file>.<function>
        handler: handler,
        // Use the shared execution role with S3 and Bedrock permissions
        role: lambdaRole,
        // Set timeout (longer for search/generate/audit which call Bedrock)
        timeout: cdk.Duration.seconds(timeout),
        // Allocate memory (more memory = more CPU = faster execution)
        memorySize: 512,
        // Attach the shared dependencies layer
        layers: [dependenciesLayer],
        // Pass shared environment variables
        environment: lambdaEnvironment,
        // Description for identification in AWS console
        description: `RAG Tool - ${name}`,
      });
    };

    // Lambda for POST /api/search - Performs RAG retrieval against Knowledge Base
    const searchFn = createLambda('SearchFunction', 'handlers.search.handler', 60);
    // Lambda for POST /api/generate - Generates draft documents using Claude
    const generateFn = createLambda('GenerateFunction', 'handlers.generate.handler', 120);
    // Lambda for POST /api/upload - Handles file upload to S3 and triggers KB sync
    const uploadFn = createLambda('UploadFunction', 'handlers.upload.handler', 60);
    // Lambda for GET /api/files - Lists files in S3 by category
    const filesFn = createLambda('FilesFunction', 'handlers.files.handler', 30);
    // Lambda for POST /api/audit - Performs document audit comparison
    const auditFn = createLambda('AuditFunction', 'handlers.audit.handler', 180);
    // Lambda for GET /api/categories - Returns available categories and tones
    const categoriesFn = createLambda('CategoriesFunction', 'handlers.categories.handler', 10);

    // ========================================================================
    // API GATEWAY - HTTP API (v2) for routing requests to Lambda functions
    // ========================================================================
    const httpApi = new apigwv2.HttpApi(this, 'RagToolApi', {
      // Name displayed in the API Gateway console
      apiName: 'rag-tool-api',
      // Description for documentation
      description: 'RAG Tool API - Routes requests to Lambda handlers',
      // Enable CORS for frontend communication
      corsPreflight: {
        // Allow requests from any origin (WAF handles IP restriction at CloudFront)
        allowOrigins: ['*'],
        // Allow standard HTTP methods
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        // Allow all headers
        allowHeaders: ['*'],
        // Cache preflight response for 1 hour
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Route: POST /api/search - Search for relevant documents
    httpApi.addRoutes({
      path: '/api/search',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('SearchIntegration', searchFn),
    });

    // Route: POST /api/generate - Generate draft document from approved results
    httpApi.addRoutes({
      path: '/api/generate',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('GenerateIntegration', generateFn),
    });

    // Route: POST /api/upload - Upload a document to S3
    httpApi.addRoutes({
      path: '/api/upload',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('UploadIntegration', uploadFn),
    });

    // Route: GET /api/files - List files by category
    httpApi.addRoutes({
      path: '/api/files',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration('FilesIntegration', filesFn),
    });

    // Route: DELETE /api/files - Delete a file from S3
    httpApi.addRoutes({
      path: '/api/files',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new apigwv2Integrations.HttpLambdaIntegration('FilesDeleteIntegration', filesFn),
    });

    // Route: POST /api/audit - Audit a document against criteria
    httpApi.addRoutes({
      path: '/api/audit',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration('AuditIntegration', auditFn),
    });

    // Route: GET /api/categories - Get available categories and configuration
    httpApi.addRoutes({
      path: '/api/categories',
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration('CategoriesIntegration', categoriesFn),
    });

    // Store the API URL for CloudFront origin configuration
    this.apiUrl = httpApi.apiEndpoint;

    // ========================================================================
    // WAF - Web Application Firewall for IP-based access restriction
    // ========================================================================

    // Create an IP Set containing the allowed IP addresses/CIDRs
    const ipSet = new wafv2.CfnIPSet(this, 'AllowedIpSet', {
      // Name displayed in the WAF console
      name: 'rag-tool-allowed-ips',
      // Scope must be CLOUDFRONT for CloudFront distributions
      scope: 'CLOUDFRONT',
      // Use IPv4 addresses
      ipAddressVersion: 'IPV4',
      // The list of allowed CIDR ranges from our config
      addresses: ALLOWED_IPS,
      // Description for documentation
      description: 'IP addresses allowed to access the RAG tool',
    });

    // Create a Web ACL that blocks all traffic except from allowed IPs
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      // Name displayed in the WAF console
      name: RESOURCE_NAMES.wafAclName,
      // Scope must be CLOUDFRONT for CloudFront distributions
      scope: 'CLOUDFRONT',
      // Default action: BLOCK all traffic that doesn't match any rule
      defaultAction: { block: {} },
      // Visibility configuration for CloudWatch metrics
      visibilityConfig: {
        // Enable CloudWatch metrics for monitoring
        cloudWatchMetricsEnabled: true,
        // Metric name prefix
        metricName: 'rag-tool-waf',
        // Enable request sampling for debugging
        sampledRequestsEnabled: true,
      },
      // Rules: allow traffic from IPs in the IP Set
      rules: [
        {
          // Rule name
          name: 'allow-listed-ips',
          // Priority (lower number = evaluated first)
          priority: 0,
          // Action: ALLOW matching requests
          action: { allow: {} },
          // Match requests from IPs in our IP Set
          statement: {
            ipSetReferenceStatement: {
              arn: ipSet.attrArn,
            },
          },
          // Visibility config for this specific rule
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'rag-tool-allowed-ips',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // ========================================================================
    // CLOUDFRONT - CDN distribution serving frontend and proxying API calls
    // ========================================================================

    // Create an Origin Access Control for secure S3 access
    const oac = new cloudfront.S3OriginAccessControl(this, 'FrontendOAC', {
      // Description for identification
      description: 'OAC for RAG tool frontend bucket',
    });

    // Parse the API Gateway URL to extract the domain name
    const apiDomainName = cdk.Fn.select(2, cdk.Fn.split('/', httpApi.apiEndpoint));

    // Create the CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      // Description shown in the CloudFront console
      comment: 'RAG Tool - Frontend and API distribution',
      // Default behavior: serve the React SPA from S3
      defaultBehavior: {
        // S3 origin for the frontend bucket using OAC
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket, {
          originAccessControl: oac,
        }),
        // Allow GET and HEAD for static assets
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        // Cache GET and HEAD requests
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        // Redirect HTTP to HTTPS for security
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Use the caching optimized policy for static assets
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      // Additional behaviors for API routing
      additionalBehaviors: {
        // Route /api/* requests to the API Gateway
        '/api/*': {
          // HTTP origin pointing to the API Gateway endpoint
          origin: new origins.HttpOrigin(apiDomainName, {
            // Use HTTPS for API Gateway communication
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            // Add a custom header for origin verification
            customHeaders: {
              [RESOURCE_NAMES.originVerifyHeader]: RESOURCE_NAMES.originVerifySecret,
            },
          }),
          // Allow all HTTP methods for API calls
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          // Only cache GET and HEAD responses
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          // Use HTTPS only
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          // Disable caching for API responses (they should be fresh)
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // Forward all headers, query strings, and cookies to the API
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      // Serve index.html for SPA client-side routing (React Router)
      defaultRootObject: 'index.html',
      // Custom error responses to support SPA routing
      errorResponses: [
        {
          // When S3 returns 403 (forbidden/not found), serve index.html instead
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          // Cache error responses briefly
          ttl: cdk.Duration.minutes(5),
        },
        {
          // When S3 returns 404, serve index.html for client-side routing
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          // Cache error responses briefly
          ttl: cdk.Duration.minutes(5),
        },
      ],
      // Attach the WAF Web ACL for IP restriction
      webAclId: webAcl.attrArn,
    });

    // ========================================================================
    // STACK OUTPUTS - Values needed for deployment and other stacks
    // ========================================================================

    // Output the CloudFront distribution URL for accessing the application
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL - access the application here',
    });

    // Output the CloudFront distribution ID for cache invalidation during deploys
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID for cache invalidation',
    });

    // Output the frontend S3 bucket name for deploying built React assets
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket name for frontend deployment',
    });

    // Output the documents S3 bucket name for uploading reference documents
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      description: 'S3 bucket name for document storage',
    });

    // Output the API Gateway URL for debugging direct API calls
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway endpoint URL',
    });
  }
}

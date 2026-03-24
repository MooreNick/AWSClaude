// bedrock-stack.ts - CDK stack for Amazon Bedrock Knowledge Base resources
// Creates: Bedrock Knowledge Base, S3 data source, IAM roles for Bedrock

// Import AWS CDK core library for stack definitions
import * as cdk from 'aws-cdk-lib';
// Import Constructs for the base Construct class
import { Construct } from 'constructs';
// Import S3 module for referencing the documents bucket
import * as s3 from 'aws-cdk-lib/aws-s3';
// Import IAM for Bedrock service roles
import * as iam from 'aws-cdk-lib/aws-iam';
// Import Bedrock CfnKnowledgeBase for L1 construct (no L2 yet for KB)
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
// Import our central configuration
import { RESOURCE_NAMES, AWS_REGION, BEDROCK_MODELS, CATEGORIES } from './config';

// Properties passed from the main RagStack to this stack
interface BedrockStackProps extends cdk.StackProps {
  // Reference to the documents S3 bucket created in RagStack
  documentsBucket: s3.IBucket;
}

// Stack that creates the Bedrock Knowledge Base and its data source
export class BedrockStack extends cdk.Stack {
  // Expose the Knowledge Base ID so it can be set as a Lambda environment variable
  public readonly knowledgeBaseId: string;

  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    // Call the parent Stack constructor
    super(scope, id, props);

    // ========================================================================
    // IAM ROLE - Bedrock Knowledge Base Service Role
    // Allows Bedrock to read documents from S3 and invoke the embedding model
    // ========================================================================
    const bedrockKbRole = new iam.Role(this, 'BedrockKbRole', {
      // Allow the Bedrock service to assume this role
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      // Descriptive name for the role
      description: 'Role for Bedrock Knowledge Base to access S3 and embedding model',
    });

    // Grant Bedrock KB read access to the documents bucket
    bedrockKbRole.addToPolicy(
      new iam.PolicyStatement({
        // Allow reading document contents from S3
        actions: [
          's3:GetObject',       // Read individual documents
          's3:ListBucket',      // List documents in category folders
        ],
        // Restrict to the documents bucket only
        resources: [
          props.documentsBucket.bucketArn,           // Bucket-level for ListBucket
          `${props.documentsBucket.bucketArn}/*`,    // Object-level for GetObject
        ],
      })
    );

    // Grant Bedrock KB permission to invoke the embedding model
    bedrockKbRole.addToPolicy(
      new iam.PolicyStatement({
        // Allow invoking the Titan embedding model
        actions: ['bedrock:InvokeModel'],
        // Restrict to only the Titan Embed V2 model
        resources: [
          `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.embedding}`,
        ],
      })
    );

    // ========================================================================
    // BEDROCK KNOWLEDGE BASE
    // Manages document ingestion, chunking, embedding, and vector storage
    // Uses OpenSearch Serverless as the vector store (required by Bedrock KB)
    // ========================================================================

    // NOTE: As of early 2025, Bedrock Knowledge Bases with S3 Vectors require
    // manual setup via the AWS Console or CLI because CDK/CloudFormation support
    // is limited. The CDK below creates the KB with OpenSearch Serverless as
    // the vector store, which is the most well-supported option in CDK.
    //
    // ALTERNATIVE: If you want to use S3 Vectors (cheaper), follow the manual
    // setup steps in the README.md and setup-steps.csv instead of this stack.
    //
    // For now, this stack provides the IAM role and outputs needed regardless
    // of which vector store backend you choose.

    // Create the Bedrock Knowledge Base using the L1 CloudFormation construct
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'RagKnowledgeBase', {
      // Name for the Knowledge Base displayed in the Bedrock console
      name: RESOURCE_NAMES.knowledgeBaseName,
      // Description explaining the purpose of this Knowledge Base
      description: 'Knowledge Base for RAG tool - indexes documents from S3 by category',
      // IAM role that Bedrock assumes when accessing S3 and embedding model
      roleArn: bedrockKbRole.roleArn,
      // Configuration for how the Knowledge Base stores and searches vectors
      knowledgeBaseConfiguration: {
        // Type of Knowledge Base (VECTOR means it uses embeddings for search)
        type: 'VECTOR',
        // Vector-specific configuration
        vectorKnowledgeBaseConfiguration: {
          // The embedding model to use when converting text to vectors
          embeddingModelArn: `arn:aws:bedrock:${AWS_REGION}::foundation-model/${BEDROCK_MODELS.embedding}`,
        },
      },
      // Storage configuration for the vector embeddings
      // NOTE: This uses a placeholder - you must configure the actual vector
      // store (OpenSearch Serverless or S3 Vectors) via console/CLI
      storageConfiguration: {
        // Type of vector storage backend
        type: 'OPENSEARCH_SERVERLESS',
        // OpenSearch Serverless configuration
        opensearchServerlessConfiguration: {
          // Collection ARN - must be created separately or via console
          collectionArn: `arn:aws:aoss:${AWS_REGION}:${this.account}:collection/PLACEHOLDER`,
          // Field mapping for the OpenSearch index
          fieldMapping: {
            // Field name for storing the vector embeddings
            vectorField: 'embedding',
            // Field name for storing the original text
            textField: 'text',
            // Field name for storing document metadata
            metadataField: 'metadata',
          },
          // Name of the OpenSearch index
          vectorIndexName: 'rag-tool-index',
        },
      },
    });

    // Store the Knowledge Base ID for export
    this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;

    // ========================================================================
    // BEDROCK DATA SOURCE - Connects S3 bucket to the Knowledge Base
    // Defines which S3 documents should be ingested and how they're processed
    // ========================================================================
    const dataSource = new bedrock.CfnDataSource(this, 'S3DataSource', {
      // Link this data source to our Knowledge Base
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      // Name for the data source
      name: 'rag-documents-s3',
      // Description of what documents this source contains
      description: 'S3 bucket containing all RAG reference documents organized by category',
      // Data source configuration pointing to S3
      dataSourceConfiguration: {
        // Type of data source (S3)
        type: 'S3',
        // S3-specific configuration
        s3Configuration: {
          // The S3 bucket ARN containing our documents
          bucketArn: props.documentsBucket.bucketArn,
          // Include all category prefixes so all documents are indexed
          // No inclusionPrefixes = index everything in the bucket
        },
      },
      // Configure how documents are chunked before embedding
      vectorIngestionConfiguration: {
        // Chunking strategy configuration
        chunkingConfiguration: {
          // Use fixed-size chunking for predictable, consistent chunks
          chunkingStrategy: 'FIXED_SIZE',
          // Fixed-size chunking parameters
          fixedSizeChunkingConfiguration: {
            // Maximum number of tokens per chunk
            maxTokens: 512,
            // Percentage of overlap between consecutive chunks (20%)
            overlapPercentage: 20,
          },
        },
      },
    });

    // ========================================================================
    // STACK OUTPUTS
    // ========================================================================

    // Output the Knowledge Base ID for Lambda environment variable configuration
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.attrKnowledgeBaseId,
      description: 'Bedrock Knowledge Base ID - set as KNOWLEDGE_BASE_ID env var in Lambda',
      // Export for cross-stack reference
      exportName: 'RagToolKnowledgeBaseId',
    });

    // Output the Data Source ID for triggering sync jobs
    new cdk.CfnOutput(this, 'DataSourceId', {
      value: dataSource.attrDataSourceId,
      description: 'Bedrock Data Source ID - used when triggering ingestion jobs',
      // Export for cross-stack reference
      exportName: 'RagToolDataSourceId',
    });

    // Output the Bedrock KB role ARN for reference
    new cdk.CfnOutput(this, 'BedrockKbRoleArn', {
      value: bedrockKbRole.roleArn,
      description: 'IAM role ARN used by the Bedrock Knowledge Base',
    });
  }
}

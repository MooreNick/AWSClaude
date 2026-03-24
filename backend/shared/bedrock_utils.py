# bedrock_utils.py - Helper functions for Amazon Bedrock model invocation
# Provides wrappers for calling Claude LLM and Titan embedding models

# Import boto3 AWS SDK
import boto3
# Import json for serializing/deserializing request and response payloads
import json
# Import logging for error reporting
import logging
# Import our configuration for model IDs and region
from shared.config import (
    AWS_BEDROCK_REGION,
    GENERATION_MODEL_ID,
    AUDIT_MODEL_ID,
    EMBEDDING_MODEL_ID,
)

# Create a logger for this module
logger = logging.getLogger(__name__)

# Create a reusable Bedrock Runtime client for model invocations
bedrock_runtime = boto3.client('bedrock-runtime', region_name=AWS_BEDROCK_REGION)


def invoke_claude(prompt: str, system_prompt: str = '', model_id: str = None,
                  max_tokens: int = 4096, temperature: float = 0.7) -> str:
    """Invoke a Claude model on Bedrock and return the generated text.

    Args:
        prompt: The user message to send to Claude
        system_prompt: Optional system message to set Claude's behavior
        model_id: Bedrock model ID (defaults to GENERATION_MODEL_ID)
        max_tokens: Maximum number of tokens to generate
        temperature: Randomness of generation 0.0-1.0

    Returns:
        The generated text response as a string

    Raises:
        RuntimeError: If the Bedrock API call fails or response is malformed
    """
    # Use the default generation model if none specified
    if model_id is None:
        model_id = GENERATION_MODEL_ID

    # Build the request body using Claude Messages API format
    request_body = {
        'anthropic_version': 'bedrock-2023-05-31',
        'max_tokens': max_tokens,
        'temperature': temperature,
        'messages': [
            {
                'role': 'user',
                'content': prompt,
            }
        ],
    }

    # Add system prompt if provided
    if system_prompt:
        request_body['system'] = system_prompt

    # Call Bedrock InvokeModel
    response = bedrock_runtime.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body),
        contentType='application/json',
        accept='application/json',
    )

    # Parse the response body
    response_body = json.loads(response['body'].read())

    # Safely extract text from response with bounds checking
    content = response_body.get('content', [])
    if not content:
        logger.error(f'Bedrock returned empty content. Full response: {response_body}')
        raise RuntimeError('Bedrock returned an empty response. Please try again.')

    # Extract text from the first content block
    first_block = content[0]
    if isinstance(first_block, dict) and 'text' in first_block:
        return first_block['text']

    # Fallback: try to stringify the content block
    logger.warning(f'Unexpected content block format: {first_block}')
    return str(first_block)


def invoke_generation_model(prompt: str, system_prompt: str = '',
                            max_tokens: int = 4096, temperature: float = 0.7) -> str:
    """Invoke the generation model (Claude Haiku) for RAG draft generation."""
    return invoke_claude(
        prompt=prompt,
        system_prompt=system_prompt,
        model_id=GENERATION_MODEL_ID,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def invoke_audit_model(prompt: str, system_prompt: str = '',
                       max_tokens: int = 8192, temperature: float = 0.3) -> str:
    """Invoke the audit model (Claude Sonnet) for document audit comparison.
    Uses lower temperature for more consistent, accurate output."""
    return invoke_claude(
        prompt=prompt,
        system_prompt=system_prompt,
        model_id=AUDIT_MODEL_ID,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def generate_embedding(text: str) -> list:
    """Generate a vector embedding for the given text using Titan Embed V2.

    Note: Bedrock Knowledge Base handles embeddings automatically during
    ingestion and retrieval. This is for direct embedding operations only.
    """
    request_body = {
        'inputText': text,
        'dimensions': 1024,
        'normalize': True,
    }

    response = bedrock_runtime.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        body=json.dumps(request_body),
        contentType='application/json',
        accept='application/json',
    )

    response_body = json.loads(response['body'].read())
    return response_body['embedding']

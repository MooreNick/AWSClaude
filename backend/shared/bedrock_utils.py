# bedrock_utils.py - Helper functions for Amazon Bedrock model invocation
# Provides wrappers for calling Claude LLM and Titan embedding models

# Import boto3 AWS SDK
import boto3
# Import json for serializing/deserializing request and response payloads
import json
# Import our configuration for model IDs and region
from shared.config import (
    AWS_BEDROCK_REGION,
    GENERATION_MODEL_ID,
    AUDIT_MODEL_ID,
    EMBEDDING_MODEL_ID,
)

# Create a reusable Bedrock Runtime client for model invocations
bedrock_runtime = boto3.client('bedrock-runtime', region_name=AWS_BEDROCK_REGION)

# ============================================================================
# LLM INVOCATION - Claude models via Bedrock
# ============================================================================


def invoke_claude(prompt: str, system_prompt: str = '', model_id: str = None,
                  max_tokens: int = 4096, temperature: float = 0.7) -> str:
    """Invoke a Claude model on Bedrock and return the generated text.

    Uses the Messages API format required by Claude models on Bedrock.

    Args:
        prompt: The user message / main prompt to send to Claude
        system_prompt: Optional system message to set Claude's behavior
        model_id: Bedrock model ID to use (defaults to GENERATION_MODEL_ID)
        max_tokens: Maximum number of tokens to generate (default 4096)
        temperature: Randomness of generation 0.0-1.0 (default 0.7)

    Returns:
        The generated text response as a string
    """
    # Use the default generation model if no specific model is provided
    if model_id is None:
        model_id = GENERATION_MODEL_ID

    # Build the request body using the Claude Messages API format
    request_body = {
        # Anthropic API version required by Bedrock
        'anthropic_version': 'bedrock-2023-05-31',
        # Maximum tokens to generate in the response
        'max_tokens': max_tokens,
        # Temperature controls randomness (0 = deterministic, 1 = creative)
        'temperature': temperature,
        # Messages array containing the user's prompt
        'messages': [
            {
                # Role is 'user' for the input prompt
                'role': 'user',
                # Content is the prompt text
                'content': prompt,
            }
        ],
    }

    # Add system prompt if provided (sets Claude's behavior/persona)
    if system_prompt:
        request_body['system'] = system_prompt

    # Call Bedrock InvokeModel with the serialized request body
    response = bedrock_runtime.invoke_model(
        # The Bedrock model ID to invoke
        modelId=model_id,
        # JSON-encoded request body
        body=json.dumps(request_body),
        # Content type for the request
        contentType='application/json',
        # Expected content type for the response
        accept='application/json',
    )

    # Parse the response body from JSON bytes to a Python dictionary
    response_body = json.loads(response['body'].read())
    # Extract and return the text from the first content block
    return response_body['content'][0]['text']


def invoke_generation_model(prompt: str, system_prompt: str = '',
                            max_tokens: int = 4096, temperature: float = 0.7) -> str:
    """Invoke the generation model (Claude Haiku) for RAG draft generation.

    Convenience wrapper that uses the configured generation model.

    Args:
        prompt: The user prompt with context and instructions
        system_prompt: Optional system prompt for behavior guidance
        max_tokens: Maximum tokens to generate
        temperature: Generation temperature

    Returns:
        Generated text response
    """
    # Call invoke_claude with the generation model ID
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

    Uses a more capable model with lower temperature for accurate analysis.

    Args:
        prompt: The audit prompt with both documents and instructions
        system_prompt: System prompt establishing the auditor role
        max_tokens: Maximum tokens (higher for detailed reports)
        temperature: Lower temperature for more consistent, accurate output

    Returns:
        Audit report as text
    """
    # Call invoke_claude with the audit model ID and lower temperature
    return invoke_claude(
        prompt=prompt,
        system_prompt=system_prompt,
        model_id=AUDIT_MODEL_ID,
        max_tokens=max_tokens,
        temperature=temperature,
    )


# ============================================================================
# EMBEDDING - Titan Text Embeddings V2
# ============================================================================


def generate_embedding(text: str) -> list:
    """Generate a vector embedding for the given text using Titan Embed V2.

    Note: This is provided for direct embedding operations. The Bedrock
    Knowledge Base handles embeddings automatically during ingestion and retrieval.

    Args:
        text: The text to embed

    Returns:
        A list of floats representing the text embedding vector
    """
    # Build the request body for Titan Embed V2
    request_body = {
        # The text to convert to an embedding vector
        'inputText': text,
        # Embedding dimensions (1024 for best accuracy)
        'dimensions': 1024,
        # Normalize the output vector for cosine similarity
        'normalize': True,
    }

    # Call Bedrock InvokeModel with the Titan embedding model
    response = bedrock_runtime.invoke_model(
        # Use the Titan embedding model
        modelId=EMBEDDING_MODEL_ID,
        # JSON-encoded request body
        body=json.dumps(request_body),
        # Content type
        contentType='application/json',
        # Accept type
        accept='application/json',
    )

    # Parse the response body
    response_body = json.loads(response['body'].read())
    # Return the embedding vector
    return response_body['embedding']

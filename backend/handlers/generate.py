# generate.py - Lambda handler for POST /api/generate
# Takes approved search results and generates a draft document using Claude
# The generated draft matches the style and structure of the retrieved examples

# Import json for request/response serialization
import json
# Import traceback for error logging
import traceback
# Import the Bedrock generation model invocation function
from shared.bedrock_utils import invoke_generation_model


def handler(event, context):
    """Handle POST /api/generate requests.

    Takes the user's approved search results (passages from relevant documents),
    the original query/uploaded text, and the desired tone, then generates a
    new draft document that matches the style and structure of the examples.

    Expected request body (JSON):
    {
        "originalQuery": "The original search text or uploaded document content",
        "approvedPassages": [
            {
                "fileName": "example_tech_approach.pdf",
                "passage": "Relevant text passage from the document...",
                "category": "tech-approach"
            }
        ],
        "tone": "professional",
        "additionalInstructions": "Optional extra guidance for generation"
    }

    Args:
        event: API Gateway HTTP API event with the generation payload
        context: Lambda execution context

    Returns:
        API Gateway response with the generated draft document
    """
    # Define standard CORS headers for all responses
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }

    try:
        # Parse the request body from JSON
        body = json.loads(event.get('body', '{}'))

        # Extract the original query text or uploaded document content
        original_query = body.get('originalQuery', '')
        # Extract the list of approved passages the user selected
        approved_passages = body.get('approvedPassages', [])
        # Extract the desired writing tone
        tone = body.get('tone', 'professional')
        # Extract any additional instructions from the user
        additional_instructions = body.get('additionalInstructions', '')

        # ====================================================================
        # VALIDATION - Ensure we have the inputs needed for generation
        # ====================================================================

        # Validate that we have approved passages to use as references
        if not approved_passages:
            # Return a 400 error if no passages were approved
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'No approved passages provided. Please select at least one search result.',
                }),
            }

        # Validate that we have an original query for context
        if not original_query:
            # Return a 400 error if no original query was provided
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'No original query provided. Please provide the original search input.',
                }),
            }

        # ====================================================================
        # BUILD PROMPT - Construct the generation prompt with context
        # ====================================================================

        # Build the reference passages section of the prompt
        passages_text = ''
        # Iterate through each approved passage and format it
        for i, passage in enumerate(approved_passages, 1):
            # Add a numbered reference with the source filename
            passages_text += f'\n--- Reference {i}: {passage.get("fileName", "Unknown")} ---\n'
            # Add the passage text
            passages_text += f'{passage.get("passage", "")}\n'

        # Set the system prompt to establish Claude's role as a document drafter
        system_prompt = (
            'You are an expert document writer and proposal specialist. '
            'Your task is to generate a new draft document section that closely matches '
            'the style, structure, tone, and quality of the provided reference examples. '
            'Use the reference passages as templates for structure and style. '
            'Incorporate relevant content and approaches from the references while '
            'creating original content tailored to the user\'s specific needs. '
            'Do not simply copy the references - synthesize them into a new, cohesive draft.'
        )

        # Build the main user prompt with all context and instructions
        user_prompt = f"""Based on the following reference documents and the original input,
generate a new draft document section.

**Writing Tone:** {tone}

**Original Input / Context:**
{original_query}

**Reference Documents (use these as style and structure guides):**
{passages_text}

**Instructions:**
1. Match the writing style, tone, and structure of the reference documents
2. Use a {tone} tone throughout the draft
3. Create original content that addresses the original input/context
4. Incorporate relevant approaches, methodologies, or frameworks from the references
5. Ensure the draft is cohesive, well-organized, and professional
"""

        # Add any additional user instructions to the prompt
        if additional_instructions:
            user_prompt += f'\n**Additional Instructions from User:**\n{additional_instructions}\n'

        # Add final instruction to produce the draft
        user_prompt += '\nPlease generate the draft document now:'

        # ====================================================================
        # GENERATE - Call Claude to create the draft document
        # ====================================================================

        # Invoke the generation model (Claude Haiku) with the constructed prompt
        generated_text = invoke_generation_model(
            prompt=user_prompt,
            system_prompt=system_prompt,
            # Allow up to 4096 tokens for the generated draft
            max_tokens=4096,
            # Use moderate temperature for creative but controlled output
            temperature=0.7,
        )

        # ====================================================================
        # RESPONSE - Return the generated draft
        # ====================================================================

        # Return the generated draft document
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                # The generated draft document text
                'generatedText': generated_text,
                # The tone that was applied
                'tone': tone,
                # Number of reference passages used
                'referencesUsed': len(approved_passages),
                # Source filenames for attribution
                'sourceFiles': [p.get('fileName', '') for p in approved_passages],
            }),
        }

    except json.JSONDecodeError:
        # Handle malformed JSON in the request body
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Invalid JSON in request body',
            }),
        }

    except Exception as e:
        # Log the full error traceback for debugging
        print(f'Error in generate handler: {traceback.format_exc()}')
        # Return a 500 Internal Server Error
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
            }),
        }

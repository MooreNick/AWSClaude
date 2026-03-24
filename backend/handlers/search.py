# search.py - Lambda handler for POST /api/search
# Performs RAG retrieval against the Bedrock Knowledge Base
# Returns relevant document chunks with source file info and relevance scores

# Import json for request/response serialization
import json
# Import traceback for error logging
import traceback
# Import document parser for extracting text from uploaded files
from shared.document_parser import decode_and_extract
# Import Knowledge Base retrieval function
from shared.knowledge_base import retrieve_documents


def handler(event, context):
    """Handle POST /api/search requests.

    Accepts a query (text and/or uploaded document) and a category,
    searches the Bedrock Knowledge Base for relevant documents,
    and returns matching passages with source file information.

    Expected request body (JSON):
    {
        "queryText": "Optional text query from the user",
        "fileName": "Optional uploaded filename",
        "fileContent": "Optional base64-encoded file content",
        "category": "tech-approach",
        "numResults": 10
    }

    At least one of queryText or fileContent must be provided.

    Args:
        event: API Gateway HTTP API event with the search payload
        context: Lambda execution context

    Returns:
        API Gateway response with search results or error
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

        # Extract the text query (user-typed input)
        query_text = body.get('queryText', '')
        # Extract the optional uploaded filename
        filename = body.get('fileName', '')
        # Extract the optional base64-encoded file content
        file_content_b64 = body.get('fileContent', '')
        # Extract the category to filter search results
        category_id = body.get('category', '')
        # Extract the desired number of results (default 10)
        num_results = body.get('numResults', 10)

        # ====================================================================
        # BUILD QUERY - Combine text input and extracted file content
        # ====================================================================

        # Start with the user-typed query text
        combined_query = query_text

        # If a file was uploaded, extract its text and append to the query
        if file_content_b64 and filename:
            try:
                # Decode the base64 file and extract text content
                file_text = decode_and_extract(file_content_b64, filename)
                # Combine the typed query with the extracted file text
                if combined_query:
                    # If both text and file were provided, combine them
                    combined_query = f'{combined_query}\n\n--- Uploaded Document Content ---\n{file_text}'
                else:
                    # If only a file was provided, use its text as the query
                    combined_query = file_text
            except Exception as parse_error:
                # Log parsing errors but continue with any available text query
                print(f'Warning: Failed to parse uploaded file: {parse_error}')

        # Validate that we have some query text to search with
        if not combined_query.strip():
            # Return a 400 error if no search input was provided
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'No search input provided. Please enter text or upload a file.',
                }),
            }

        # Truncate very long queries to prevent exceeding Bedrock limits
        # Bedrock KB Retrieve API has a query text limit
        max_query_length = 25000
        if len(combined_query) > max_query_length:
            # Truncate to the maximum length and add an indicator
            combined_query = combined_query[:max_query_length] + '\n[Content truncated for search]'

        # ====================================================================
        # SEARCH - Query the Bedrock Knowledge Base
        # ====================================================================

        # Call the Knowledge Base Retrieve API with the combined query
        results = retrieve_documents(
            query_text=combined_query,
            category_id=category_id if category_id else None,
            num_results=num_results,
        )

        # ====================================================================
        # RESPONSE - Return the search results
        # ====================================================================

        # Return the search results with metadata
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                # List of matching document chunks with scores
                'results': results,
                # Total number of results found
                'count': len(results),
                # The query that was sent to the Knowledge Base (for debugging)
                'query': combined_query[:500] + '...' if len(combined_query) > 500 else combined_query,
                # The category filter that was applied
                'category': category_id,
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
        print(f'Error in search handler: {traceback.format_exc()}')
        # Return a 500 Internal Server Error
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
            }),
        }

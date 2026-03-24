# categories.py - Lambda handler for GET /api/categories
# Returns the list of available document categories and tone options
# This endpoint is called by the frontend on page load to populate dropdowns

# Import json module for serializing the response body
import json
# Import categories and tone options from our shared configuration
from shared.config import CATEGORIES, TONE_OPTIONS


def handler(event, context):
    """Handle GET /api/categories requests.

    Returns the list of available document categories and writing tone options.
    The frontend uses this to dynamically populate selection dropdowns,
    ensuring the UI always reflects the current configuration.

    Args:
        event: API Gateway HTTP API event (contains request details)
        context: Lambda execution context (contains runtime info)

    Returns:
        API Gateway response with categories and tone options as JSON
    """
    # Build the response body containing categories and tones
    response_body = {
        # List of document categories with their IDs, labels, and descriptions
        'categories': CATEGORIES,
        # List of available writing tone options
        'tones': TONE_OPTIONS,
    }

    # Return the HTTP response with CORS headers
    return {
        # HTTP 200 OK status
        'statusCode': 200,
        # CORS headers to allow frontend requests from any origin
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
        # JSON-serialized response body
        'body': json.dumps(response_body),
    }

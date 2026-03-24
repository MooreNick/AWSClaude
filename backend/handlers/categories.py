# categories.py - Lambda handler for GET /api/categories
# Returns the list of available document categories and tone options

# Import json module for serializing the response body
import json
# Import traceback for error logging
import traceback
# Import categories and tone options from our shared configuration
from shared.config import CATEGORIES, TONE_OPTIONS


def handler(event, context):
    """Handle GET /api/categories requests.

    Returns available document categories and writing tone options.
    The frontend uses this to populate selection dropdowns.
    """
    # Define standard CORS headers
    cors_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }

    try:
        # Build the response body containing categories and tones
        response_body = {
            'categories': CATEGORIES,
            'tones': TONE_OPTIONS,
        }

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(response_body),
        }

    except Exception as e:
        # Log the full error traceback for debugging in CloudWatch
        print(f'Error in categories handler: {traceback.format_exc()}')
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
            }),
        }

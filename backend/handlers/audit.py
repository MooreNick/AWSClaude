# audit.py - Lambda handler for POST /api/audit
# Compares a document against criteria extracted from a reference file
# Uses Claude Sonnet (higher capability) for thorough, accurate analysis

# Import json for request/response serialization
import json
# Import traceback for error logging
import traceback
# Import document parser for extracting text from uploaded files
from shared.document_parser import decode_and_extract
# Import the audit model invocation function (Claude Sonnet)
from shared.bedrock_utils import invoke_audit_model


def handler(event, context):
    """Handle POST /api/audit requests.

    Accepts two files: a document to audit and a reference/criteria file.
    The LLM first extracts criteria from the reference file (any format),
    then audits the target document against each extracted criterion.

    Expected request body (JSON):
    {
        "auditFileName": "proposal_draft.pdf",
        "auditFileContent": "<base64-encoded file to audit>",
        "criteriaFileName": "requirements.docx",
        "criteriaFileContent": "<base64-encoded criteria reference file>"
    }

    Args:
        event: API Gateway HTTP API event with both files
        context: Lambda execution context

    Returns:
        API Gateway response with structured audit report
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

        # Extract the document-to-audit filename
        audit_filename = body.get('auditFileName', '')
        # Extract the document-to-audit base64 content
        audit_content_b64 = body.get('auditFileContent', '')
        # Extract the criteria/reference filename
        criteria_filename = body.get('criteriaFileName', '')
        # Extract the criteria/reference base64 content
        criteria_content_b64 = body.get('criteriaFileContent', '')

        # ====================================================================
        # VALIDATION - Ensure both files are provided
        # ====================================================================

        # Check that all required fields are present
        if not audit_filename or not audit_content_b64:
            # Return error if the document to audit is missing
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'Missing document to audit. Provide auditFileName and auditFileContent.',
                }),
            }

        if not criteria_filename or not criteria_content_b64:
            # Return error if the criteria reference is missing
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': 'Missing criteria file. Provide criteriaFileName and criteriaFileContent.',
                }),
            }

        # ====================================================================
        # EXTRACT TEXT - Parse both uploaded files
        # ====================================================================

        # Extract text from the document being audited
        audit_text = decode_and_extract(audit_content_b64, audit_filename)
        # Extract text from the criteria/reference document
        criteria_text = decode_and_extract(criteria_content_b64, criteria_filename)

        # Validate that both files contained extractable text
        if not audit_text.strip():
            # Return error if the audit document had no extractable text
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': f'Could not extract text from audit file: {audit_filename}',
                }),
            }

        if not criteria_text.strip():
            # Return error if the criteria file had no extractable text
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'error': f'Could not extract text from criteria file: {criteria_filename}',
                }),
            }

        # ====================================================================
        # BUILD AUDIT PROMPT - Instruct Claude to perform the audit
        # ====================================================================

        # System prompt establishing Claude's role as a document auditor
        system_prompt = (
            'You are an expert document auditor. Your job is to thoroughly compare '
            'a document against criteria and provide a detailed, structured audit report. '
            'You must be precise, fair, and cite specific evidence from the document. '
            'Always respond in valid JSON format as specified in the instructions.'
        )

        # Main audit prompt with both documents and structured output instructions
        audit_prompt = f"""Perform a detailed audit of the following document against the provided criteria.

**STEP 1 - Extract Criteria:**
First, carefully read the CRITERIA REFERENCE document below and identify every distinct
requirement, criterion, or expectation it contains. The criteria document may be in any
format (bullet points, paragraphs, tables, etc.) - extract all requirements regardless of format.

**CRITERIA REFERENCE DOCUMENT (from: {criteria_filename}):**
---
{criteria_text}
---

**STEP 2 - Audit the Document:**
Now audit the following document against each criterion you identified:

**DOCUMENT BEING AUDITED (from: {audit_filename}):**
---
{audit_text}
---

**STEP 3 - Generate Report:**
For each criterion, provide your assessment in the following JSON format:

{{
    "summary": "Brief overall assessment of the document (2-3 sentences)",
    "overallScore": "PASS | PARTIAL | FAIL",
    "totalCriteria": <number of criteria identified>,
    "criteriaResults": [
        {{
            "criterionNumber": 1,
            "criterion": "The specific requirement or criterion text",
            "verdict": "MEETS | PARTIALLY MEETS | DOES NOT MEET",
            "evidence": "Direct quote or specific reference from the audited document that supports your verdict",
            "notes": "Explanation of your assessment, including what is missing or could be improved"
        }}
    ],
    "recommendations": [
        "Specific recommendation for improving the document"
    ]
}}

IMPORTANT: Respond with ONLY the JSON object, no additional text before or after it.
"""

        # ====================================================================
        # INVOKE AUDIT MODEL - Call Claude Sonnet for thorough analysis
        # ====================================================================

        # Call the audit model (Claude Sonnet) with lower temperature for accuracy
        audit_response = invoke_audit_model(
            prompt=audit_prompt,
            system_prompt=system_prompt,
            # Allow up to 8192 tokens for detailed audit reports
            max_tokens=8192,
            # Low temperature for consistent, accurate analysis
            temperature=0.3,
        )

        # ====================================================================
        # PARSE RESPONSE - Extract the JSON audit report from Claude's response
        # ====================================================================

        # Attempt to parse the response as JSON
        audit_report = _parse_audit_json(audit_response)

        # ====================================================================
        # RESPONSE - Return the structured audit report
        # ====================================================================

        # Return the audit report with metadata
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                # The structured audit report
                'auditReport': audit_report,
                # Metadata about the files that were audited
                'auditedFile': audit_filename,
                'criteriaFile': criteria_filename,
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
        print(f'Error in audit handler: {traceback.format_exc()}')
        # Return a 500 Internal Server Error
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e),
            }),
        }


def _parse_audit_json(response_text: str) -> dict:
    """Parse the audit JSON from Claude's response text.

    Tries multiple strategies: direct parse, code block extraction,
    brace-matched extraction, and finally falls back to raw text.
    """
    # Strategy 1: Try direct JSON parse
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from ```json code block
    if '```json' in response_text:
        try:
            start = response_text.index('```json') + 7
            end = response_text.index('```', start)
            return json.loads(response_text[start:end].strip())
        except (ValueError, json.JSONDecodeError):
            pass

    # Strategy 3: Find the outermost matching braces using a counter
    try:
        first_brace = response_text.index('{')
        depth = 0
        end_pos = first_brace
        for i in range(first_brace, len(response_text)):
            if response_text[i] == '{':
                depth += 1
            elif response_text[i] == '}':
                depth -= 1
                if depth == 0:
                    end_pos = i + 1
                    break
        if end_pos > first_brace:
            return json.loads(response_text[first_brace:end_pos])
    except (ValueError, json.JSONDecodeError):
        pass

    # Strategy 4: Return raw text as fallback
    return {
        'summary': 'Audit completed (could not parse structured response)',
        'rawResponse': response_text,
    }

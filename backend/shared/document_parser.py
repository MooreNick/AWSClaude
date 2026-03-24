# document_parser.py - Extracts text content from PDF, DOCX, and TXT files
# Used by search, upload, and audit handlers to read uploaded documents

# Import io module for working with in-memory file streams
import io
# Import os module for file extension extraction
import os
# Import base64 for decoding base64-encoded file uploads from the frontend
import base64

# ============================================================================
# TEXT EXTRACTION FUNCTIONS
# Each function takes raw file bytes and returns extracted plain text
# ============================================================================


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text content from a PDF file.

    Args:
        file_bytes: Raw bytes of the PDF file

    Returns:
        Extracted text as a single string with pages separated by newlines
    """
    # Import pypdf for PDF text extraction
    from pypdf import PdfReader
    # Create an in-memory file-like object from the raw bytes
    pdf_stream = io.BytesIO(file_bytes)
    # Initialize the PDF reader with the in-memory stream
    reader = PdfReader(pdf_stream)
    # Initialize an empty list to collect text from each page
    text_parts = []
    # Iterate through every page in the PDF document
    for page in reader.pages:
        # Extract text from the current page
        page_text = page.extract_text()
        # Only add non-empty page text to our collection
        if page_text:
            # Append the extracted text to our list
            text_parts.append(page_text)
    # Join all page texts with newlines and return the combined result
    return '\n'.join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract all text content from a DOCX (Word) file.

    Args:
        file_bytes: Raw bytes of the DOCX file

    Returns:
        Extracted text as a single string with paragraphs separated by newlines
    """
    # Import python-docx for Word document text extraction
    from docx import Document
    # Create an in-memory file-like object from the raw bytes
    docx_stream = io.BytesIO(file_bytes)
    # Open the DOCX document from the in-memory stream
    document = Document(docx_stream)
    # Initialize an empty list to collect text from each paragraph
    text_parts = []
    # Iterate through every paragraph in the document
    for paragraph in document.paragraphs:
        # Only add non-empty paragraphs to our collection
        if paragraph.text.strip():
            # Append the paragraph text to our list
            text_parts.append(paragraph.text)
    # Join all paragraphs with newlines and return the combined result
    return '\n'.join(text_parts)


def extract_text_from_txt(file_bytes: bytes) -> str:
    """Extract text content from a plain text file.

    Args:
        file_bytes: Raw bytes of the text file

    Returns:
        The decoded text content as a string
    """
    # Decode the raw bytes to a UTF-8 string, replacing any invalid characters
    return file_bytes.decode('utf-8', errors='replace')


# ============================================================================
# MAIN PARSER FUNCTION
# Routes to the appropriate extractor based on file extension
# ============================================================================


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract text from a file based on its extension.

    Supports PDF, DOCX, TXT, MD, HTML, and CSV files.
    Routes to the appropriate extraction function based on the file extension.

    Args:
        file_bytes: Raw bytes of the file content
        filename: Original filename including extension (e.g., 'report.pdf')

    Returns:
        Extracted text as a string

    Raises:
        ValueError: If the file extension is not supported
    """
    # Extract the file extension (lowercase) from the filename
    _, extension = os.path.splitext(filename.lower())
    # Route to the appropriate extraction function based on extension
    if extension == '.pdf':
        # Use PyPDF to extract text from PDF files
        return extract_text_from_pdf(file_bytes)
    elif extension == '.docx':
        # Use python-docx to extract text from Word documents
        return extract_text_from_docx(file_bytes)
    elif extension in ['.txt', '.md', '.html', '.csv']:
        # Treat text-based formats as plain text (decode UTF-8)
        return extract_text_from_txt(file_bytes)
    else:
        # Raise an error for unsupported file types
        raise ValueError(f'Unsupported file extension: {extension}. '
                         f'Supported: .pdf, .docx, .txt, .md, .html, .csv')


def decode_and_extract(base64_content: str, filename: str) -> str:
    """Decode a base64-encoded file and extract its text content.

    The frontend sends file contents as base64 strings in JSON payloads.
    This function decodes the base64 string and then extracts the text.

    Args:
        base64_content: Base64-encoded file content from the frontend
        filename: Original filename including extension

    Returns:
        Extracted text as a string
    """
    # Decode the base64 string into raw file bytes
    file_bytes = base64.b64decode(base64_content)
    # Extract and return text using the appropriate parser
    return extract_text(file_bytes, filename)

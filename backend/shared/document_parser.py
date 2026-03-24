# document_parser.py - Extracts text content from PDF, DOCX, and TXT files
# Used by search, upload, and audit handlers to read uploaded documents

# Import io module for working with in-memory file streams
import io
# Import os module for file extension extraction
import os
# Import base64 for decoding base64-encoded file uploads
import base64
# Import binascii for handling decode errors
import binascii
# Import logging for error reporting
import logging

# Create a logger for this module
logger = logging.getLogger(__name__)

# Try to import PDF library at module level (fails fast if layer is missing)
try:
    from pypdf import PdfReader
    PDF_AVAILABLE = True
except ImportError:
    logger.warning('pypdf not available - PDF extraction will fail')
    PDF_AVAILABLE = False

# Try to import DOCX library at module level
try:
    from docx import Document as DocxDocument
    DOCX_AVAILABLE = True
except ImportError:
    logger.warning('python-docx not available - DOCX extraction will fail')
    DOCX_AVAILABLE = False


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text content from a PDF file."""
    if not PDF_AVAILABLE:
        raise RuntimeError('pypdf library is not installed. Check the Lambda layer.')
    # Create an in-memory file-like object from the raw bytes
    pdf_stream = io.BytesIO(file_bytes)
    reader = PdfReader(pdf_stream)
    text_parts = []
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)
    return '\n'.join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract all text content from a DOCX (Word) file."""
    if not DOCX_AVAILABLE:
        raise RuntimeError('python-docx library is not installed. Check the Lambda layer.')
    docx_stream = io.BytesIO(file_bytes)
    document = DocxDocument(docx_stream)
    text_parts = []
    for paragraph in document.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)
    return '\n'.join(text_parts)


def extract_text_from_txt(file_bytes: bytes) -> str:
    """Extract text content from a plain text file."""
    return file_bytes.decode('utf-8', errors='replace')


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract text from a file based on its extension.

    Args:
        file_bytes: Raw bytes of the file content
        filename: Original filename including extension

    Returns:
        Extracted text as a string

    Raises:
        ValueError: If the file extension is not supported
        RuntimeError: If the required library is not installed
    """
    _, extension = os.path.splitext(filename.lower())
    if extension == '.pdf':
        return extract_text_from_pdf(file_bytes)
    elif extension == '.docx':
        return extract_text_from_docx(file_bytes)
    elif extension in ['.txt', '.md', '.html', '.csv']:
        return extract_text_from_txt(file_bytes)
    else:
        raise ValueError(f'Unsupported file extension: {extension}. '
                         f'Supported: .pdf, .docx, .txt, .md, .html, .csv')


def decode_and_extract(base64_content: str, filename: str) -> str:
    """Decode a base64-encoded file and extract its text content.

    Args:
        base64_content: Base64-encoded file content from the frontend
        filename: Original filename including extension

    Returns:
        Extracted text as a string

    Raises:
        ValueError: If base64 content is malformed
    """
    try:
        file_bytes = base64.b64decode(base64_content)
    except (binascii.Error, ValueError) as e:
        raise ValueError(f'Invalid base64 file content: {e}')
    return extract_text(file_bytes, filename)

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker path for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface FileProcessResult {
  content: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  error?: string;
}

/**
 * Process uploaded file and extract text content
 * Supports: .txt, .docx, .pdf
 */
export async function processUploadedFile(file: File): Promise<FileProcessResult> {
  const result: FileProcessResult = {
    content: '',
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  };

  try {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Determine file type and process accordingly
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    switch (fileExtension) {
      case 'txt':
        result.content = await processTxtFile(file);
        break;
      case 'docx':
        result.content = await processDocxFile(file);
        break;
      case 'pdf':
        result.content = await processPdfFile(file);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileExtension}. Please upload .txt, .docx, or .pdf files.`);
    }

    // Validate content
    if (!result.content || result.content.trim().length === 0) {
      throw new Error('No text content found in the file');
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Failed to process file';
    return result;
  }
}

/**
 * Process .txt files
 */
async function processTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read text file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Process .docx files using mammoth
 */
async function processDocxFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (result.messages.length > 0) {
      console.warn('Mammoth warnings:', result.messages);
    }

    return result.value;
  } catch (error) {
    throw new Error(`Failed to process DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process .pdf files using pdfjs-dist
 */
async function processPdfFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n\n';
    }

    return fullText.trim();
  } catch (error) {
    throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate file type before upload
 */
export function isValidFileType(file: File): boolean {
  const validExtensions = ['txt', 'docx', 'pdf'];
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  return validExtensions.includes(fileExtension || '');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

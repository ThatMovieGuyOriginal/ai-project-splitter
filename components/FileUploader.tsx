// components/FileUploader.tsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from '../styles/FileUploader.module.css';

interface FileUploaderProps {
  onAnalyze: (file: File) => Promise<void>;
  loading: boolean;
}

const SUPPORTED_FORMATS = {
  // ZIP formats
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'application/octet-stream': ['.zip'], // Sometimes ZIP files have this MIME type
  
  // TAR formats
  'application/x-tar': ['.tar'],
  'application/tar': ['.tar'],
  
  // Compressed TAR formats
  'application/gzip': ['.tar.gz', '.tgz', '.gz'],
  'application/x-gzip': ['.tar.gz', '.tgz', '.gz'],
  'application/x-compressed': ['.tar.gz', '.tgz'],
  
  // 7-Zip (future support)
  'application/x-7z-compressed': ['.7z'],
} as const;

export const FileUploader: React.FC<FileUploaderProps> = ({ onAnalyze, loading }) => {
  const [uploadProgress, setUploadProgress] = useState(0);

  const validateFile = useCallback((file: File): string | null => {
    // Size check (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      return 'File too large. Maximum size is 25MB.';
    }

    // Format check
    const fileName = file.name.toLowerCase();
    const supportedExtensions = ['.zip', '.tar', '.tar.gz', '.tgz', '.gz'];
    
    const isValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
    const isValidMimeType = Object.keys(SUPPORTED_FORMATS).includes(file.type);
    
    if (!isValidExtension && !isValidMimeType) {
      return `Unsupported file format. Supported formats: ${supportedExtensions.join(', ')}`;
    }

    return null;
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: Array<{ file: File; errors: Array<{ code: string; message: string }> }>) => {
    // Handle rejections
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        alert('File too large. Maximum size is 25MB.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        alert('Invalid file type. Please upload a supported archive format.');
      } else {
        alert(`File rejected: ${rejection.errors[0]?.message || 'Unknown error'}`);
      }
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    // Additional validation
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setUploadProgress(0);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await onAnalyze(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Reset progress after completion
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (error) {
      setUploadProgress(0);
      console.error('Upload error:', error);
    }
  }, [onAnalyze, validateFile]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: SUPPORTED_FORMATS,
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024, // 25MB
    disabled: loading,
  });

  const getDropzoneClass = () => {
    let className = styles.dropzone;
    if (loading) className += ` ${styles.disabled}`;
    if (isDragActive && !isDragReject) className += ` ${styles.active}`;
    if (isDragReject) className += ` ${styles.reject}`;
    return className;
  };

  const getStatusMessage = () => {
    if (loading) {
      return 'Analyzing your project...';
    }
    if (isDragReject) {
      return 'Invalid file type. Please drop a supported archive format.';
    }
    if (isDragActive) {
      return 'Drop your project archive here...';
    }
    return 'Drag & drop a project archive, or click to select';
  };

  return (
    <div className={styles.uploader}>
      <div {...getRootProps()} className={getDropzoneClass()}>
        <input {...getInputProps()} />
        <div className={styles.content}>
          {loading ? (
            <>
              <div className={styles.spinner} />
              <p>{getStatusMessage()}</p>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className={styles.progress}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${uploadProgress}%` }}
                  />
                  <span className={styles.progressText}>{uploadProgress}%</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.icon}>
                {isDragReject ? '❌' : isDragActive ? '📂' : '📁'}
              </div>
              <p className={isDragReject ? styles.errorText : ''}>
                {getStatusMessage()}
              </p>
              <div className={styles.supportedFormats}>
                <p className={styles.hint}>
                  <strong>Supported formats:</strong>
                </p>
                <div className={styles.formatsList}>
                  <span className={styles.formatBadge}>ZIP</span>
                  <span className={styles.formatBadge}>TAR</span>
                  <span className={styles.formatBadge}>TAR.GZ</span>
                  <span className={styles.formatBadge}>TGZ</span>
                  <span className={styles.formatBadge}>GZ</span>
                </div>
                <p className={styles.hint}>
                  Maximum file size: 25MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Additional help section */}
      <div className={styles.helpSection}>
        <details className={styles.helpDetails}>
          <summary className={styles.helpSummary}>
            💡 Need help preparing your project archive?
          </summary>
          <div className={styles.helpContent}>
            <h4>Creating a project archive:</h4>
            <ul>
              <li><strong>Windows:</strong> Right-click folder → &quot;Compress to ZIP file&quot;</li>
              <li><strong>macOS:</strong> Right-click folder → &quot;Compress&quot;</li>
              <li><strong>Linux:</strong> <code>tar -czf project.tar.gz project-folder/</code></li>
            </ul>
            <h4>What to include:</h4>
            <ul>
              <li>Source code files (.js, .ts, .py, .java, etc.)</li>
              <li>Configuration files</li>
              <li>Package/dependency files (package.json, requirements.txt)</li>
            </ul>
            <h4>What to exclude:</h4>
            <ul>
              <li>node_modules, venv, __pycache__ (dependency folders)</li>
              <li>dist, build, .git (generated/version control folders)</li>
              <li>Binary files, images, videos</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
};

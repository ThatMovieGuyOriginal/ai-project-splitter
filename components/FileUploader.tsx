// components/FileUploader.tsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styles from '../styles/FileUploader.module.css';

interface FileUploaderProps {
  onAnalyze: (file: File) => Promise<void>;
  loading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onAnalyze, loading }) => {
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    setUploadProgress(0);
    await onAnalyze(file);
  }, [onAnalyze]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-tar': ['.tar'],
      'application/gzip': ['.tar.gz', '.tgz']
    },
    maxFiles: 1,
    disabled: loading
  });

  return (
    <div className={styles.uploader}>
      <div 
        {...getRootProps()} 
        className={`${styles.dropzone} ${isDragActive ? styles.active : ''} ${loading ? styles.disabled : ''}`}
      >
        <input {...getInputProps()} />
        <div className={styles.content}>
          {loading ? (
            <>
              <div className={styles.spinner} />
              <p>Analyzing your project...</p>
              {uploadProgress > 0 && (
                <div className={styles.progress}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.icon}>📁</div>
              <p>
                {isDragActive ? 
                  'Drop your project archive here...' : 
                  'Drag & drop a project archive, or click to select'
                }
              </p>
              <p className={styles.hint}>
                Supports .zip, .tar, .tar.gz (max 5MB)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

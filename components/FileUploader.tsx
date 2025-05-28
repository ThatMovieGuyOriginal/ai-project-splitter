import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Folder, Github } from 'lucide-react';

// Add proper type definition for props
interface ModernFileUploaderProps {
  onAnalyze: (file: File) => Promise<void>;
  loading: boolean;
}

const ModernFileUploader: React.FC<ModernFileUploaderProps> = ({ onAnalyze, loading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [files, setFiles] = useState<Array<{
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    { ext: 'ZIP', color: 'bg-blue-100 text-blue-700', desc: 'Most common archive format' },
    { ext: 'TAR', color: 'bg-green-100 text-green-700', desc: 'Unix archive format' },
    { ext: 'TAR.GZ', color: 'bg-purple-100 text-purple-700', desc: 'Compressed tar archive' },
    { ext: 'TGZ', color: 'bg-orange-100 text-orange-700', desc: 'Compressed tar shorthand' },
    { ext: 'GZ', color: 'bg-pink-100 text-pink-700', desc: 'Gzip compressed file' }
  ];

  const validateFile = useCallback((file: File): string | null => {
    const maxSize = 25 * 1024 * 1024; // 25MB
    const supportedExts = ['.zip', '.tar', '.tar.gz', '.tgz', '.gz'];
    
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 25MB.';
    }

    const fileName = file.name.toLowerCase();
    const isSupported = supportedExts.some(ext => fileName.endsWith(ext));
    
    if (!isSupported) {
      return `Unsupported format. Please use: ${supportedExts.join(', ')}`;
    }

    return null;
  }, []);

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 1) {
      setError('Please upload only one file at a time.');
      return;
    }

    const file = droppedFiles[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    await processFile(file);
  }, [validateFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    await processFile(file);
  }, [validateFile]);

  const processFile = async (file: File) => {
    setError(null);
    setUploadStatus('uploading');
    setFiles([{
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }]);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 5) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await onAnalyze(file);
      setUploadStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(errorMessage);
      setUploadStatus('error');
    }
  };

  const resetUploader = () => {
    setFiles([]);
    setError(null);
    setUploadProgress(0);
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Upload className="w-8 h-8 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Analyzing your project...';
      case 'success':
        return 'Analysis complete!';
      case 'error':
        return 'Upload failed';
      default:
        return 'Drop your project archive here';
    }
  };

  const getDropzoneClasses = () => {
    let classes = 'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer ';
    
    if (uploadStatus === 'uploading') {
      classes += 'border-blue-300 bg-blue-50/50 cursor-not-allowed ';
    } else if (uploadStatus === 'success') {
      classes += 'border-green-300 bg-green-50/50 ';
    } else if (uploadStatus === 'error' || error) {
      classes += 'border-red-300 bg-red-50/50 ';
    } else if (dragActive) {
      classes += 'border-blue-400 bg-blue-50/30 scale-[1.02] ';
    } else {
      classes += 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/20 ';
    }
    
    return classes;
  };

  return (
    <div className="space-y-6">
      {/* Main Upload Area */}
      <div
        className={getDropzoneClasses()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => uploadStatus === 'idle' && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".zip,.tar,.tar.gz,.tgz,.gz"
          onChange={handleFileSelect}
          disabled={loading || uploadStatus === 'uploading'}
        />

        <div className="space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            {getStatusIcon()}
          </div>

          {/* Status Text */}
          <div>
            <p className="text-lg font-medium text-gray-900">
              {getStatusText()}
            </p>
            {uploadStatus === 'idle' && (
              <p className="text-sm text-gray-500 mt-1">
                or click to browse files
              </p>
            )}
          </div>

          {/* Progress Bar */}
          {uploadStatus === 'uploading' && (
            <div className="max-w-xs mx-auto">
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>
              </div>
              <p className="text-xs text-center mt-2 text-gray-500 font-medium">
                {uploadProgress}% Complete
              </p>
            </div>
          )}

          {/* File Info */}
          {files.length > 0 && (
            <div className="max-w-md mx-auto bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {files[0].name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(files[0].size)}
                  </p>
                </div>
                {uploadStatus === 'idle' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUploader();
                    }}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {uploadStatus === 'success' && (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Supported Formats */}
          {uploadStatus === 'idle' && (
            <div className="max-w-lg mx-auto">
              <p className="text-sm font-medium text-gray-700 mb-3">Supported formats:</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {supportedFormats.map(format => (
                  <div
                    key={format.ext}
                    className={`${format.color} px-3 py-2 rounded-lg text-center transition-transform hover:scale-105`}
                    title={format.desc}
                  >
                    <div className="text-xs font-bold">{format.ext}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Maximum file size: 25MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      {uploadStatus === 'idle' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200/50">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Folder className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                💡 Tips for Better Analysis
              </h4>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">✅ Include:</h5>
                    <ul className="space-y-1">
                      <li>• Source code files (.js, .ts, .py, etc.)</li>
                      <li>• Configuration files</li>
                      <li>• Package/dependency manifests</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-800 mb-1">❌ Exclude:</h5>
                    <ul className="space-y-1">
                      <li>• node_modules, venv folders</li>
                      <li>• Build/dist directories</li>
                      <li>• Binary files and images</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {uploadStatus === 'success' && (
        <div className="flex justify-center space-x-4">
          <button
            onClick={resetUploader}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Analyze Another Project
          </button>
        </div>
      )}

      {/* Alternative Methods */}
      {uploadStatus === 'idle' && (
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-50 text-gray-500 font-medium">
                Or try these alternatives
              </span>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center group-hover:bg-gray-800 transition-colors">
                  <Github className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900">Import from GitHub</h4>
                  <p className="text-sm text-gray-500">Analyze public repositories directly</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-green-300 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center group-hover:bg-green-600 transition-colors">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-medium text-gray-900">Try Sample Project</h4>
                  <p className="text-sm text-gray-500">See analysis with demo data</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Options Accordion */}
      {uploadStatus === 'idle' && (
        <details className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between font-medium text-gray-700">
            <span>Advanced Options</span>
            <svg className="w-5 h-5 transition-transform" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </summary>
          <div className="px-6 pb-6 space-y-4 bg-gray-50/50">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Skip security scan</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Faster processing, use for trusted code only</p>
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Deep complexity analysis</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">More detailed metrics, slower processing</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Level
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option>Standard Analysis</option>
                <option>Detailed Analysis</option>
                <option>Research Grade</option>
              </select>
            </div>
          </div>
        </details>
      )}

      {/* Help Section */}
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">
          Need help? Check our{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
            documentation
          </a>{' '}
          or{' '}
          <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
            watch tutorial
          </a>
        </p>
        <p className="text-xs text-gray-400">
          🔒 Your code is analyzed locally and never stored on our servers
        </p>
      </div>
    </div>
  );
};

export default ModernFileUploader;

import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, File, X, Camera } from 'lucide-react';

const FileUpload = ({
  label,
  accept = 'image/*,application/pdf',
  onChange,
  error,
  required = false,
  initialPreview = null,
  className = ''
}) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initialPreview || null);

  useEffect(() => {
    if (selectedFile && selectedFile.type && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (!selectedFile && initialPreview) {
      setPreviewUrl(initialPreview);
    }
  }, [selectedFile, initialPreview]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (onChange) onChange(file);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onChange) onChange(null);
  };

  const isImage = (selectedFile && selectedFile.type && selectedFile.type.startsWith('image/')) || previewUrl;

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {selectedFile || previewUrl ? (
        <div className="flex items-center justify-between p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-3.5 truncate">
            {isImage && previewUrl ? (
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-teal-500 shadow-xs flex items-center justify-center shrink-0 bg-white">
                <img
                  src={previewUrl}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 font-bold">
                <File className="w-6 h-6" />
              </div>
            )}

            <div className="truncate text-xs">
              <p className="font-bold text-slate-900 truncate">
                {selectedFile ? selectedFile.name : 'Selected Photo'}
              </p>
              {selectedFile && (
                <p className="text-[11px] text-teal-700 font-semibold">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to save
                </p>
              )}
              {!selectedFile && previewUrl && (
                <p className="text-[11px] text-teal-600 font-medium">Current active profile photo</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-white px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-teal-600" />
              Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50 ${
            error ? 'border-rose-300' : 'border-slate-200 hover:border-teal-400'
          }`}
        >
          <UploadCloud className="w-8 h-8 text-teal-600 mb-2" />
          <p className="text-xs font-bold text-slate-800">Click to upload doctor photo</p>
          <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP, or PDF (max 5MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {error && <p className="text-xs text-rose-600 mt-0.5">{error}</p>}
    </div>
  );
};

export default FileUpload;

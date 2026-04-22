import React, { useState } from 'react';
import { Upload, X, Check, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { uploadFile, auth } from '../firebase';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploaderProps {
  onUploadComplete: (url: string) => void;
  folder?: string;
  accept?: string;
  label?: string;
  maxSizeMB?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadComplete,
  folder = 'uploads',
  accept = 'image/*,application/pdf',
  label = 'Upload de Arquivo',
  maxSizeMB = 5
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setSuccess(false);
    setDownloadUrl(null);

    if (!selectedFile) return;

    // Check file size
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`O arquivo é muito grande. O limite é de ${maxSizeMB}MB.`);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    if (!auth.currentUser) {
      setError('Você precisa estar logado para realizar uploads. Verifique sua sessão.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const storagePath = `${folder}/${timestamp}_${safeName}`;
      
      const url = await uploadFile(file, storagePath);
      
      setDownloadUrl(url);
      setSuccess(true);
      onUploadComplete(url);
    } catch (err: any) {
      console.error('Erro no componente de upload:', err);
      setError(err.message || 'Falha ao enviar o arquivo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSuccess(false);
    setDownloadUrl(null);
    setError(null);
  };

  return (
    <div className="space-y-3 w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-white transition-colors hover:border-blue-400">
      <div className="flex flex-col items-center justify-center space-y-2">
        {!file ? (
          <label className="flex flex-col items-center justify-center cursor-pointer w-full py-4">
            <div className="bg-blue-50 p-3 rounded-full mb-2">
              <Upload className="text-blue-600" size={24} />
            </div>
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <span className="text-xs text-slate-400 mt-1">Imagens ou PDF até {maxSizeMB}MB</span>
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileChange} 
              accept={accept} 
            />
          </label>
        ) : (
          <div className="w-full">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                {file.type.includes('image') ? (
                  <ImageIcon className="text-blue-500" size={20} />
                ) : (
                  <FileText className="text-red-500" size={20} />
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
              
              {!loading && !success && (
                <button 
                  onClick={reset}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X size={18} />
                </button>
              )}

              {success && (
                <div className="bg-emerald-100 p-1 rounded-full">
                  <Check className="text-emerald-600" size={16} />
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive" className="mt-3 py-2 px-3 text-xs rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!success && !error && (
              <Button 
                onClick={handleUpload}
                disabled={loading}
                className="w-full mt-3 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Iniciar Upload'
                )}
              </Button>
            )}

            {success && downloadUrl && (
              <div className="mt-3">
                <p className="text-[10px] text-emerald-600 font-bold mb-1">Upload realizado com sucesso!</p>
                <div className="flex items-center gap-2">
                  <a 
                    href={downloadUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-blue-600 underline truncate flex-1"
                  >
                    Ver arquivo enviado
                  </a>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] rounded-lg"
                    onClick={reset}
                  >
                    Trocar arquivo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

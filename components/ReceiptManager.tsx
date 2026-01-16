
import React, { useState } from 'react';
import { Receipt } from '../types';
import { DEFAULT_RECEIPT_GROUND_TRUTH } from '../constants';

interface ReceiptManagerProps {
  receipts: Receipt[];
  onAddReceipt: (receipt: Receipt) => void;
  onDeleteReceipt: (id: string) => void;
  onUpdateGroundTruth: (id: string, json: string) => void;
}

const ReceiptManager: React.FC<ReceiptManagerProps> = ({ receipts, onAddReceipt, onDeleteReceipt, onUpdateGroundTruth }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempJson, setTempJson] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onerror = () => {
      console.error("FileReader error");
      setIsUploading(false);
      alert("Failed to read the image file.");
    };

    reader.onload = (event) => {
      try {
        const base64 = event.target?.result as string;
        if (!base64) throw new Error("No result from FileReader");

        const parts = base64.split(',');
        if (parts.length < 2) throw new Error("Invalid image data format");

        const header = parts[0];
        const data = parts[1];
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';

        const newReceipt: Receipt = {
          id: crypto.randomUUID(),
          name: file.name,
          imageUrl: base64,
          base64: data,
          mimeType,
          groundTruthJson: DEFAULT_RECEIPT_GROUND_TRUTH
        };

        onAddReceipt(newReceipt);
      } catch (err) {
        console.error("Processing error:", err);
        alert("Could not process this image.");
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditGroundTruth = (receipt: Receipt) => {
    setEditingId(receipt.id);
    setTempJson(receipt.groundTruthJson);
  };

  const handleSaveGroundTruth = () => {
    if (editingId) {
      onUpdateGroundTruth(editingId, tempJson);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Receipt Dataset</h2>
          <p className="text-slate-500 mt-1">Upload images and define expected extraction values.</p>
        </div>
        <div className="relative">
          <input 
            type="file" 
            id="receipt-upload" 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <label 
            htmlFor="receipt-upload"
            className={`bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 cursor-pointer transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> 
            {isUploading ? 'Processing...' : 'Upload Receipt'}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {receipts.length === 0 ? (
          <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 p-20 rounded-2xl text-center">
            <i className="fas fa-image text-4xl text-slate-300 mb-4"></i>
            <p className="text-slate-500">Your dataset is empty. Upload receipt images to start benchmarking.</p>
          </div>
        ) : (
          receipts.map((receipt) => (
            <div key={receipt.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="aspect-[4/3] relative overflow-hidden bg-slate-100 border-b border-slate-100">
                <img src={receipt.imageUrl} alt={receipt.name} className="w-full h-full object-contain" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <button 
                    onClick={() => onDeleteReceipt(receipt.id)}
                    className="w-8 h-8 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                  >
                    <i className="fas fa-trash-can text-sm"></i>
                  </button>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-900 truncate pr-4">{receipt.name}</h4>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                    {receipt.mimeType.split('/')[1]}
                  </span>
                </div>
                
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Ground Truth JSON</p>
                    <button 
                      onClick={() => handleEditGroundTruth(receipt)}
                      className="text-xs text-indigo-600 font-bold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-600 font-mono overflow-x-auto">
                    {receipt.groundTruthJson}
                  </pre>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">Define Ground Truth</h3>
              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 p-2">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">Input the expected extraction result. This will be used to calculate the accuracy of each run.</p>
              <textarea 
                rows={12}
                value={tempJson}
                onChange={(e) => setTempJson(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs bg-slate-900 text-emerald-400"
              ></textarea>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setEditingId(null)}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveGroundTruth}
                className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptManager;

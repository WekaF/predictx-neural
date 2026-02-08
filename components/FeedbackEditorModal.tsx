import React, { useState } from 'react';
import { X, Save, BrainCircuit } from 'lucide-react';
import { TrainingData } from '../types';

interface FeedbackEditorModalProps {
  data: TrainingData;
  onSave: (updated: TrainingData) => void;
  onClose: () => void;
}

const FeedbackEditorModal: React.FC<FeedbackEditorModalProps> = ({ data, onSave, onClose }) => {
  const [pattern, setPattern] = useState(data.pattern);
  const [confluence, setConfluence] = useState(data.confluence);
  const [outcome, setOutcome] = useState(data.outcome);
  const [note, setNote] = useState(data.note);

  const handleSave = () => {
    onSave({
        ...data,
        pattern,
        confluence,
        outcome,
        note
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
            <h3 className="text-white font-bold flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-blue-400" /> Refine Training Data
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Detected Pattern</label>
                <input 
                    type="text" 
                    value={pattern} 
                    onChange={e => setPattern(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                />
            </div>
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Confluence Factors</label>
                <input 
                    type="text" 
                    value={confluence} 
                    onChange={e => setConfluence(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                />
            </div>
            
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Actual Outcome</label>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setOutcome('WIN')}
                        className={`flex-1 py-2 rounded text-xs font-bold border ${outcome === 'WIN' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                    >
                        WIN
                    </button>
                    <button 
                        onClick={() => setOutcome('LOSS')}
                        className={`flex-1 py-2 rounded text-xs font-bold border ${outcome === 'LOSS' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-700 text-slate-500'}`}
                    >
                        LOSS
                    </button>
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Notes</label>
                <textarea 
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-blue-500 outline-none h-20 resize-none"
                ></textarea>
            </div>

            <button 
                onClick={handleSave}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2"
            >
                <Save className="w-4 h-4" /> Save Corrections
            </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackEditorModal;
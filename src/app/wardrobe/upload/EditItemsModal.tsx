'use client';

import { RefObject } from 'react';
import { EditItem, Category, SEASONS, ColorSource } from './upload-utils';

interface Props {
  capturedFrame: Blob | null;
  editItems: EditItem[] | null;
  categories: Category[];
  saving: boolean;
  savingPhase: 'removing-bg' | 'uploading' | null;
  refining: boolean;
  editCanvasRef: RefObject<HTMLCanvasElement | null>;
  onStopCamera: () => void;
  onRetake: () => void;
  onSave: () => void;
  onEditItemsChange: (items: EditItem[]) => void;
}

const SOURCE_LABELS: Record<ColorSource, string> = {
  gemini: 'AI',
  yolo: 'YOLO',
  hsv: 'Auto',
  manual: '',
};

const USE_CASE_OPTIONS = ['casual', 'business', 'sport', 'sleep', 'swim', 'date'];

const USE_CASE_LABELS: Record<string, string> = {
  casual: 'Casual',
  business: 'Business',
  sport: 'Sport',
  sleep: 'Sleepwear',
  swim: 'Swimwear',
  date: 'Date Night',
};

export default function EditItemsModal({
  capturedFrame,
  editItems,
  categories,
  saving,
  savingPhase,
  refining,
  editCanvasRef,
  onStopCamera,
  onRetake,
  onSave,
  onEditItemsChange,
}: Props) {
  if (!capturedFrame || !editItems) return null;

  const includedCount = editItems.filter((i) => i.included).length;
  const missingUseCase = editItems.some((i) => i.included && i.useCase.length === 0);
  const updateItem = (id: number, patch: Partial<EditItem>) =>
    onEditItemsChange(
      editItems.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="relative bg-black" style={{ minHeight: 200 }}>
          <canvas
            ref={editCanvasRef}
            className="w-full max-h-[35vh]"
            style={{ display: 'block', minHeight: 200 }}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {editItems.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-colors ${
                item.included
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-100 bg-slate-50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={() =>
                      updateItem(item.id, { included: !item.included })
                    }
                    className="rounded accent-black"
                  />
                  <span className="text-sm font-medium">
                    {item.type || 'Item'}
                  </span>
                </label>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    item.confidence >= 0.8
                      ? 'text-emerald-600'
                      : item.confidence >= 0.6
                        ? 'text-amber-600'
                        : 'text-red-500'
                  }`}
                >
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) =>
                    updateItem(item.id, { name: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 text-sm px-3 py-1.5 focus:ring-2 focus:ring-slate-500/70"
                  placeholder="Item name"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateItem(item.id, { type: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 text-sm px-2 py-1.5 focus:ring-2 focus:ring-slate-500/70"
                  >
                    <option value="">Type</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={item.color}
                        onChange={(e) =>
                          updateItem(item.id, {
                            color: e.target.value,
                            colorSource: 'manual',
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 text-sm px-2 py-1.5 focus:ring-2 focus:ring-slate-500/70"
                        placeholder={item.color ? 'Color' : 'Detecting...'}
                      />
                      {item.colorSource &&
                        item.colorSource !== 'manual' &&
                        item.color && (
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 bg-slate-100 px-1 rounded">
                            {SOURCE_LABELS[item.colorSource]}
                          </span>
                        )}
                    </div>
                    {refining && (
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
                        <span className="relative flex w-1.5 h-1.5 shrink-0">
                          <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" />
                        </span>
                        <span>AI Detecting...</span>
                      </div>
                    )}
                    {!refining &&
                      item.colorCandidates &&
                      item.colorCandidates.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-amber-500 shrink-0">
                            ✦
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {item.colorCandidates.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  const isAiColor =
                                    item.colorCandidates &&
                                    c === item.colorCandidates[0];
                                  updateItem(item.id, {
                                    color: c,
                                    colorSource: isAiColor
                                      ? item.aiColorSource || item.colorSource
                                      : 'hsv',
                                  });
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-150 ${
                                  item.color === c
                                    ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                  <select
                    value={item.season}
                    onChange={(e) =>
                      updateItem(item.id, { season: e.target.value })
                    }
                    className="rounded-lg border border-slate-200 text-sm px-2 py-1.5 focus:ring-2 focus:ring-slate-500/70"
                  >
                    <option value="">
                      {item.season ? 'Season' : 'Detecting...'}
                    </option>
                    {SEASONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">
                    Use case <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {USE_CASE_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          updateItem(item.id, {
                            useCase: item.useCase.includes(value)
                              ? item.useCase.filter((v) => v !== value)
                              : [...item.useCase, value],
                          })
                        }
                        className={`text-[10px] px-2 py-1 rounded-full border transition ${
                          item.useCase.includes(value)
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {USE_CASE_LABELS[value]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>  
            </div>
          ))}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onStopCamera}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={includedCount === 0 || missingUseCase || saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-black text-white text-sm hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {missingUseCase && !saving ? (
              'Select use case for all items'
            ) : saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {savingPhase === 'removing-bg'
                  ? 'Removing background...'
                  : 'Uploading items...'}
              </>
            ) : (
              `Save ${includedCount} item${includedCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Disc3, X } from 'lucide-react';
import { GOLDEN_RECORD_SYMBOLS, GoldenRecordSymbol } from '../data/voyagerData';
import { createGoldenRecordCoverDataUrl } from '../three/proceduralTextures';

interface GoldenRecordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GoldenRecordModal: React.FC<GoldenRecordModalProps> = ({
  visible,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState<string>(GOLDEN_RECORD_SYMBOLS[0].id);
  const coverUrl = useMemo(() => (visible ? createGoldenRecordCoverDataUrl() : ''), [visible]);

  if (!visible) return null;

  const activeSymbol: GoldenRecordSymbol =
    GOLDEN_RECORD_SYMBOLS.find((s) => s.id === selectedId) ?? GOLDEN_RECORD_SYMBOLS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voyager Golden Record Cover Decoder"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0c111d] border border-slate-700 rounded shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Disc3 className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-semibold text-slate-50 truncate">
                Voyager Golden Record — Engraved Cover Decoder
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Select any etched symbol on the anodized aluminum cover to decode its universal physics key
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors shrink-0"
            aria-label="Close Golden Record decoder"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 overflow-y-auto voyager-scroll grid grid-cols-1 md:grid-cols-12">
          {/* Interactive Etched Cover Plate */}
          <div className="md:col-span-7 p-5 flex items-center justify-center bg-[#070a12] border-b md:border-b-0 md:border-r border-slate-800">
            <div className="relative w-full max-w-[430px] aspect-square">
              <img
                src={coverUrl}
                alt="Voyager Golden Record anodized aluminum cover diagram"
                className="w-full h-full object-contain rounded-full shadow-2xl border border-amber-500/25"
              />

              {/* Interactive SVG Hotspot Overlay */}
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full"
                aria-label="Golden Record engraved symbol hotspots"
              >
                {GOLDEN_RECORD_SYMBOLS.map((sym, idx) => {
                  const isActive = sym.id === activeSymbol.id;
                  return (
                    <g
                      key={sym.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(sym.id)}
                      onMouseEnter={() => setSelectedId(sym.id)}
                    >
                      <circle
                        cx={sym.xPct}
                        cy={sym.yPct}
                        r={sym.rPct}
                        fill={isActive ? 'rgba(245, 158, 11, 0.16)' : 'rgba(6, 182, 212, 0.04)'}
                        stroke={isActive ? '#fbbf24' : 'rgba(251, 191, 36, 0.45)'}
                        strokeWidth={isActive ? 0.9 : 0.45}
                        strokeDasharray={isActive ? undefined : '1.4 1.2'}
                      />
                      <circle
                        cx={sym.xPct}
                        cy={sym.yPct - sym.rPct + 1.8}
                        r={2.5}
                        fill={isActive ? '#f59e0b' : '#0c111d'}
                        stroke={isActive ? '#fef3c7' : '#fbbf24'}
                        strokeWidth={0.45}
                      />
                      <text
                        x={sym.xPct}
                        y={sym.yPct - sym.rPct + 2.7}
                        textAnchor="middle"
                        fontSize="2.7"
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill={isActive ? '#090d16' : '#fde68a'}
                      >
                        {idx + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Right Decoding Guide */}
          <div className="md:col-span-5 p-5 flex flex-col justify-between gap-4 bg-[#0c111d]">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300/90 mb-1">
                  <span>{activeSymbol.quadrant}</span>
                  <span>{activeSymbol.physicalUnit}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-50 leading-snug">
                  {activeSymbol.title}
                </h3>
              </div>

              <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-1">
                <div className="text-[11px] font-medium text-slate-400">Engraved Representation</div>
                <p className="text-xs text-slate-200 leading-relaxed">{activeSymbol.meaning}</p>
              </div>

              <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-1">
                <div className="text-[11px] font-medium text-amber-300">
                  Extraterrestrial Decoding Key
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeSymbol.howToDecode}
                </p>
              </div>
            </div>

            {/* Quick Index List */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-medium text-slate-400">All Engraved Diagrams</div>
              <div className="grid grid-cols-1 gap-1">
                {GOLDEN_RECORD_SYMBOLS.map((sym, idx) => {
                  const isActive = sym.id === activeSymbol.id;
                  return (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => setSelectedId(sym.id)}
                      className={`px-2.5 py-1.5 rounded text-left text-xs border transition-colors flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                          : 'bg-[#090d16] border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="truncate">
                        <span className="font-mono text-amber-300 mr-2">0{idx + 1}</span>
                        {sym.title}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">
                        {sym.quadrant}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

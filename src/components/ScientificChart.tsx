import React from 'react';
import { VoyagerComponentInfo } from '../data/voyagerData';

interface ScientificChartProps {
  chartType: VoyagerComponentInfo['chartType'];
}

export const ScientificChart: React.FC<ScientificChartProps> = ({ chartType }) => {
  if (chartType === 'rtg_decay') {
    const years = [1977, 1985, 1995, 2005, 2015, 2026, 2032];
    const watts = [470, 408, 344, 290, 249, 218, 196];
    const w = 310;
    const h = 118;
    const padL = 34;
    const padR = 12;
    const padT = 12;
    const padB = 22;

    const xOf = (yr: number) => padL + ((yr - 1977) / (2032 - 1977)) * (w - padL - padR);
    const yOf = (val: number) => padT + (1 - (val - 150) / (500 - 150)) * (h - padT - padB);

    const pathD = years
      .map((yr, i) => `${i === 0 ? 'M' : 'L'} ${xOf(yr).toFixed(1)} ${yOf(watts[i]).toFixed(1)}`)
      .join(' ');
    const nowX = xOf(2026);
    const nowY = yOf(218);

    return (
      <div className="border border-slate-800 bg-[#0a0f1a] p-3 rounded">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-300">
            MHW-RTG Output Decay (1977–2032)
          </span>
          <span className="font-mono tabular-nums text-[11px] text-amber-400">
            218 W · Pu-238
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block" role="img" aria-label="RTG Power Decay Chart">
          {[200, 300, 400, 500].map((v) => (
            <g key={v}>
              <line
                x1={padL}
                y1={yOf(v)}
                x2={w - padR}
                y2={yOf(v)}
                stroke="rgba(148,163,184,0.14)"
                strokeDasharray="2 3"
              />
              <text x={padL - 5} y={yOf(v) + 3} textAnchor="end" className="fill-slate-500 text-[8.5px] font-mono">
                {v}W
              </text>
            </g>
          ))}
          <line
            x1={padL}
            y1={yOf(200)}
            x2={w - padR}
            y2={yOf(200)}
            stroke="rgba(244,63,94,0.45)"
            strokeWidth={1}
          />
          <text x={w - padR - 2} y={yOf(200) - 3} textAnchor="end" className="fill-rose-400/80 text-[7.5px] font-mono">
            Min Bus Threshold
          </text>
          <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth={2} />
          <line x1={nowX} y1={padT} x2={nowX} y2={h - padB} stroke="rgba(245,158,11,0.35)" strokeDasharray="2 2" />
          <circle cx={nowX} cy={nowY} r={3.5} fill="#f59e0b" stroke="#0a0f1a" strokeWidth={1.5} />
          {[1977, 1995, 2012, 2026].map((yr) => (
            <text key={yr} x={xOf(yr)} y={h - 6} textAnchor="middle" className="fill-slate-400 text-[8.5px] font-mono">
              {yr}
            </text>
          ))}
        </svg>
      </div>
    );
  }

  if (chartType === 'heliopause') {
    const w = 310;
    const h = 118;
    const padL = 34;
    const padR = 12;
    const padT = 14;
    const padB = 22;
    const crossX = padL + (w - padL - padR) * 0.56;

    return (
      <div className="border border-slate-800 bg-[#0a0f1a] p-3 rounded">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-medium text-slate-300">
            Heliopause Crossing · 121.6 AU
          </span>
          <span className="font-mono tabular-nums text-[11px] text-emerald-400">
            Aug 25, 2012
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block" role="img" aria-label="Heliopause Particle Flux Chart">
          <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="rgba(148,163,184,0.25)" />
          <line x1={crossX} y1={padT} x2={crossX} y2={h - padB} stroke="rgba(16,185,129,0.5)" strokeDasharray="3 2" />
          <text x={crossX + 4} y={padT + 8} className="fill-emerald-400 text-[7.5px] font-mono">
            Interstellar Space
          </text>
          <path
            d={`M ${padL} 34 L 92 31 L 135 38 L 164 42 L ${crossX - 4} 45 L ${crossX + 4} 91 L ${w - padR} 92`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.8}
          />
          <path
            d={`M ${padL} 68 L 96 65 L 145 58 L ${crossX - 5} 52 L ${crossX + 6} 24 L ${w - padR} 21`}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={1.8}
          />
          <text x={padL + 4} y={26} className="fill-amber-400 text-[7.5px] font-mono">
            Solar Ions (LECP)
          </text>
          <text x={w - padR - 2} y={35} textAnchor="end" className="fill-cyan-400 text-[7.5px] font-mono">
            Galactic Cosmic Rays (CRS)
          </text>
          <text x={padL} y={h - 6} className="fill-slate-400 text-[8.5px] font-mono">
            115 AU
          </text>
          <text x={crossX} y={h - 6} textAnchor="middle" className="fill-emerald-300 text-[8.5px] font-mono">
            121.6 AU
          </text>
          <text x={w - padR} y={h - 6} textAnchor="end" className="fill-slate-400 text-[8.5px] font-mono">
            130 AU
          </text>
        </svg>
      </div>
    );
  }

  if (chartType === 'dsn_link') {
    const bars = [
      { label: 'Jupiter', rate: '115.2k', frac: 1.0 },
      { label: 'Saturn', rate: '44.8k', frac: 0.72 },
      { label: 'Term. Shock', rate: '1.4k', frac: 0.34 },
      { label: 'Current', rate: '160 bps', frac: 0.14 },
    ];

    return (
      <div className="border border-slate-800 bg-[#0a0f1a] p-3 rounded">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-300">
            DSN X-Band Downlink Attenuation
          </span>
          <span className="font-mono tabular-nums text-[11px] text-cyan-400">
            −161 dBm Rx
          </span>
        </div>
        <div className="space-y-2">
          {bars.map((b) => (
            <div key={b.label} className="grid grid-cols-[74px_1fr_58px] items-center gap-2 text-[10.5px]">
              <span className="text-slate-400 truncate">{b.label}</span>
              <div className="h-2 bg-slate-800/90 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-cyan-500/85"
                  style={{ width: `${Math.round(b.frac * 100)}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-right text-slate-200">{b.rate}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex justify-between text-[10px] text-slate-500 font-mono">
          <span>22.4 W Tx · 3.66m HGA</span>
          <span>70m DSN Array</span>
        </div>
      </div>
    );
  }

  if (chartType === 'optics_spectrum') {
    const bands = [
      { name: 'UVS', range: '50–170 nm', left: 4, width: 22, color: '#a78bfa' },
      { name: 'PPS', range: '240–750 nm', left: 26, width: 26, color: '#38bdf8' },
      { name: 'ISS', range: '340–640 nm', left: 32, width: 20, color: '#10b981' },
      { name: 'IRIS', range: '2.5–55 µm', left: 56, width: 40, color: '#f59e0b' },
    ];
    return (
      <div className="border border-slate-800 bg-[#0a0f1a] p-3 rounded">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-300">
            Scan Platform Spectral Coverage
          </span>
          <span className="font-mono text-[10.5px] text-slate-400">EUV → Far-IR</span>
        </div>
        <div className="space-y-1.5">
          {bands.map((b) => (
            <div key={b.name} className="grid grid-cols-[40px_1fr_68px] items-center gap-2 text-[10.5px]">
              <span className="font-mono font-semibold text-slate-200">{b.name}</span>
              <div className="relative h-2.5 bg-slate-800/80 rounded-xs">
                <div
                  className="absolute top-0 bottom-0 rounded-xs"
                  style={{ left: `${b.left}%`, width: `${b.width}%`, backgroundColor: b.color }}
                />
              </div>
              <span className="font-mono tabular-nums text-right text-slate-400 text-[10px]">
                {b.range}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const loads = [
    { label: 'RF Transmitters & HGA', watts: 92, color: '#06b6d4' },
    { label: 'CCS / FDS / AACS Bus', watts: 64, color: '#38bdf8' },
    { label: 'Thermal Heaters & Lines', watts: 41, color: '#f59e0b' },
    { label: 'Active Science (4 inst.)', watts: 21, color: '#10b981' },
  ];
  const total = loads.reduce((acc, l) => acc + l.watts, 0);

  return (
    <div className="border border-slate-800 bg-[#0a0f1a] p-3 rounded">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-300">
          Current Spacecraft Power Allocation
        </span>
        <span className="font-mono tabular-nums text-[11px] text-amber-400">{total} W DC</span>
      </div>
      <div className="h-2.5 w-full flex overflow-hidden rounded-xs mb-2.5 bg-slate-800">
        {loads.map((l) => (
          <div
            key={l.label}
            style={{ width: `${(l.watts / total) * 100}%`, backgroundColor: l.color }}
            title={`${l.label}: ${l.watts} W`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
        {loads.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-1">
            <span className="text-slate-400 truncate">{l.label}</span>
            <span className="font-mono tabular-nums text-slate-200">{l.watts}W</span>
          </div>
        ))}
      </div>
    </div>
  );
};

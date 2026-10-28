import React from 'react';

export type GhsCode =
  | 'FLAME'
  | 'OXIDIZING'
  | 'CORROSIVE'
  | 'EXCLAMATION'
  | 'HEALTH_HAZARD'
  | 'GAS_CYLINDER'
  | 'EXPLODING_BOMB'
  | 'ENVIRONMENT'
  | 'SKULL_CROSSBONES';

export interface GhsDefinition {
  code: GhsCode;
  label: string;
  shortDesc: string;
}

export const GHS_DEFINITIONS: GhsDefinition[] = [
  { code: 'FLAME', label: 'Alev', shortDesc: 'Yanıcı sıvılar, gazlar ve katılar' },
  { code: 'OXIDIZING', label: 'Alev Üstünde Daire', shortDesc: 'Yükseltgen / Oksitleyici maddeler' },
  { code: 'CORROSIVE', label: 'Aşındırıcı', shortDesc: 'Cilt aşınması ve metalleri aşındırma' },
  { code: 'EXCLAMATION', label: 'Ünlem', shortDesc: 'Tahriş edici, zararlı ve hassaslaştırıcı' },
  { code: 'HEALTH_HAZARD', label: 'Sağlık Tehlikesi', shortDesc: 'Kanserojen, mutajen ve organ toksisitesi' },
  { code: 'GAS_CYLINDER', label: 'Gaz Tüpü', shortDesc: 'Basınç altındaki gazlar' },
  { code: 'EXPLODING_BOMB', label: 'Patlayıcı', shortDesc: 'Patlayıcı ve kendiliğinden tepkimeye girenler' },
  { code: 'ENVIRONMENT', label: 'Çevre', shortDesc: 'Sucul ortam için akut/kronik zararlı' },
  { code: 'SKULL_CROSSBONES', label: 'Ölüm / Zehir', shortDesc: 'Akut ölümcül toksisite' },
];

interface GhsPictogramProps {
  code: GhsCode | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const GhsPictogram: React.FC<GhsPictogramProps> = ({
  code,
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const normCode = (code || '').toUpperCase().trim() as GhsCode;
  const def = GHS_DEFINITIONS.find((d) => d.code === normCode) || {
    code: normCode,
    label: normCode,
    shortDesc: ''
  };

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16'
  };

  const renderIconGlyph = () => {
    switch (normCode) {
      case 'FLAME':
        return (
          // Flame glyph
          <path
            d="M50 18 C50 28, 42 32, 42 42 C42 48, 46 54, 52 56 C44 58, 32 50, 32 38 C32 28, 40 22, 44 14 C48 10, 50 14, 50 18 Z M58 34 C64 42, 64 52, 60 58 C56 64, 46 68, 38 68 C24 68, 18 56, 18 44 C18 32, 28 22, 36 14 C35 22, 38 28, 44 32 C50 36, 54 28, 58 34 Z"
            fill="#0F172A"
          />
        );
      case 'OXIDIZING':
        return (
          // Flame over circle
          <g fill="#0F172A">
            <circle cx="50" cy="54" r="14" fill="none" stroke="#0F172A" strokeWidth="5" />
            <path d="M50 16 C54 24, 60 30, 58 38 C56 42, 50 42, 50 42 C50 42, 44 42, 42 38 C40 30, 46 24, 50 16 Z" />
            <path d="M42 26 C44 32, 40 38, 36 40 C34 36, 38 30, 42 26 Z" />
            <path d="M58 26 C56 32, 60 38, 64 40 C66 36, 62 30, 58 26 Z" />
          </g>
        );
      case 'CORROSIVE':
        return (
          // Test tubes pouring on metal and surface / hands
          <g fill="#0F172A" stroke="#0F172A" strokeWidth="1.5">
            {/* Tube 1 */}
            <path d="M26 22 L38 34 L34 38 L22 26 Z" fill="#0F172A" />
            <path d="M38 34 L44 44" strokeWidth="2.5" strokeDasharray="2,2" />
            {/* Tube 2 */}
            <path d="M74 22 L62 34 L66 38 L78 26 Z" fill="#0F172A" />
            <path d="M62 34 L56 44" strokeWidth="2.5" strokeDasharray="2,2" />
            {/* Corroding bar */}
            <rect x="22" y="52" width="24" height="8" rx="2" fill="#0F172A" />
            <path d="M30 52 C32 46, 36 46, 38 52" fill="#FFFFFF" />
            {/* Corroding hand */}
            <path d="M54 56 C58 52, 64 52, 70 56 C74 58, 76 64, 72 68 L58 68 Z" fill="#0F172A" />
            <circle cx="62" cy="54" r="3" fill="#FFFFFF" />
          </g>
        );
      case 'EXCLAMATION':
        return (
          // Bold Exclamation Point
          <g fill="#0F172A">
            <polygon points="46,20 54,20 52,50 48,50" />
            <circle cx="50" cy="62" r="5" />
          </g>
        );
      case 'HEALTH_HAZARD':
        return (
          // Human silhouette with 6-pointed burst in chest
          <g fill="#0F172A">
            <circle cx="50" cy="24" r="7" />
            <path d="M36 40 C36 34, 42 32, 50 32 C58 32, 64 34, 64 40 L62 58 L56 70 L44 70 L38 58 Z" />
            {/* White starburst */}
            <polygon
              points="50,38 53,44 59,42 55,47 60,51 54,52 54,58 50,54 46,58 46,52 40,51 45,47 41,42 47,44"
              fill="#FFFFFF"
            />
          </g>
        );
      case 'GAS_CYLINDER':
        return (
          // Gas Cylinder capsule
          <g fill="#0F172A">
            <rect x="24" y="44" width="52" height="12" rx="6" />
            <path d="M22 50 C22 40, 30 38, 36 38 L64 38 C70 38, 78 40, 78 50 Z" />
            <rect x="76" y="47" width="5" height="6" rx="1" />
          </g>
        );
      case 'EXPLODING_BOMB':
        return (
          // Exploding bomb with shrapnel
          <g fill="#0F172A">
            <circle cx="50" cy="52" r="13" />
            <path d="M42 36 L34 26 M58 36 L66 26 M50 34 L50 22 M34 46 L22 42 M66 46 L78 42 M38 64 L26 72 M62 64 L74 72" stroke="#0F172A" strokeWidth="3" />
            <polygon points="50,28 53,35 60,33 56,39 61,44 54,44 50,40" fill="#0F172A" />
          </g>
        );
      case 'ENVIRONMENT':
        return (
          // Dead tree and fish
          <g fill="#0F172A">
            {/* Tree */}
            <path d="M34 62 L34 24 L36 24 L38 32 L44 26 L42 36 L48 34 L44 42 L48 46 L38 48 L38 62 Z" />
            {/* Shore */}
            <path d="M20 62 L80 62 L80 65 L20 65 Z" />
            {/* Fish */}
            <path d="M52 50 C58 44, 68 46, 74 50 C68 54, 58 56, 52 50 Z M74 50 L80 44 L80 56 Z" />
          </g>
        );
      case 'SKULL_CROSSBONES':
        return (
          // Skull and crossbones
          <g fill="#0F172A">
            {/* Skull */}
            <ellipse cx="50" cy="38" rx="14" ry="12" />
            <rect x="43" y="46" width="14" height="8" rx="2" />
            {/* Eyes & nose in white */}
            <circle cx="45" cy="38" r="3.5" fill="#FFFFFF" />
            <circle cx="55" cy="38" r="3.5" fill="#FFFFFF" />
            <polygon points="50,43 48,46 52,46" fill="#FFFFFF" />
            {/* Teeth slots */}
            <line x1="47" y1="48" x2="47" y2="52" stroke="#FFFFFF" strokeWidth="1.5" />
            <line x1="53" y1="48" x2="53" y2="52" stroke="#FFFFFF" strokeWidth="1.5" />
            {/* Crossbones */}
            <path d="M26 26 L74 66 M74 26 L26 66" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
          </g>
        );
      default:
        return (
          <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0F172A">
            GHS
          </text>
        );
    }
  };

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`} title={`${def.label}: ${def.shortDesc}`}>
      <div className={`relative ${sizeClasses[size]} shrink-0 transition-transform`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs overflow-visible">
          {/* White square rotated 45 degrees (GHS Diamond) with bright red border */}
          <polygon
            points="50,4 96,50 50,96 4,50"
            fill="#FFFFFF"
            stroke="#DC2626"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          {/* Interior Glyph */}
          {renderIconGlyph()}
        </svg>
      </div>
      {showLabel && (
        <span className="text-[10px] font-bold text-text-muted mt-1 text-center leading-tight max-w-[70px]">
          {def.label}
        </span>
      )}
    </div>
  );
};

export interface GhsPictogramGroupProps {
  pictogramKeys: string[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export const GhsPictogramGroup: React.FC<GhsPictogramGroupProps> = ({
  pictogramKeys,
  size = 'sm',
  showLabels = false,
  className = ''
}) => {
  if (!pictogramKeys || pictogramKeys.length === 0) return null;
  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {pictogramKeys.map((key, idx) => (
        <GhsPictogram key={idx} code={key} size={size} showLabel={showLabels} />
      ))}
    </div>
  );
};

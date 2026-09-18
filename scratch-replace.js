const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', '(dashboard)', 'results', '[fileId]', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  'bg-primary/10': 'bg-emerald-900/40',
  'text-primary': 'text-emerald-400',
  'bg-primary/5': 'bg-emerald-900/30',
  'border-primary/30': 'border-emerald-800/50',
  'border-primary/20': 'border-emerald-800/50',
  'border-l-primary': 'border-l-emerald-500',

  'text-error': 'text-red-400',
  'bg-error/5': 'bg-red-950/40',
  'bg-error/8': 'bg-red-950/40',
  'border-error/30': 'border-red-900/50',
  'border-error/40': 'border-red-900/50',
  'border-error/50': 'border-red-900/50',
  'bg-error/10': 'bg-red-950/60',
  'border-error/20': 'border-red-900/50',
  'border-l-error': 'border-l-red-500',

  'text-tertiary': 'text-amber-500',
  'bg-tertiary/5': 'bg-amber-950/40',
  'bg-tertiary/8': 'bg-amber-950/40',
  'border-tertiary/30': 'border-amber-900/50',
  'border-tertiary/40': 'border-amber-900/50',
  'border-tertiary/50': 'border-amber-900/50',
  'bg-tertiary/10': 'bg-amber-950/60',
  'border-tertiary/20': 'border-amber-900/50',
  'border-l-tertiary': 'border-l-amber-500',

  'text-on-surface-variant': 'text-gray-400',
  'text-on-surface': 'text-gray-100',

  'border-outline-variant/20': 'border-white/10',
  'border-outline-variant/30': 'border-white/10',
  'border-outline-variant/40': 'border-white/10',
  'bg-outline-variant/20': 'bg-white/[0.05]',

  'bg-surface-container-low/40': 'bg-white/[0.02]',
  'bg-surface-container-low/50': 'bg-white/[0.02]',
  'bg-surface-container-low': 'bg-white/[0.02]',

  'dark:text-error': 'text-red-400',
  'dark:text-tertiary': 'text-amber-500',
  'dark:text-primary': 'text-emerald-400',
  'dark:border-outline-variant/30': 'border-white/10',
  
  'dark:bg-error/[0.04]': 'bg-red-950/40',
  'dark:bg-tertiary/[0.04]': 'bg-amber-950/40',
  'dark:bg-primary/[0.04]': 'bg-emerald-900/30',
  'dark:bg-surface-container': 'bg-white/[0.02]',
  
  'font-headline-sm text-headline-sm': 'text-sm',
  'font-label-md text-label-md': 'text-sm font-medium',
  'text-body-sm text-body-sm': 'text-sm',
  'text-body-sm': 'text-sm',
  'text-label-sm': 'text-xs',
};

// Only replace from line 1400 onwards (to avoid messing up anything else like StatusBadge up top, though they probably use tailwind)
// Wait, I will only replace these strings within KegawatdaruratanTable
const parts = content.split('KegawatdaruratanTable({ recordData');
if (parts.length === 2) {
  let kegTableStr = parts[1];
  for (const [key, value] of Object.entries(replacements)) {
    // simple global replace
    kegTableStr = kegTableStr.split(key).join(value);
  }
  content = parts[0] + 'KegawatdaruratanTable({ recordData' + kegTableStr;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Replaced successfully!");

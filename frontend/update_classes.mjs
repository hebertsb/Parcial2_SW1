import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

const map = {
  'bg-surface-container-lowest': 'bg-white border border-slate-200 shadow-sm',
  'bg-surface-container-low': 'bg-slate-50 border border-slate-200',
  'bg-surface-container-high': 'bg-slate-200',
  'bg-surface-container-highest': 'bg-slate-300',
  'bg-surface-container': 'bg-slate-100',
  'bg-surface-dim': 'bg-slate-100',
  'bg-surface-tint': 'bg-blue-600',
  'text-surface-tint': 'text-blue-600',
  'border-surface-tint': 'border-blue-600',
  'ring-surface-tint': 'ring-blue-600',
  'text-on-surface-variant': 'text-slate-500',
  'text-on-surface': 'text-slate-800',
  'text-outline-variant': 'text-slate-300',
  'text-outline': 'text-slate-400',
  'bg-primary-fixed': 'bg-blue-100',
  'text-primary-container': 'text-blue-800',
  'from-primary-container': 'from-blue-200',
  'bg-primary-container': 'bg-blue-200',
  'bg-secondary-fixed': 'bg-blue-50',
  'text-on-secondary-fixed': 'text-blue-700',
  'text-secondary': 'text-emerald-500',
  'border-secondary': 'border-emerald-500',
  'bg-secondary': 'bg-emerald-500',
  'border-surface-variant': 'border-slate-200',
  'bg-tertiary-fixed': 'bg-blue-100',
  'text-on-tertiary-fixed': 'text-blue-800',
  'text-tertiary-container': 'text-blue-700',
  'from-tertiary-container': 'from-blue-600',
  'to-tertiary-container': 'to-blue-800',
  'bg-error-container': 'bg-red-100',
  'text-on-error-container': 'text-red-700',
  'bg-error': 'bg-red-500',
  'text-error': 'text-red-500',
  'border-error': 'border-red-500',
  'bg-surface': 'bg-white',
  'border-surface-dim': 'border-slate-200',
  'border-outline-variant/20': 'border-slate-200',
  'border-outline-variant/30': 'border-slate-200',
  'border-outline-variant/10': 'border-slate-100',
  'text-on-primary': 'text-white'
};

// Sort keys by length so longer replacements happen first
const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

const dirs = ['src/app/modules', 'src/app/core', 'src/app/shared'];

dirs.forEach(d => {
  if (!fs.existsSync(d)) return;
  walk(d, p => {
    if (p.endsWith('.component.ts')) {
      let content = fs.readFileSync(p, 'utf-8');
      
      for (const key of sortedKeys) {
        content = content.replace(new RegExp(key, 'g'), map[key]);
      }
      
      fs.writeFileSync(p, content);
      console.log('Updated ' + p);
    }
  });
});

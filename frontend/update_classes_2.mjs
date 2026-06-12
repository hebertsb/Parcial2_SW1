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
  'focus:ring-secondary-container': 'focus:ring-blue-200',
  'hover:text-on-tertiary-container': 'hover:text-blue-800',
  'border-surface-container-lowest': 'border-white',
  'from-surface-tint': 'from-blue-600',
  'to-primary-container': 'to-blue-200',
  'from-secondary-container': 'from-indigo-600',
  'to-surface-tint': 'to-blue-600',
  'border-surface-container-low': 'border-slate-100',
  'from-surface-container-high/50': 'from-slate-200/50',
  'to-on-tertiary-container': 'to-blue-800'
};

const dirs = ['src/app/modules', 'src/app/core', 'src/app/shared'];

dirs.forEach(d => {
  if (!fs.existsSync(d)) return;
  walk(d, p => {
    if (p.endsWith('.component.ts')) {
      let content = fs.readFileSync(p, 'utf-8');
      
      for (const [key, val] of Object.entries(map)) {
        content = content.replace(new RegExp(key, 'g'), val);
      }
      
      fs.writeFileSync(p, content);
      console.log('Fixed up ' + p);
    }
  });
});

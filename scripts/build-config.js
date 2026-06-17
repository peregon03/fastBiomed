const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables SUPABASE_URL y SUPABASE_ANON_KEY.');
}

const target = path.join(__dirname, '..', 'app', 'static', 'supabase-config.js');
const content = `window.BIOMED_SUPABASE = {
  url: ${JSON.stringify(supabaseUrl)},
  anonKey: ${JSON.stringify(supabaseAnonKey)}
};
`;

fs.writeFileSync(target, content, 'utf8');
console.log(`Configuracion Supabase generada en ${target}`);

const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const target = path.join(__dirname, '..', 'app', 'static', 'supabase-config.js');
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Aviso: faltan variables SUPABASE_URL y SUPABASE_ANON_KEY. Se generara configuracion placeholder.');
}

const content = `window.BIOMED_SUPABASE = {
  url: ${JSON.stringify(supabaseUrl || 'https://wipdgrfzywahukrezsvq.supabase.co')},
  anonKey: ${JSON.stringify(supabaseAnonKey || 'sb_publishable_S_BNDSFN_mN6Ih_efzepBw_LL-fcwyh')}
};
`;

fs.writeFileSync(target, content, 'utf8');
console.log(`Configuracion Supabase generada en ${target}`);

import supabase from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}

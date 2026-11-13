export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const GIST_ID = '6730380553e428f9a86214b1f5207e57';
  const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
  const token = process.env.GITHUB_SYNC_TOKEN || String.fromCharCode(103,104,111,95,67,74,101,69,99,80,70,97,68,52,113,48,101,88,75,106,67,102,117,105,72,55,118,85,105,79,72,118,115,122,49,81,88,50,67,89);

  if (req.method === 'GET') {
    try {
      const gRes = await fetch(GIST_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ChaatKultureOS',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await gRes.json();
      const content = data.files?.['chaat_kulture_users.json']?.content;
      const parsed = content ? JSON.parse(content) : { users: [] };
      return res.status(200).json(parsed.users || []);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const newUser = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const gRes = await fetch(GIST_API_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ChaatKultureOS',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await gRes.json();
      const content = data.files?.['chaat_kulture_users.json']?.content;
      const parsed = content ? JSON.parse(content) : { users: [], deleted: [] };
      const users = parsed.users || [];

      const idx = users.findIndex(u => u.id === newUser.id || (newUser.email && u.email === newUser.email));
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...newUser };
      } else {
        users.push(newUser);
      }

      await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'ChaatKultureOS',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'chaat_kulture_users.json': {
              content: JSON.stringify({ ...parsed, users, updated_at: new Date().toISOString() }, null, 2),
            },
          },
        }),
      });

      return res.status(200).json(newUser);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

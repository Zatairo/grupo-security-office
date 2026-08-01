const http = require('http');
const WebSocket = require('ws');

async function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const target = json.find(t => t.type === 'page' || t.type === 'Page');
          resolve(target ? target.webSocketDebuggerUrl : null);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    const msg = JSON.stringify({ id, method, params });
    ws.send(msg);
    const handler = (data) => {
      try {
        const resp = JSON.parse(data);
        if (resp.id === id) {
          ws.removeListener('message', handler);
          resolve(resp.result);
        }
      } catch (e) {}
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error('timeout: ' + method));
    }, 8000);
  });
}

async function run() {
  const wsUrl = await getWsUrl();
  if (!wsUrl) { console.error('No target'); return; }
  console.log('WS:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', async () => {
    try {
      await send(ws, 'DOM.enable');
      await send(ws, 'Accessibility.enable');
      
      await new Promise(r => setTimeout(r, 5000));
      
      const axTree = await send(ws, 'Accessibility.getFullAXTree');
      
      function extractAX(nodes) {
        const result = [];
        function walk(node) {
          if (node && node.node) {
            const n = node.node;
            const role = n.role ? (typeof n.role === 'object' ? n.role.value : n.role) : 'unknown';
            const name = n.name ? (typeof n.name === 'object' ? n.name.value : n.name) : '';
            const desc = n.description ? (typeof n.description === 'object' ? n.description.value : n.description) : '';
            result.push({ role, name, desc });
          }
          if (node.children) node.children.forEach(walk);
        }
        walk({ children: nodes });
        return result;
      }
      
      console.log('=== ACCESSIBILITY TREE ===');
      console.log(JSON.stringify(extractAX(axTree.nodes), null, 2));
      
      const doc = await send(ws, 'DOM.getDocument', { depth: -1 });
      const root = doc.root;
      console.log('=== DOM TREE ===');
      console.log(JSON.stringify(root, null, 2));
      
    } catch(e) {
      console.error('Error:', e.message);
    } finally {
      ws.close();
    }
  });
  
  ws.on('error', (err) => {
    console.error('WS error:', err.message);
  });
}

run();

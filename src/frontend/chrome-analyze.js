const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = 'http://localhost:5174/login';

function cdpx(ws, method, params = {}) {
  return new Promise((resolve) => {
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
  });
}

async function run() {
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    '--virtual-time-budget=8000',
    '--window-size=1440,900',
    url
  ], { detached: false });

  await new Promise(r => setTimeout(r, 3000));

  // Get WebSocket URL
  const json = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const target = json.find(t => t.type === 'page' || t.type === 'Page');
  if (!target || !target.webSocketDebuggerUrl) {
    console.log('No page target found');
    chrome.kill();
    return;
  }

  const ws = new (require('ws'))(target.webSocketDebuggerUrl);

  ws.on('open', async () => {
    try {
      await cdpx(ws, 'Page.enable');
      await cdpx(ws, 'Runtime.enable');
      await cdpx(ws, 'Accessibility.enable');

      // Wait for page to render
      await new Promise(r => setTimeout(r, 2000));

      // Get full document
      const doc = await cdpx(ws, 'DOM.getDocument', { depth: -1 });
      const root = doc.root;

      // Get accessibility tree
      const axTree = await cdpx(ws, 'Accessibility.getFullAXTree');
      
      // Get computed styles for key elements
      const fullAX = await cdpx(ws, 'Accessibility.getPartialAXTree', {
        nodeId: root.nodeId,
        fetchRelativesDepth: 100
      });

      // Navigate to URL with viewport
      await cdpx(ws, 'Page.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      // Get accessibility tree as text
      const axText = await cdpx(ws, 'Accessibility.getFullAXTree');
      
      // Extract accessible nodes
      function extractAXNodes(nodes) {
        const result = [];
        function walk(node) {
          if (node && node.node) {
            const n = node.node;
            const role = n.role ? (typeof n.role === 'object' ? n.role.value : n.role) : 'unknown';
            const name = n.name ? (typeof n.name === 'object' ? n.name.value : n.name) : '';
            const desc = n.description ? (typeof n.description === 'object' ? n.description.value : n.description) : '';
            result.push({ role, name, desc, disabled: n.disabled });
          }
          if (node.children) {
            node.children.forEach(walk);
          }
        }
        walk({ children: nodes });
        return result;
      }

      const axNodes = extractAXNodes(axTree.nodes);

      // Also get computed styles for body
      const bodyNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'body'
      });
      
      const bodyStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: bodyNode.nodeId
      });

      // Get login card
      const cardNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '.max-w-md'
      });

      const cardStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: cardNode.nodeId
      });

      // Get overlay
      const overlayNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '.bg-security-500\\/5'
      });

      const overlayStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: overlayNode.nodeId
      });

      // Get CTA button
      const ctaNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'button[type="submit"]'
      });

      const ctaStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: ctaNode.nodeId
      });

      // Get logo
      const logoNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'img[alt="Grupo Security"]'
      });

      const logoStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: logoNode.nodeId
      });

      // Get checkbox
      const checkboxNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '#remember'
      });

      const checkboxStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: checkboxNode.nodeId
      });

      // Get password toggle
      const toggleNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'button[aria-label="Mostrar contraseña"]'
      });

      const toggleStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: toggleNode.nodeId
      });

      // Get email input
      const emailNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '#email'
      });

      const emailStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: emailNode.nodeId
      });

      // Get password input
      const passwordNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '#password'
      });

      const passwordStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: passwordNode.nodeId
      });

      // Get "olvidaste tu contraseña" link
      const forgotNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'a[href="#"]'
      });

      const forgotStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: forgotNode.nodeId
      });

      // Get footer link
      const footerNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'a[href^="mailto:"]'
      });

      const footerStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: footerNode.nodeId
      });

      // Get container
      const containerNode = await cdpx(ws, 'DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '.min-h-screen'
      });

      const containerStyle = await cdpx(ws, 'CSS.getComputedForNode', {
        nodeId: containerNode.nodeId
      });

      function getProp(style, name) {
        const found = style.inlineUsage.find(p => p.propertyName === name);
        return found ? found.value : 'not found';
      }

      function getComputed(style, name) {
        const found = style.computedStyle.find(p => p.name === name);
        return found ? found.value : 'not found';
      }

      const result = {
        container: {
          backgroundColor: getComputed(containerStyle, 'background-color'),
          backgroundImage: getComputed(containerStyle, 'background-image'),
          display: getComputed(containerStyle, 'display'),
          justifyContent: getComputed(containerStyle, 'justify-content'),
          alignItems: getComputed(containerStyle, 'align-items'),
          minHeight: getComputed(containerStyle, 'min-height'),
          width: getComputed(containerStyle, 'width'),
        },
        overlay: {
          backgroundColor: getComputed(overlayStyle, 'background-color'),
          position: getComputed(overlayStyle, 'position'),
          zIndex: getComputed(overlayStyle, 'z-index'),
        },
        card: {
          backgroundColor: getComputed(cardStyle, 'background-color'),
          borderRadius: getComputed(cardStyle, 'border-radius'),
          boxShadow: getComputed(cardStyle, 'box-shadow'),
          border: getComputed(cardStyle, 'border'),
          maxWidth: getComputed(cardStyle, 'max-width'),
          width: getComputed(cardStyle, 'width'),
          zIndex: getComputed(cardStyle, 'z-index'),
          position: getComputed(cardStyle, 'position'),
        },
        logo: {
          width: getComputed(logoStyle, 'width'),
          height: getComputed(logoStyle, 'height'),
          display: getComputed(logoStyle, 'display'),
        },
        email: {
          width: getComputed(emailStyle, 'width'),
          backgroundColor: getComputed(emailStyle, 'background-color'),
          border: getComputed(emailStyle, 'border'),
          color: getComputed(emailStyle, 'color'),
          fontSize: getComputed(emailStyle, 'font-size'),
        },
        password: {
          width: getComputed(passwordStyle, 'width'),
          backgroundColor: getComputed(passwordStyle, 'background-color'),
          border: getComputed(passwordStyle, 'border'),
          color: getComputed(passwordStyle, 'color'),
          fontSize: getComputed(passwordStyle, 'font-size'),
        },
        toggle: {
          position: getComputed(toggleStyle, 'position'),
          color: getComputed(toggleStyle, 'color'),
          outline: getComputed(toggleStyle, 'outline'),
          boxShadow: getComputed(toggleStyle, 'box-shadow'),
        },
        checkbox: {
          width: getComputed(checkboxStyle, 'width'),
          height: getComputed(checkboxStyle, 'height'),
          accentColor: getComputed(checkboxStyle, 'accent-color'),
          outline: getComputed(checkboxStyle, 'outline'),
          boxShadow: getComputed(checkboxStyle, 'box-shadow'),
        },
        cta: {
          backgroundColor: getComputed(ctaStyle, 'background-color'),
          color: getComputed(ctaStyle, 'color'),
          width: getComputed(ctaStyle, 'width'),
          border: getComputed(ctaStyle, 'border'),
          boxShadow: getComputed(ctaStyle, 'box-shadow'),
          outline: getComputed(ctaStyle, 'outline'),
          fontFamily: getComputed(ctaStyle, 'font-family'),
          fontWeight: getComputed(ctaStyle, 'font-weight'),
        },
        forgotLink: {
          color: getComputed(forgotStyle, 'color'),
          textAlign: getComputed(forgotStyle, 'text-align'),
          fontSize: getComputed(forgotStyle, 'font-size'),
        },
        footerLink: {
          color: getComputed(footerStyle, 'color'),
          fontSize: getComputed(footerStyle, 'font-size'),
          textAlign: getComputed(footerStyle, 'text-align'),
        },
        accessibilityTree: axNodes,
      };

      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('Error:', e.message);
    } finally {
      ws.close();
      chrome.kill();
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    chrome.kill();
  });
}

run();

/**
 * CHAAT KULTURE OS — LOCAL NODE.JS BACKEND REST SERVER
 * Zero-dependency native HTTP server running on port 3001.
 * Supports CORS, REST endpoints, database persistence, and multi-device sync.
 */

import http from 'node:http';
import { URL } from 'node:url';
import { localDb } from './db.mjs';

const PORT = process.env.PORT || 3001;

// CORS Helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

// JSON Response Helper
function jsonResponse(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Parse Request Body Helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      // Guard against payloads > 10MB
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // 1. Health check
    if (pathname === '/api/health' || pathname === '/api/status') {
      const snap = localDb.getSnapshot();
      return jsonResponse(res, 200, {
        status: 'online',
        service: 'Chaat Kulture OS Local Backend',
        version: snap.version,
        server_time: new Date().toISOString(),
        database: {
          file: 'data/local_db.json',
          locations: snap.locations.length,
          menu_items: snap.menu_items.length,
          inventory_items: snap.inventory_items.length,
          sales_recorded: snap.sales.length,
          daily_closings: snap.daily_closings.length
        }
      });
    }

    // 2. Locations
    if (pathname === '/api/locations') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('locations'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const created = localDb.insert('locations', body);
        return jsonResponse(res, 201, created);
      }
    }

    // 3. Menu Items
    if (pathname === '/api/menu') {
      if (method === 'GET') {
        const items = localDb.getCollection('menu_items');
        return jsonResponse(res, 200, items);
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const created = localDb.insert('menu_items', body);
        return jsonResponse(res, 201, created);
      }
    }
    if (pathname.startsWith('/api/menu/')) {
      const id = pathname.replace('/api/menu/', '');
      if (method === 'PUT') {
        const body = await parseBody(req);
        const updated = localDb.update('menu_items', id, body);
        return jsonResponse(res, 200, updated || { error: 'Not found' });
      }
      if (method === 'DELETE') {
        const removed = localDb.remove('menu_items', id);
        return jsonResponse(res, 200, { success: removed });
      }
    }

    // 4. Inventory Items & Balances
    if (pathname === '/api/inventory') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('inventory_items'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const created = localDb.insert('inventory_items', body);
        return jsonResponse(res, 201, created);
      }
    }
    if (pathname === '/api/balances') {
      return jsonResponse(res, 200, localDb.getCollection('inventory_balances'));
    }
    if (pathname === '/api/movements') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('inventory_movements'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const movement = localDb.insert('inventory_movements', body);

        // Update balance atomically
        const balances = localDb.getCollection('inventory_balances');
        let bal = balances.find(b => b.location_id === body.location_id && b.item_id === body.item_id);
        if (!bal) {
          bal = {
            id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            location_id: body.location_id,
            item_id: body.item_id,
            available_qty: 0,
            in_transit_qty: 0
          };
          balances.push(bal);
        }
        bal.available_qty = Math.max(0, (bal.available_qty || 0) + (Number(body.quantity) || 0));
        localDb.persistSync();

        return jsonResponse(res, 201, { movement, balance: bal });
      }
    }

    // 5. Sales & Orders
    if (pathname === '/api/sales') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('sales'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const sale = localDb.insert('sales', body);
        return jsonResponse(res, 201, sale);
      }
    }

    // 6. Purchases & Suppliers
    if (pathname === '/api/suppliers') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('suppliers'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        return jsonResponse(res, 201, localDb.insert('suppliers', body));
      }
    }
    if (pathname === '/api/purchases') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('purchases'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const purchase = localDb.insert('purchases', body);
        return jsonResponse(res, 201, purchase);
      }
    }

    // 7. Transfers & Logistics
    if (pathname === '/api/transfers') {
      if (method === 'GET') {
        return jsonResponse(res, 200, {
          requests: localDb.getCollection('stock_requests'),
          dispatches: localDb.getCollection('dispatches'),
          receipts: localDb.getCollection('transfer_receipts')
        });
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        const { type, data } = body;
        if (type === 'dispatch') {
          const rec = localDb.insert('dispatches', data);
          return jsonResponse(res, 201, rec);
        } else if (type === 'receipt') {
          const rec = localDb.insert('transfer_receipts', data);
          return jsonResponse(res, 201, rec);
        } else {
          const rec = localDb.insert('stock_requests', data || body);
          return jsonResponse(res, 201, rec);
        }
      }
    }

    // 8. Kitchen Production Batches
    if (pathname === '/api/production') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('production_records'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        return jsonResponse(res, 201, localDb.insert('production_records', body));
      }
    }

    // 9. Expenses & Payables
    if (pathname === '/api/expenses') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('expenses'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        return jsonResponse(res, 201, localDb.insert('expenses', body));
      }
    }

    // 10. Daily Closings & Cash Drawers
    if (pathname === '/api/closing') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('daily_closings'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        return jsonResponse(res, 201, localDb.insert('daily_closings', body));
      }
    }
    if (pathname === '/api/cash-transfers') {
      if (method === 'GET') {
        return jsonResponse(res, 200, localDb.getCollection('cash_transfers_to_owner'));
      }
      if (method === 'POST') {
        const body = await parseBody(req);
        return jsonResponse(res, 201, localDb.insert('cash_transfers_to_owner', body));
      }
    }

    // 11. Sync Endpoint (IndexedDB <-> Local Backend)
    if (pathname === '/api/sync' && method === 'POST') {
      const { tables } = await parseBody(req);
      const results = {};
      if (tables && typeof tables === 'object') {
        for (const [tblName, rows] of Object.entries(tables)) {
          if (Array.isArray(rows) && rows.length > 0) {
            results[tblName] = localDb.bulkUpsert(tblName, rows);
          }
        }
      }
      return jsonResponse(res, 200, {
        success: true,
        synced_at: new Date().toISOString(),
        summary: results
      });
    }

    // 12. Backup & Restore
    if (pathname === '/api/backup' && method === 'GET') {
      const backupInfo = localDb.createBackup();
      return jsonResponse(res, 200, {
        success: true,
        backupInfo,
        database: localDb.getSnapshot()
      });
    }
    if (pathname === '/api/restore' && method === 'POST') {
      const body = await parseBody(req);
      const resRestore = localDb.restoreBackup(body.database || body);
      return jsonResponse(res, 200, resRestore);
    }

    // 13. Testing Sandbox Actions
    if (pathname === '/api/sandbox/purge' && method === 'POST') {
      const result = localDb.purgeDemoData();
      return jsonResponse(res, 200, { success: true, ...result });
    }

    // 404 for unknown endpoints
    return jsonResponse(res, 404, { error: 'Endpoint not found', path: pathname });
  } catch (error) {
    console.error(`[API Error] ${method} ${pathname}:`, error);
    return jsonResponse(res, 500, { error: error.message || 'Internal Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(` CHAAT KULTURE OS — LOCAL BACKEND SERVER RUNNING`);
  console.log(` Port: ${PORT}`);
  console.log(` Local URL:   http://localhost:${PORT}/api/health`);
  console.log(` Network URL: http://0.0.0.0:${PORT}/api/health`);
  console.log(` Database:    data/local_db.json`);
  console.log('========================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Stopping backend server...');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('Stopping backend server...');
  server.close(() => process.exit(0));
});

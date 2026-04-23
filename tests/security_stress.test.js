import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MonkeysSocket from '../src/monkeys-sockets.js';
import WebSocket from 'ws';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Polyfill WebSocket for Node environment
global.WebSocket = WebSocket;

describe('Security & Stress Tests', { timeout: 60000 }, () => {
    let serverProcess;
    let port = 9600;

    const startServer = async (p) => {
        const phpProjectRoot = process.env.PHP_SERVER_PATH 
            ? path.resolve(process.env.PHP_SERVER_PATH)
            : path.resolve(__dirname, '../../MonkeysLegion-Sockets');

        const scriptPath = path.join(phpProjectRoot, 'scratch', 'server.php');
        const proc = spawn('php', [scriptPath, p.toString()], { cwd: phpProjectRoot });
        
        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 1500));
        return proc;
    };

    afterEach(() => {
        if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
        }
        port++;
    });

    it('STRESS: Handle 50 rapid simultaneous connections and disconnects', async () => {
        serverProcess = await startServer(port);
        const url = `ws://127.0.0.1:${port}`;
        const clients = [];
        const numClients = 50;

        // Massive parallel connection
        for (let i = 0; i < numClients; i++) {
            const client = new MonkeysSocket(url, { 
                autoConnect: false,
                socketOptions: { origin: 'http://localhost:3000' }
            });
            clients.push(client);
        }

        const connectPromises = clients.map(client => new Promise(resolve => {
            client.on('connect', resolve);
            client.connect();
        }));

        await Promise.all(connectPromises);
        expect(clients.every(c => c.connected)).toBe(true);

        // Massive parallel disconnection
        clients.forEach(c => c.disconnect());
        
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(clients.every(c => !c.connected)).toBe(true);
    });

    it('CVES: Prototype Pollution Protection', async () => {
        serverProcess = await startServer(port);
        const url = `ws://127.0.0.1:${port}`;
        const client = new MonkeysSocket(url, {
             socketOptions: { origin: 'http://localhost:3000' }
        });

        await new Promise(resolve => client.on('connect', resolve));

        // Malicious payload that attempts to pollute the Object prototype
        const maliciousPayload = '{"event": "pollute", "payload": {"__proto__": {"polluted": "yes"}}}';
        
        // Simulate receiving this from the server
        const event = { data: maliciousPayload };
        client._onMessage(event);

        expect({}.polluted).toBeUndefined();
        client.disconnect();
    });

    it('SECURITY: Prevent Command Injection / Remote Code Execution strings', async () => {
        serverProcess = await startServer(port);
        const url = `ws://127.0.0.1:${port}`;
        const client = new MonkeysSocket(url, {
             socketOptions: { origin: 'http://localhost:3000' }
        });

        await new Promise(resolve => client.on('connect', resolve));

        const maliciousStrings = [
            '; rm -rf /',
            '$(whoami)',
            '../../../../etc/passwd',
            '\' OR 1=1 --',
            '<script>alert("XSS")</script>',
            '{{7*7}}', // Template injection
            '<?php system("id"); ?>'
        ];

        for (const str of maliciousStrings) {
            // Emitting these should be safe on the client side
            client.emit('event', { data: str });
        }

        expect(client.connected).toBe(true);
        client.disconnect();
    });

    it('STRESS: Payload Bomb (10MB payload)', async () => {
        serverProcess = await startServer(port);
        const url = `ws://127.0.0.1:${port}`;
        const client = new MonkeysSocket(url, {
             socketOptions: { origin: 'http://localhost:3000' }
        });

        await new Promise(resolve => client.on('connect', resolve));

        const largePayload = 'A'.repeat(10 * 1024 * 1024); // 10MB
        
        // We just ensure the client doesn't crash during stringification/sending
        // (The server might close the connection if it's over its limit, which is fine)
        try {
            client.emit('large_event', { data: largePayload });
        } catch (e) {
            // Should not throw locally
            expect(e).toBeUndefined();
        }

        client.disconnect();
    });

    it('ROBUSTNESS: Handle garbage binary data without crashing', async () => {
        serverProcess = await startServer(port);
        const url = `ws://127.0.0.1:${port}`;
        const client = new MonkeysSocket(url, {
             socketOptions: { origin: 'http://localhost:3000' }
        });

        await new Promise(resolve => client.on('connect', resolve));

        // Simulate random binary garbage from server
        const garbage = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
        const event = { data: garbage.buffer };
        
        let errorFired = false;
        client.on('error', () => { errorFired = true; });

        client._onMessage(event);

        // Should have fired an error but stayed alive
        expect(errorFired).toBe(true);
        expect(client.connected).toBe(true); 
        client.disconnect();
    });
});

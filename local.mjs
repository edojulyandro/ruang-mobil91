import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {existsSync} from 'node:fs';
import site from './api/site.js';

if (existsSync('.env')) process.loadEnvFile();
createServer(async (req,res) => {
  const {pathname} = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith('/assets/')) return site(req,res);
  const root = resolve('public/assets');
  const file = resolve(root, '.' + pathname.slice('/assets'.length));
  if (!file.startsWith(root + sep)) {res.writeHead(404).end(); return;}
  try {
    const mime = file.endsWith('.css') ? 'text/css' : 'text/javascript';
    res.writeHead(200, {'Content-Type': mime + '; charset=utf-8'}).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
}).listen(process.env.PORT || 3000, '127.0.0.1', () => console.log('http://127.0.0.1:' + (process.env.PORT || 3000)));
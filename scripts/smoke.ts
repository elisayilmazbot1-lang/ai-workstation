import { createContainer } from '../backend/server/container.js';
import { buildApp } from '../backend/server/app.js';

const c = createContainer({ dataDir: '/tmp/aw-smoke', inMemoryDb: true });
const app = await buildApp(c);
await app.ready();

const call = async (method: string, url: string, body?: unknown) => {
  const res = await app.inject({ method: method as 'GET', url, payload: body as never });
  return { status: res.statusCode, json: res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : null };
};

console.log('health', (await call('GET','/api/health')).status);
const p = await call('POST','/api/providers',{kind:'google',name:'Google Test'});
console.log('provider create', p.status, p.json?.id, 'hasCredential=', p.json?.hasCredential);
console.log('models', (await call('GET','/api/models?free=true')).json?.length);
const proj = await call('POST','/api/projects',{rootPath: process.cwd()});
console.log('project', proj.status, proj.json?.name);
console.log('tree', (await call('GET',`/api/projects/${proj.json.id}/tree?depth=1`)).status);
console.log('read', (await call('GET',`/api/projects/${proj.json.id}/file?path=package.json`)).json?.size);
const write = await call('PUT',`/api/projects/${proj.json.id}/file`,{path:'hello.txt',content:'merhaba'});
console.log('write blocked (approval required):', write.status, write.json?.error);
const appr = await call('POST',`/api/approvals/${write.json.approvalId}/approve`,{});
console.log('approve', appr.status, appr.json?.status);
const write2 = await call('PUT',`/api/projects/${proj.json.id}/file`,{path:'hello.txt',content:'merhaba',approvalId:write.json.approvalId});
console.log('write after approve', write2.status, JSON.stringify(write2.json).slice(0,600));
const pathTrav = await call('GET',`/api/projects/${proj.json.id}/file?path=../../../etc/passwd`);
console.log('path traversal blocked:', pathTrav.status, pathTrav.json?.error);
const term = await call('POST','/api/terminal/analyze',{command:'rm -rf /'});
console.log('cmd risk', term.json?.risk, term.json?.requiresApproval);
const stats = await call('GET','/api/stats');
console.log('stats', stats.status, JSON.stringify(stats.json?.models));
const agents = await call('GET','/api/agents');
console.log('agents', agents.json?.length);
const task = await call('POST','/api/tasks',{title:'Analiz',description:'Projeyi incele',autoStart:false});
console.log('task', task.status, task.json?.status);
await app.close(); c.close();

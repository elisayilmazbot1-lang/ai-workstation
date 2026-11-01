/**
 * Geliştirme için sahte OpenAI uyumlu sağlayıcı.
 *
 * Amaç: API anahtarı ve internet olmadan tüm zinciri (gateway → ajanlar →
 * dosya önerisi → onay → test) çalıştırarak doğrulamak.
 *
 *   npx tsx scripts/mock-provider.ts --port 47777
 */
import http from 'node:http';

const portFlag = process.argv.indexOf('--port');
const port = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 47777;

const PLAN = {
  plan: [
    { role: 'architect', title: 'Projeyi analiz et', instruction: 'Mevcut dosya yapısını incele ve kısa bir mimari özet çıkar.', dependsOn: [], files: ['src/index.ts'] },
    { role: 'coder', title: 'Yeni modül ekle', instruction: 'src/matematik.ts dosyasını oluştur: çarpma ve toplama fonksiyonları içersin.', dependsOn: [0], files: ['src/matematik.ts'] },
    { role: 'security', title: 'Güvenlik incelemesi', instruction: 'Üretilen kodu anahtar sızıntısı ve enjeksiyon açısından incele.', dependsOn: [1], files: [] },
    { role: 'tester', title: 'Testleri çalıştır', instruction: 'Birim testlerini çalıştır ve sonuçları raporla.', dependsOn: [1], files: [] },
  ],
  risks: ['Fixture projesinde test altyapısı sınırlı olabilir.'],
  needsApproval: true,
};

const FILE_OUTPUT = '```file:src/matematik.ts\nexport function topla(a: number, b: number): number {\n  return a + b;\n}\n\nexport function carp(a: number, b: number): number {\n  return a * b;\n}\n```\n\nÖZET: src/matematik.ts oluşturuldu; iki saf fonksiyon eklendi.';

const server = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }
    const messages = (body.messages as Array<{ role: string; content: string }> | undefined) ?? [];
    const userText = messages.map((m) => m.content).join('\n');

    if (req.url === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'demo-coder', context_length: 128000 }, { id: 'demo-reviewer' }] }));
      return;
    }

    if (req.url === '/v1/chat/completions') {
      if (body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const parts = ['Merhaba! ', 'Ben ', 'AI Workstation ', 'demo modeliyim. ', 'Bir görev için /görev yazabilirsiniz.'];
        for (const p of parts) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 42, completion_tokens: 18 } })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      let content: string;
      if (userText.includes('JSON plan')) content = JSON.stringify(PLAN);
      else if (userText.includes('bağımsız bir kod denetçisi')) content = JSON.stringify({ verdict: 'approve', issues: [], suggestions: ['Fonksiyonlara JSDoc eklenebilir.'], confidence: 82 });
      else if (userText.includes('Kodlama Ajanısın')) content = FILE_OUTPUT;
      else content = 'Analiz tamamlandı: proje TypeScript tabanlı, modül sınırları net. Öneri: test kapsamı artırılmalı.';

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'chatcmpl-demo',
          model: body.model,
          choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 800, completion_tokens: 260 },
        }),
      );
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'bulunamadı' } }));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Sahte sağlayıcı hazır → http://127.0.0.1:${port}/v1`);
});

/** Yardım: Türkçe kullanım kılavuzu, güvenlik kuralları, sorun giderme. */
import React from 'react';
import { BookOpen, KeyRound, ShieldAlert, Wrench } from 'lucide-react';
import { Panel } from '../components/ui';

export function HelpPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Panel title={<span className="flex items-center gap-1.5"><BookOpen size={13} /> Başlangıç</span>}>
          <ol className="space-y-2 text-[11.5px] leading-relaxed text-slate-300">
            <li><strong className="text-slate-100">1. Proje ekleyin.</strong> Projeler sayfasına gidip bilgisayarınızdaki bir klasörün tam yolunu girin.</li>
            <li><strong className="text-slate-100">2. Sağlayıcı ekleyin.</strong> Model Merkezi → Sağlayıcı ekle. Ücretsiz başlamak için Google Gemini (AI Studio anahtarı), OpenRouter (:free modeller) veya Groq önerilir.</li>
            <li><strong className="text-slate-100">3. Bağlantıyı test edin</strong> ve "Kataloğu çek" ile model listesini güncelleyin.</li>
            <li><strong className="text-slate-100">4. Model seçin.</strong> Üst çubuktan bir model seçin. Ücretsiz/ücretli/doğrulanmadı etiketi her modelde görünür.</li>
            <li><strong className="text-slate-100">5. Sohbet edin veya görev verin.</strong> <span className="kbd">/görev …</span> yazarsanız ajan ekibi devreye girer.</li>
          </ol>
        </Panel>

        <Panel title={<span className="flex items-center gap-1.5"><KeyRound size={13} /> Ücretsiz model stratejisi</span>}>
          <div className="space-y-2 text-[11.5px] leading-relaxed text-slate-300">
            <p>Bu uygulama, <strong>ücretsiz resmî API</strong> katmanlarını önceler. Ancak bir modelin web sitesinde ücretsiz olması, başka bir uygulamadan API ile ücretsiz kullanılabileceği anlamına gelmez.</p>
            <ul className="space-y-1 text-[11px] text-slate-400">
              <li>• <strong className="text-teal">Ücretsiz:</strong> sağlayıcı politikası gereği ücretsiz (ör. OpenRouter ":free", yerel Ollama).</li>
              <li>• <strong className="text-teal">Ücretsiz kota:</strong> günlük/dakikalık kota içinde ücretsiz; kota bitince hız sınırı hatası.</li>
              <li>• <strong className="text-amber">Ücretli:</strong> kullanım başına ücretlendirme; maliyet sağ üstte gösterilir.</li>
              <li>• <strong className="text-slate-300">Doğrulanmadı:</strong> ücretsizliği kanıtlanmamış model. "Ücretsiz" olarak etiketlenmez.</li>
            </ul>
            <p className="rounded border border-white/10 bg-white/[0.03] p-2 text-[10.5px] text-slate-400">
              LM Arena gibi yalnızca web üzerinden hizmet veren platformlar <em>doğrudan entegre edilmez</em>; oturum kopyalama ve koruma aşma yasaktır.
            </p>
          </div>
        </Panel>

        <Panel title={<span className="flex items-center gap-1.5"><ShieldAlert size={13} /> Güvenlik kuralları</span>}>
          <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-slate-300">
            <li>• API anahtarları yalnızca şifreli kasada saklanır; arayüze ve günlüklere yazılmaz.</li>
            <li>• Ajanlar proje klasörü dışına erişemez; <span className="mono">..</span> ve sembolik bağlantı denemeleri engellenir.</li>
            <li>• Dosya yazma, komut çalıştırma, Docker işlemleri ve form gönderimi onay ister.</li>
            <li>• Yüksek riskli komutlar (silme, paket kurma, servis durdurma) ve kritik komutlar (disk, kayıt defteri) ayrı sınıflandırılır.</li>
            <li>• <strong className="text-rose">ACİL DURDUR</strong> düğmesi tüm ajanları, komutları ve bekleyen işlemleri durdurur.</li>
            <li>• Web sayfası ve dosya içerikleri güvenilmeyen veri sayılır (prompt injection koruması).</li>
          </ul>
        </Panel>

        <Panel title={<span className="flex items-center gap-1.5"><Wrench size={13} /> Sorun giderme</span>}>
          <dl className="space-y-2 text-[11.5px] leading-relaxed">
            <div><dt className="text-slate-200">"Hiçbir model yanıt veremedi"</dt><dd className="text-slate-400">Model Merkezi'nde sağlayıcı anahtarını ve bağlantı testini kontrol edin. Ücretsiz kotanız dolmuş olabilir (429).</dd></div>
            <div><dt className="text-slate-200">Docker bağlantısı kurulamıyor</dt><dd className="text-slate-400">Docker Desktop'ın kurulu ve çalışır olduğundan emin olun. Windows'ta WSL2 arka ucu önerilir.</dd></div>
            <div><dt className="text-slate-200">Terminal komutu "spawn … ENOENT"</dt><dd className="text-slate-400">Seçili kabuk sistemde yok; uygulama otomatik olarak kullanılabilir kabuğa düşer. Ayarlar → Terminal'den kabuğu değiştirin.</dd></div>
            <div><dt className="text-slate-200">Test "Çalıştırılmadı" görünüyor</dt><dd className="text-slate-400">Projede ilgili test altyapısı (tsconfig, vitest, playwright) yok. Bu durum başarı sayılmaz; kasıtlı bir tasarım kararıdır.</dd></div>
            <div><dt className="text-slate-200">Dosya yazımı engelleniyor</dt><dd className="text-slate-400">Onay kapısı çalışıyor. Sağ paneldeki "Onay bekleyen" bölümünden onaylayın.</dd></div>
          </dl>
        </Panel>
      </div>

      <Panel title="Kısayollar ve komutlar" className="mt-2">
        <div className="grid grid-cols-1 gap-2 text-[11.5px] md:grid-cols-2">
          <div>
            <p className="label">Sohbet komutları</p>
            <ul className="space-y-0.5 text-slate-300">
              <li><span className="kbd">/görev &lt;talep&gt;</span> — ajan ekibiyle görev başlat</li>
              <li><span className="kbd">/analiz</span> — projeyi baştan sona analiz et</li>
              <li><span className="kbd">/test</span> — testleri çalıştır</li>
            </ul>
          </div>
          <div>
            <p className="label">Genel</p>
            <ul className="space-y-0.5 text-slate-300">
              <li><span className="kbd">Enter</span> — gönder · <span className="kbd">Shift+Enter</span> — yeni satır</li>
              <li><span className="kbd">Ctrl+Shift+Esc</span> — acil durdurma (uygulama içi)</li>
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}

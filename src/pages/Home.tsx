import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Save, RefreshCw, Plus, Trash2, Upload, Layout } from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';

interface BackgroundConfig { type: string; source: string; fallbackImage: string }
interface HeroConfig {
  badgeText: string; badgeFontFamily: string; titleTop: string; titleBottom: string;
  titleFontFamily: string; heading: string; headingFontFamily: string; narrative: string;
  narrativeFontFamily: string; ctaText: string; ctaPath: string; background: BackgroundConfig;
}
interface CategoryCard { id: number | string; title: string; subtitle: string; description: string; image: string; path: string; fontFamily?: string }
interface CarouselConfig { eyebrow: string; title: string; cards: CategoryCard[] }
interface StatItem { number: string; label: string }
interface StatsConfig { eyebrow: string; heading: string; items: StatItem[] }
interface ContactConfig { phone: string; email: string; address: string; facebook: string; instagram: string; tiktok: string; messenger: string }
interface HomeContent { hero: HeroConfig; carousel: CarouselConfig; stats: StatsConfig; contacts: ContactConfig }
type Message = { type: 'success' | 'error'; text: string } | null;

const DEFAULT_FONT = '"Kathya Script", cursive';
const AVAILABLE_FONTS = [
  { label: 'Adorn Serif', value: '"Adorn Serif", serif' }, { label: 'Avallon', value: 'Avallon, cursive, sans-serif' },
  { label: 'Taberna', value: 'Taberna, sans-serif' }, { label: 'Brushability', value: 'Brushability, cursive' },
  { label: 'Beloved', value: 'Beloved, sans-serif' }, { label: 'La Parisienne', value: '"La Parisienne", cursive' },
  { label: 'Golden Youth Caps', value: '"Golden Youth Caps", sans-serif' }, { label: 'Flamingo', value: 'Flamingo, cursive' },
  { label: 'Northern Soul', value: '"Northern Soul", sans-serif' }, { label: 'Kathya Script', value: '"Kathya Script", cursive' },
  { label: 'Fairwater', value: 'Fairwater, serif' }, { label: 'Isabella Script', value: '"Isabella Script", cursive' },
  { label: 'Microbrew', value: 'Microbrew, sans-serif' }, { label: 'Octavia Script', value: '"Octavia Script", cursive' },
  { label: 'Adorn Condensed', value: '"Adorn Condensed", sans-serif' }, { label: 'Buttermilk Farmhouse', value: '"Buttermilk Farmhouse", cursive' },
  { label: 'Charcuterie', value: 'Charcuterie, serif' }, { label: 'Legend Script', value: '"Legend Script", cursive' },
  { label: 'Midnight Owl', value: '"Midnight Owl", serif' }, { label: 'Ragazza', value: 'Ragazza, cursive' },
];

const EMPTY_CONTENT: HomeContent = {
  hero: {
    badgeText: 'ROOSTER, HEN & CHICK COLLECTIONS', badgeFontFamily: DEFAULT_FONT,
    titleTop: 'Curated Living', titleBottom: 'Artisanal Storefront', titleFontFamily: DEFAULT_FONT,
    heading: 'Welcome to EGB Backyard', headingFontFamily: DEFAULT_FONT,
    narrative: 'Explore our specialized lines across rooster care, hen feeding, and backyard poultry essentials.', narrativeFontFamily: DEFAULT_FONT,
    ctaText: 'Explore Collections', ctaPath: '/shop',
    background: { type: 'image', source: '', fallbackImage: '' },
  },
  carousel: { eyebrow: 'CATALOG', title: 'Featured Categories', cards: [] },
  stats: { eyebrow: 'OUR IMPACT', heading: 'Backyard Excellence', items: [] },
  contacts: { phone: '', email: '', address: '', facebook: '', instagram: '', tiktok: '', messenger: '' },
};

function normalizeContent(raw: any): HomeContent {
  const hero = raw?.hero ?? {};
  const background = hero.background ?? {};
  const carousel = raw?.carousel ?? {};
  const stats = raw?.stats ?? {};
  const cards = Array.isArray(carousel.cards) ? carousel.cards : [];
  const items = Array.isArray(stats.items) ? stats.items : [];
  const contacts = raw?.contacts ?? {};
  return {
    hero: {
      ...EMPTY_CONTENT.hero, ...hero,
      badgeFontFamily: hero.badgeFontFamily || hero.fontFamily || DEFAULT_FONT,
      titleFontFamily: hero.titleFontFamily || hero.fontFamily || DEFAULT_FONT,
      headingFontFamily: hero.headingFontFamily || hero.fontFamily || DEFAULT_FONT,
      narrativeFontFamily: hero.narrativeFontFamily || hero.fontFamily || DEFAULT_FONT,
      background: { ...EMPTY_CONTENT.hero.background, ...background },
    },
    carousel: { ...EMPTY_CONTENT.carousel, ...carousel, cards: cards.map((card: any, index: number) => ({
      id: card.id ?? index + 1, title: '', subtitle: '', description: '', image: '', path: '', ...card,
    })) },
    stats: { ...EMPTY_CONTENT.stats, ...stats, items: items.map((item: any) => ({ number: '', label: '', ...item })) },
    contacts: { ...EMPTY_CONTENT.contacts, ...contacts },
  };
}

const HomeCustomizer: React.FC = () => {
  const [content, setContent] = useState<HomeContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const fetchContent = useCallback(async () => {
    setLoading(true); setMessage(null);
    try {
      const response = await api.get('/api/v1/home');
      const raw = response.data?.data ?? response.data?.content ?? response.data;
      if (!raw || typeof raw !== 'object') throw new Error('The homepage endpoint returned an invalid response.');
      setContent(normalizeContent(raw));
    } catch (error) {
      setMessage({ type: 'error', text: apiErrorMessage(error, 'Failed to load homepage content. Check GET /api/v1/home.') });
      setContent(normalizeContent(EMPTY_CONTENT));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchContent(); }, [fetchContent]);

  const updateHero = <K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) => {
    setContent((current) => current ? { ...current, hero: { ...current.hero, [key]: value } } : current);
  };
  const updateBackground = (key: keyof BackgroundConfig, value: string) => {
    setContent((current) => current ? { ...current, hero: { ...current.hero, background: { ...current.hero.background, [key]: value } } } : current);
  };
  const updateCarousel = (key: keyof CarouselConfig, value: any) => {
    setContent((current) => current ? { ...current, carousel: { ...current.carousel, [key]: value } } : current);
  };
  const updateStats = (key: keyof StatsConfig, value: any) => {
    setContent((current) => current ? { ...current, stats: { ...current.stats, [key]: value } } : current);
  };
  const updateContact = (key: keyof ContactConfig, value: string) => {
    setContent((current) => current ? { ...current, contacts: { ...current.contacts, [key]: value } } : current);
  };
  const updateCard = (index: number, key: keyof CategoryCard, value: any) => {
    if (!content) return;
    const cards = content.carousel.cards.map((card, i) => i === index ? { ...card, [key]: value } : card);
    updateCarousel('cards', cards);
  };
  const updateStat = (index: number, key: keyof StatItem, value: string) => {
    if (!content) return;
    updateStats('items', content.stats.items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const readImage = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') callback(reader.result); };
    reader.onerror = () => setMessage({ type: 'error', text: 'The selected gallery file could not be read.' });
    reader.readAsDataURL(file);
  };

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!content || saving) return;
    setSaving(true); setMessage(null);
    try {
      const response = await api.put('/api/v1/home', content);
      const raw = response.data?.data ?? response.data?.content ?? response.data;
      if (raw && typeof raw === 'object' && raw.hero && raw.carousel && raw.stats) setContent(normalizeContent(raw));
      setMessage({ type: 'success', text: response.data?.message || 'Homepage configurations updated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: apiErrorMessage(error, 'Failed to save homepage settings. Check PUT /api/v1/home.') });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-zinc-400 text-xs font-black uppercase tracking-widest">
          <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          Loading homepage editor...
        </div>
      </div>
    );
  }

  if (!content) return null;

  const inputClass = 'w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-950 focus:bg-white focus:ring-2 focus:ring-zinc-950/20 transition-all';
  const labelClass = 'mb-2 block text-xs font-black uppercase tracking-wider text-zinc-400';
  const sectionClass = 'rounded-3xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6';

  return (
    <main className="mx-auto max-w-6xl space-y-8 rounded-3xl bg-zinc-50 p-4 sm:p-8 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white pb-32">
      
      {/* Header Bar */}
      <header className="flex flex-col justify-between gap-4 border-b border-zinc-200/80 pb-6 sm:flex-row sm:items-center bg-white p-6 sm:p-8 rounded-3xl shadow-sm">
        <div>
          <span className="text-[11px] uppercase font-extrabold tracking-[0.35em] text-zinc-400 block mb-1">Storefront Management</span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">Home Page Customizer</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 font-normal">Manage hero content, typography, carousel cards, and performance metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void fetchContent()} disabled={loading || saving} className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-700 hover:bg-zinc-200 transition-all disabled:opacity-50">
            <RefreshCw size={14}/> Reload
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-800 transition-all shadow-lg disabled:opacity-50">
            <Save size={14}/>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {message && (
        <div role={message.type === 'error' ? 'alert' : 'status'} className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold backdrop-blur-md shadow-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900' : 'border-rose-200 bg-rose-50/90 text-rose-900'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0"/> : <AlertCircle size={18} className="text-rose-600 shrink-0"/>}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* Hero Section */}
        <section className={sectionClass}>
          <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-4">
            <div className="p-2 bg-zinc-100 text-zinc-900 rounded-xl"><Layout size={18} /></div>
            <h2 className="text-base font-extrabold text-zinc-950 tracking-tight">Hero Banner Configuration</h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Badge Text" className={labelClass}>
              <input className={inputClass} value={content.hero.badgeText} onChange={(e) => updateHero('badgeText', e.target.value)}/>
            </Field>
            <FontField label="Badge Font Family" value={content.hero.badgeFontFamily} onChange={(value) => updateHero('badgeFontFamily', value)} inputClass={inputClass} labelClass={labelClass}/>
            
            <Field label="Top Title" className={labelClass}>
              <input className={inputClass} value={content.hero.titleTop} onChange={(e) => updateHero('titleTop', e.target.value)}/>
            </Field>
            <Field label="Bottom Title" className={labelClass}>
              <input className={inputClass} value={content.hero.titleBottom} onChange={(e) => updateHero('titleBottom', e.target.value)}/>
            </Field>
            
            <FontField label="Title Font Family" value={content.hero.titleFontFamily} onChange={(value) => updateHero('titleFontFamily', value)} inputClass={inputClass} labelClass={labelClass}/>
            <Field label="Heading Line" className={labelClass}>
              <input className={inputClass} value={content.hero.heading} onChange={(e) => updateHero('heading', e.target.value)}/>
            </Field>

            <FontField label="Heading Font Family" value={content.hero.headingFontFamily} onChange={(value) => updateHero('headingFontFamily', value)} inputClass={inputClass} labelClass={labelClass}/>
            <Field label="Narrative Description" className={labelClass}>
              <textarea rows={3} className={inputClass} value={content.hero.narrative} onChange={(e) => updateHero('narrative', e.target.value)}/>
            </Field>

            <FontField label="Narrative Font Family" value={content.hero.narrativeFontFamily} onChange={(value) => updateHero('narrativeFontFamily', value)} inputClass={inputClass} labelClass={labelClass}/>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CTA Button Text" className={labelClass}>
                <input className={inputClass} value={content.hero.ctaText} onChange={(e) => updateHero('ctaText', e.target.value)}/>
              </Field>
              <Field label="CTA Path" className={labelClass}>
                <input className={inputClass} value={content.hero.ctaPath} onChange={(e) => updateHero('ctaPath', e.target.value)}/>
              </Field>
            </div>

            <Field label="Background Media Type" className={labelClass}>
              <select className={inputClass} value={content.hero.background.type} onChange={(e) => updateBackground('type', e.target.value)}>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="color">Color / Other</option>
              </select>
            </Field>

            <Field label="Background Media Source (URL or Gallery File)" className={labelClass}>
              <div className="space-y-2">
                <input className={inputClass} value={content.hero.background.source} onChange={(e) => updateBackground('source', e.target.value)} placeholder="https://..."/>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-2.5 text-xs font-bold text-zinc-600 hover:border-zinc-950 transition-all">
                  <Upload size={14}/> Select image from gallery
                  <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (url) => updateBackground('source', url)); }}/>
                </label>
              </div>
            </Field>

            <Field label="Fallback Image (URL or Gallery File)" className={labelClass}>
              <div className="space-y-2">
                <input className={inputClass} value={content.hero.background.fallbackImage} onChange={(e) => updateBackground('fallbackImage', e.target.value)} placeholder="https://..."/>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-2.5 text-xs font-bold text-zinc-600 hover:border-zinc-950 transition-all">
                  <ImagePlus size={14}/> Upload fallback image
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (url) => updateBackground('fallbackImage', url)); }}/>
                </label>
              </div>
            </Field>
          </div>
        </section>

        {/* Carousel / Collections Section */}
        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <h2 className="text-base font-extrabold text-zinc-950 tracking-tight">Collection Carousel & Cards</h2>
            <button type="button" onClick={() => updateCarousel('cards', [...content.carousel.cards, { id: `card-${Date.now()}`, title: '', subtitle: '', description: '', image: '', path: '', fontFamily: DEFAULT_FONT }])} className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-900 hover:bg-zinc-100 transition-all">
              <Plus size={14}/> Add Card
            </button>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Section Eyebrow" className={labelClass}>
              <input className={inputClass} value={content.carousel.eyebrow} onChange={(e) => updateCarousel('eyebrow', e.target.value)} />
            </Field>
            <Field label="Section Title" className={labelClass}>
              <input className={inputClass} value={content.carousel.title} onChange={(e) => updateCarousel('title', e.target.value)} />
            </Field>
          </div>

          {content.carousel.cards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
              No collection cards configured. Select "Add Card" to build items.
            </div>
          )}

          <div className="space-y-4">
            {content.carousel.cards.map((card, index) => (
              <article key={String(card.id)} className="rounded-2xl border border-zinc-200 bg-zinc-50/30 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-700">Card Item #{index + 1}</span>
                  <button type="button" onClick={() => updateCarousel('cards', content.carousel.cards.filter((_, i) => i !== index))} className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all">
                    <Trash2 size={13}/> Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Card Title" className={labelClass}><input className={inputClass} value={card.title} onChange={(e) => updateCard(index, 'title', e.target.value)}/></Field>
                  <Field label="Card Subtitle" className={labelClass}><input className={inputClass} value={card.subtitle} onChange={(e) => updateCard(index, 'subtitle', e.target.value)}/></Field>
                  <Field label="Description" className={labelClass}><textarea rows={2} className={inputClass} value={card.description} onChange={(e) => updateCard(index, 'description', e.target.value)}/></Field>
                  <FontField label="Card Font Family" value={card.fontFamily || DEFAULT_FONT} onChange={(value) => updateCard(index, 'fontFamily', value)} inputClass={inputClass} labelClass={labelClass}/>
                  
                  <Field label="Card Image (URL or Gallery File)" className={labelClass}>
                    <div className="space-y-2">
                      <input className={inputClass} value={card.image} onChange={(e) => updateCard(index, 'image', e.target.value)} placeholder="https://..."/>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white p-2 text-xs font-bold text-zinc-600 hover:border-zinc-950 transition-all">
                        <Upload size={13}/> Select card image
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (url) => updateCard(index, 'image', url)); }}/>
                      </label>
                    </div>
                  </Field>

                  <Field label="Destination Path" className={labelClass}><input className={inputClass} value={card.path} onChange={(e) => updateCard(index, 'path', e.target.value)} placeholder="/shop, /category/all"/></Field>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Business contact and social links */}
        <section className={sectionClass}>
          <div className="flex items-center gap-2.5 border-b border-zinc-100 pb-4">
            <div className="rounded-xl bg-zinc-100 p-2 text-zinc-900"><Layout size={18} /></div>
            <div><h2 className="text-base font-extrabold tracking-tight text-zinc-950">Business Contacts & Social Platforms</h2><p className="mt-1 text-xs text-zinc-500">These live details appear in the contact carousel on the public homepage.</p></div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Business Phone" className={labelClass}><input className={inputClass} value={content.contacts.phone} onChange={(e) => updateContact('phone', e.target.value)} placeholder="+63..." /></Field>
            <Field label="Business Email" className={labelClass}><input type="email" className={inputClass} value={content.contacts.email} onChange={(e) => updateContact('email', e.target.value)} placeholder="business@example.com" /></Field>
            <Field label="Business Address" className={labelClass}><input className={inputClass} value={content.contacts.address} onChange={(e) => updateContact('address', e.target.value)} placeholder="Business location" /></Field>
            <Field label="Facebook Page URL" className={labelClass}><input type="url" className={inputClass} value={content.contacts.facebook} onChange={(e) => updateContact('facebook', e.target.value)} placeholder="https://facebook.com/..." /></Field>
            <Field label="Instagram URL" className={labelClass}><input type="url" className={inputClass} value={content.contacts.instagram} onChange={(e) => updateContact('instagram', e.target.value)} placeholder="https://instagram.com/..." /></Field>
            <Field label="TikTok URL" className={labelClass}><input type="url" className={inputClass} value={content.contacts.tiktok} onChange={(e) => updateContact('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." /></Field>
            <Field label="Messenger URL" className={labelClass}><input type="url" className={inputClass} value={content.contacts.messenger} onChange={(e) => updateContact('messenger', e.target.value)} placeholder="https://m.me/..." /></Field>
          </div>
        </section>

        {/* Statistics Section */}
        <section className={sectionClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <h2 className="text-base font-extrabold text-zinc-950 tracking-tight">Performance & Community Statistics</h2>
            <button type="button" onClick={() => updateStats('items', [...content.stats.items, { number: '', label: '' }])} className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-900 hover:bg-zinc-100 transition-all">
              <Plus size={14}/> Add Statistic
            </button>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Stats Eyebrow" className={labelClass}><input className={inputClass} value={content.stats.eyebrow} onChange={(e) => updateStats('eyebrow', e.target.value)}/></Field>
            <Field label="Stats Heading" className={labelClass}><input className={inputClass} value={content.stats.heading} onChange={(e) => updateStats('heading', e.target.value)}/></Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {content.stats.items.map((stat, index) => (
              <article key={`${index}-${stat.label}`} className="rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-400">Metric #{index + 1}</span>
                  <button type="button" onClick={() => updateStats('items', content.stats.items.filter((_, i) => i !== index))} aria-label={`Remove statistic ${index + 1}`} className="rounded-lg p-1 text-rose-600 hover:bg-rose-50 transition-all"><Trash2 size={14}/></button>
                </div>
                <Field label="Number / Metric" className={labelClass}><input className={inputClass} value={stat.number} onChange={(e) => updateStat(index, 'number', e.target.value)}/></Field>
                <Field label="Metric Label" className={labelClass}><input className={inputClass} value={stat.label} onChange={(e) => updateStat(index, 'label', e.target.value)}/></Field>
              </article>
            ))}
          </div>
        </section>

        {/* Footer Submit Action */}
        <div className="flex justify-end pt-4">
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-2xl bg-zinc-950 px-8 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-800 transition-all shadow-xl disabled:opacity-50">
            <Save size={16}/>
            {saving ? 'Saving changes...' : 'Save all changes'}
          </button>
        </div>

      </form>
    </main>
  );
};

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) { 
  return <div><label className={className}>{label}</label>{children}</div>; 
}

function FontField({ label, value, onChange, inputClass, labelClass }: { label: string; value: string; onChange: (value: string) => void; inputClass: string; labelClass: string }) { 
  return (
    <Field label={label} className={labelClass}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {AVAILABLE_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
      </select>
    </Field>
  ); 
}

export default HomeCustomizer;

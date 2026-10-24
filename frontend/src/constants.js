import {
  ArrowUpDown, Droplets, Flame, Package, ShieldCheck, Sparkles, Trees, UserRound, Wrench, Zap,
  Cpu, HeartHandshake, Leaf, Lightbulb, Lock, Shovel,
} from 'lucide-vue-next';

export const EXPENSE_CATEGORIES = {
  personel: { label: 'Personel', color: '#7aa2ff', icon: UserRound },
  dogalgaz: { label: 'Doğalgaz', color: '#ff8a5c', icon: Flame },
  elektrik: { label: 'Elektrik', color: '#f7c948', icon: Zap },
  su: { label: 'Su', color: '#4cc9f0', icon: Droplets },
  asansor: { label: 'Asansör', color: '#b197fc', icon: ArrowUpDown },
  temizlik: { label: 'Temizlik', color: '#3ddc97', icon: Sparkles },
  bakim: { label: 'Bakım & Onarım', color: '#f783ac', icon: Wrench },
  bahce: { label: 'Bahçe', color: '#94d82d', icon: Trees },
  sigorta: { label: 'Sigorta', color: '#a0aec0', icon: ShieldCheck },
  diger: { label: 'Diğer', color: '#ced4da', icon: Package },
};

export const expenseCategory = (key) => EXPENSE_CATEGORIES[key] || { ...EXPENSE_CATEGORIES.diger, label: key };

export const RECURRING = {
  none: 'Tek seferlik',
  monthly: 'Her ay',
  yearly: 'Her yıl',
};

export const SUGGESTION_CATEGORIES = {
  genel: { label: 'Genel', icon: Lightbulb },
  guvenlik: { label: 'Güvenlik', icon: Lock },
  temizlik: { label: 'Temizlik', icon: Sparkles },
  peyzaj: { label: 'Peyzaj', icon: Shovel },
  enerji: { label: 'Enerji', icon: Leaf },
  sosyal: { label: 'Sosyal', icon: HeartHandshake },
  teknik: { label: 'Teknik', icon: Cpu },
};

export const SUGGESTION_STATUS = {
  yeni: { label: 'Yeni', tone: 'info' },
  inceleniyor: { label: 'İnceleniyor', tone: 'warn' },
  onaylandi: { label: 'Onaylandı', tone: 'accent' },
  tamamlandi: { label: 'Tamamlandı', tone: 'success' },
  reddedildi: { label: 'Reddedildi', tone: 'danger' },
};

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, ClipboardList, Crosshair, FileText, Flame, Gauge, Heart, History, Layers3, Maximize2, Menu, Minimize2, Moon, Move3d, Plane, Play, Rotate3d, Search, SlidersHorizontal, Sparkles, Sun, X, ZoomIn, ZoomOut } from 'lucide-react';
import NotFound from '@/pages/not-found';
import { aircraftCatalog, quickFilters, type Aircraft, type GalleryItem, type VideoLink } from '@/data/aircraft';

type Toast = string | null;
type ThemeMode = 'light' | 'dark';

type FireCategoryRow = {
  categoria: string;
  anv: string;
  nome: string;
  cat_contraincendio: string | number;
};

function getDrivePreviewUrl(url: string) {
  const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view/i);
  return match ? `https://drive.google.com/file/d/${match[1]}/preview?embedded=true` : null;
}

function getDriveImageUrl(url: string) {
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|thumbnail\?id=|uc\?[^#]*id=)([a-zA-Z0-9_-]+)/i);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w2000` : url;
}

function getYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    let id: string | null = null;
    if (/youtu\.be$/i.test(parsed.hostname)) {
      id = parsed.pathname.slice(1);
    } else if (/youtube(?:-nocookie)?\.com$/i.test(parsed.hostname)) {
      if (parsed.pathname.startsWith('/watch')) {
        id = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/shorts/')) {
        id = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/embed/')) {
        id = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/v/')) {
        id = parsed.pathname.split('/')[2];
      }
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      const startTime = parsed.searchParams.get('t') || parsed.searchParams.get('start');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : '';
      const startParam = startTime ? `&start=${startTime.replace(/[^0-9]/g, '')}` : '';
      return `https://www.youtube.com/embed/${id}?autoplay=0&controls=1&rel=0${startParam}${originParam}`;
    }
  } catch {
    return null;
  }
  return null;
}

function getVideoEmbedUrl(url: string) {
  return getDrivePreviewUrl(url) ?? getYoutubeEmbedUrl(url);
}

function normalizeOverviewLabel(label: string) {
  if (/^Visão geral(?:\s*\d+)?$/i.test(label)) {
    return label.replace(/^Visão geral/i, 'Ilustração');
  }
  if (/^Cockpit$/i.test(label)) {
    return 'Ilustração Cockpit';
  }
  if (/^REVO$/i.test(label)) {
    return 'Ilustração REVO';
  }
  return label;
}

function formatCompactMetric(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return '0';
  const text = String(value).trim();
  if (!text) return '0';
  const match = text.match(/(\d+)/);
  if (match) return match[1];
  return text.toLowerCase() === 'sem tripulação' ? '0' : text;
}

function formatFireCategoryDisplay(value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value).trim();
  if (!text) return '';

  const normalized = text.replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  const rotorMatch = normalized.match(/H([1-3])/);
  if (rotorMatch) {
    const helicopterLevel = Number(rotorMatch[1]);
    const equivalent = helicopterLevel === 1 ? '2' : helicopterLevel === 2 ? '3' : '4';
    return `CAT HL H${helicopterLevel} → ${equivalent}`;
  }

  const fixedMatch = normalized.match(/(\d+)/);
  if (fixedMatch) {
    return `CAT-AV ${Number(fixedMatch[1])}`;
  }

  return text;
}

function isCivilAircraft(category: string) {
  return /civil|vip|executivo/i.test(category);
}

function isMilitaryAircraft(category: string) {
  return !isCivilAircraft(category);
}

function isFixedWingAircraft(category: string) {
  return !/helicóptero|rotativa|rotor/i.test(category);
}

function getAircraftTypeLabel(aircraft: Aircraft) {
  return isCivilAircraft(aircraft.category) ? 'Civil' : 'Militar';
}

function getAircraftIdentificationLabel(aircraft: Aircraft) {
  return isCivilAircraft(aircraft.category) ? 'Nome Comercial' : 'Designação FAB';
}

function getAircraftSummaryLabel(aircraft: Aircraft) {
  return `${aircraft.category} - ${aircraft.role}`;
}

function getFireCategoryRank(value?: string) {
  if (!value) return -1;

  const matches = Array.from(String(value).matchAll(/\d+/g), (match) => Number(match[0]));
  if (matches.length === 0) return -1;

  return Math.max(...matches);
}

const fireCategoryRows: FireCategoryRow[] = [
  { categoria: 'Asa Fixa', anv: 'KC-30', nome: 'KC-30', cat_contraincendio: 8 },
  { categoria: 'Asa Fixa', anv: 'C-130', nome: 'C-130 Hércules', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'KC-390', nome: 'KC-390 Millennium', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'P-3AM', nome: 'P-3AM Orion', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'E-99M', nome: 'E-99M', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'R-99', nome: 'R-99', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'VC-1', nome: 'Airbus A319', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'VC-2', nome: 'Embraer 190', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'C-99', nome: 'C-99', cat_contraincendio: 6 },
  { categoria: 'Asa Fixa', anv: 'C-105', nome: 'C-105 Amazonas', cat_contraincendio: 5 },
  { categoria: 'Asa Fixa', anv: 'IU-50', nome: 'Legacy 500', cat_contraincendio: 4 },
  { categoria: 'Asa Fixa', anv: 'C-97', nome: 'C-97 Brasília', cat_contraincendio: 4 },
  { categoria: 'Asa Fixa', anv: 'IU-93', nome: 'Hawker', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'C-95', nome: 'C-95M Bandeirante', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'F-5', nome: 'F-5M Tiger II', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'P-95', nome: 'P-95M Bandeirulha', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'R-35AM', nome: 'Learjet 35A', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'V-35', nome: 'Learjet 35A', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'A-1', nome: 'A-1M', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'F-39', nome: 'F-39E Gripen', cat_contraincendio: 3 },
  { categoria: 'Asa Fixa', anv: 'A-29', nome: 'A-29 Super Tucano', cat_contraincendio: 2 },
  { categoria: 'Asa Fixa', anv: 'C-98', nome: 'C-98A Grand Caravan', cat_contraincendio: 2 },
  { categoria: 'Asa Fixa', anv: 'T-27', nome: 'T-27M Tucano', cat_contraincendio: 2 },
  { categoria: 'Asa Fixa', anv: 'T-25', nome: 'T-25M Universal', cat_contraincendio: 1 },
  { categoria: 'Asa Rotativa', anv: 'H-60L', nome: 'H-60L Black Hawk', cat_contraincendio: 'H2 – CAT 3' },
  { categoria: 'Asa Rotativa', anv: 'H-36', nome: 'H-36 Caracal', cat_contraincendio: 'H2 – CAT 3' },
  { categoria: 'Asa Rotativa', anv: 'VH-35', nome: 'VH-35', cat_contraincendio: 'H2 – CAT 3' },
  { categoria: 'Asa Rotativa', anv: 'AH-2', nome: 'AH-2 Sabre', cat_contraincendio: 'H2 – CAT 3' },
  { categoria: 'Asa Rotativa', anv: 'H-50', nome: 'H-50 Esquilo', cat_contraincendio: 'H1 – CAT 2' },
];

const fireCategoryGroups = fireCategoryRows.reduce<Record<string, FireCategoryRow[]>>((acc, row) => {
  if (!acc[row.categoria]) acc[row.categoria] = [];
  acc[row.categoria].push(row);
  return acc;
}, {});

type ReferenceType = 'Asa Fixa' | 'Asa Rotativa';

type ReferenceRule = {
  range: string;
  width?: string;
  category: string;
  aerodrome?: string;
};

const fixedWingReference: ReferenceRule[] = [
  { range: '0 a 9 exclusive', width: '2', category: '1' },
  { range: '9 a 12 exclusive', width: '2', category: '2' },
  { range: '12 a 18 exclusive', width: '3', category: '3' },
  { range: '18 a 24 exclusive', width: '4', category: '4' },
  { range: '24 a 28 exclusive', width: '4', category: '5' },
  { range: '28 a 39 exclusive', width: '5', category: '6' },
  { range: '39 a 49 exclusive', width: '5', category: '7' },
  { range: '49 a 61 exclusive', width: '7', category: '8' },
  { range: '61 a 76 exclusive', width: '7', category: '9' },
  { range: '76 a 90 exclusive', width: '8', category: '10' },
];

const rotaryWingReference: ReferenceRule[] = [
  { range: '0 a 15 exclusive', category: 'H1', aerodrome: '2' },
  { range: '15 a 24 exclusive', category: 'H2', aerodrome: '3' },
  { range: '24 a 35 exclusive', category: 'H3', aerodrome: '4' },
];

function HelicopterIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M4 13h11l3-3V9a2 2 0 0 1 2-2h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 13h8a2 2 0 0 1 2 2v1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 7h5a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13h-3a2 2 0 0 0-2 2v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9V4m-2.5 2.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 16.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16.5h2m11 0h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function FireCategoryReference() {
  return (
    <section className="reference-section" aria-labelledby="reference-title">
      <div className="reference-grid">
        <div className="reference-card reference-card-wide">
          <div className="reference-card-header">
            <span className="reference-card-title">Categoria Contraincêndio</span>
          </div>
          <p className="reference-copy">
            A Categoria Contraincêndio da Aeronave é determinada conforme as características dimensionais da aeronave,
            sendo definida por critérios específicos para asa fixa e asa rotativa. Essa classificação orienta a
            compatibilidade operacional e de proteção contra incêndio no entorno da aeronave.
          </p>
          <p className="reference-copy">
            <strong>Referências:</strong> [1] RBAC 153 — ANAC · [2] ICA 92-1/2025 — COMAER
          </p>
        </div>

        <div className="reference-card">
          <div className="reference-card-header">
            <span className="reference-card-title"><Plane size={15} /> Aeronaves de Asa Fixa</span>
            <span className="reference-pill">CAT-AV 1 - 10</span>
          </div>
          <p className="reference-copy">Para aeronaves de asa fixa, determina-se inicialmente a categoria pelo comprimento total da aeronave. Em seguida, verifica-se a largura máxima da fuselagem. Caso a largura máxima da fuselagem ultrapasse o limite estabelecido para a categoria determinada pelo comprimento, a aeronave será enquadrada na categoria imediatamente superior.</p>
          <div className="category-table-wrapper">
            <table className="category-table reference-table">
              <thead>
                <tr>
                  <th>Comprimento total do avião (m)</th>
                  <th>Largura máxima da fuselagem (m)</th>
                  <th>Categoria do Avião</th>
                </tr>
              </thead>
              <tbody>
                {fixedWingReference.map((row) => (
                  <tr key={`${row.range}-${row.category}`}>
                    <td>{row.range}</td>
                    <td>{row.width}</td>
                    <td><strong>{row.category}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="reference-card">
          <div className="reference-card-header">
            <span className="reference-card-title"><HelicopterIcon size={15} /> Aeronaves de Asa Rotativa</span>
            <span className="reference-pill">CAT HL H1 - H3</span>
          </div>
          <p className="reference-copy">Para aeronaves de asa rotativa, a categoria é determinada pelo comprimento total do helicóptero, incluindo os rotores.</p>
          <div className="category-table-wrapper">
            <table className="category-table reference-table">
              <thead>
                <tr>
                  <th>Comprimento total do helicóptero (m)</th>
                  <th>Categoria do Helicóptero</th>
                  <th>Categoria do Aeródromo</th>
                </tr>
              </thead>
              <tbody>
                {rotaryWingReference.map((row) => (
                  <tr key={`${row.range}-${row.category}`}>
                    <td>{row.range}</td>
                    <td><strong>{row.category}</strong></td>
                    <td>{row.aerodrome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="reference-card reference-card-wide">
          <div className="reference-card-header">
            <span className="reference-card-title"><Flame size={15} /> Categoria Contraincêndio de Aeronaves</span>
          </div>
          <p className="reference-copy">Esta tabela apresenta a categoria de contraincêndio atribuída a cada aeronave do inventário operacional.</p>
          <div className="category-table-wrapper">
            <table className="category-table reference-table">
              <thead>
                <tr>
                  <th>TIPO DE AERONAVE</th>
                  <th>Anv</th>
                  <th>Categoria Contraincêndio</th>
                </tr>
              </thead>
              <tbody>
                {fireCategoryRows.map((row) => (
                  <tr key={`${row.categoria}-${row.anv}`}>
                    <td>{row.categoria}</td>
                    <td>{row.anv}</td>
                    <td><strong>{row.cat_contraincendio}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Plane size={18} strokeWidth={2.6} /></span><span className="brand-name">AERORESCUE</span></Link>;
}
function Shell({ children, theme, onSetTheme }: { children: ReactNode; theme: ThemeMode; onSetTheme: (mode: ThemeMode) => void; }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />

        <div className="topbar-actions">
          <div className="mobile-menu-wrap">
            <button
              className="mobile-menu-toggle"
              type="button"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              data-testid="button-mobile-menu"
            >
              <Menu size={18} />
            </button>

            {mobileMenuOpen && (
              <div className="mobile-menu" role="menu" aria-label="Menu do site">
                <Link
                  href="/"
                  className={`nav-link ${location === '/' ? 'active' : ''}`}
                  data-testid="link-mobile-home"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Layers3 size={15} /> Catálogo
                </Link>
                <Link
                  href="/categoria"
                  className={`nav-link ${location === '/categoria' ? 'active' : ''}`}
                  data-testid="link-mobile-contraincendio"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles size={15} /> Categoria Contraincêndio
                </Link>

                <div className="mobile-theme-panel" aria-label="Seletor de tema">
                  <span className="mobile-theme-label">Tema</span>
                  <div className="mobile-theme-segment">
                    <button
                      type="button"
                      className={`mobile-theme-option ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSetTheme('light');
                      }}
                    >
                      Claro
                    </button>
                    <button
                      type="button"
                      className={`mobile-theme-option ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSetTheme('dark');
                      }}
                    >
                      Escuro
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="app-content">{children}</div>
      <footer className="site-footer" aria-label="Rodapé institucional">
        <div className="site-footer-inner">
          <div className="site-footer-brand">AeroRescue © 2026</div>
          <p>Projeto independente e sem fins lucrativos, desenvolvido para contribuir com a atividade de prevenção, salvamento e combate a incêndios em aeródromos.</p>
          <div className="site-footer-slogan">Sempre prontos para Salvar!</div>
        </div>
      </footer>
    </div>
  );
}
function AircraftArt({ large = false, deactivated = false }: { large?: boolean; deactivated?: boolean }) {
  return <div className={`${large ? 'viewer-plane' : 'plane-card-art'}${deactivated ? ' deactivated-art' : ''}`} aria-label="Silhueta ilustrativa do AMX A-1"><span className="fuselage" /><span className="nose" /><span className="wing" /><span className="tail" /><span className="canopy" /><span className="stripe" /></div>;
}
function AircraftCard({
  aircraft,
  favorite,
  viewMode,
  onFavorite,
}: {
  aircraft: Aircraft;
  favorite: boolean;
  viewMode: 'grid' | 'list';
  onFavorite: () => void;
}) {
  const coverUrl = aircraft.coverImage ? `${import.meta.env.BASE_URL}${aircraft.coverImage}` : undefined;
  const isListView = viewMode === 'list';
  const isDeactivated = aircraft.status === 'Desativado';

  if (isListView) {
    return (
      <div className="aircraft-card fade-in list-view" data-testid={`card-aircraft-${aircraft.id}`}>
        <div className="aircraft-thumb">
          {coverUrl ? <img className="aircraft-thumb-image" src={coverUrl} alt={`${aircraft.name} cover`} /> : <AircraftArt deactivated={aircraft.id === 'uh-1h'} />}
          {isDeactivated && <div className="catalog-deactivated-ribbon" aria-label="Aeronave desativada">Desativado</div>}
        </div>
        <Link href={`/aeronaves/${aircraft.id}`} className="list-main-link">
          <div className="card-info">
            <div className="card-topline">
              <span className="card-tag">{getAircraftTypeLabel(aircraft)}</span>
              <span style={{ color: '#5a9b7a', fontSize: 10 }}>{getAircraftSummaryLabel(aircraft)}</span>
            </div>
            <div className="list-identity-row">
              <h2 className="card-title">{aircraft.name}</h2>
              <div className="card-meta">{aircraft.manufacturer} · {aircraft.origin}</div>
            </div>
            <div className="list-metrics">
              <span><em>tripulação</em><strong>{formatCompactMetric(aircraft.crew)}</strong></span>
              <span><em>POB max.</em><strong>{formatCompactMetric(aircraft.pobMax)}</strong></span>
            </div>
          </div>
        </Link>
        <button
          className={`favorite-toggle ${favorite ? 'on' : ''}`}
          onClick={onFavorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          data-testid={`button-favorite-${aircraft.id}`}
        >
          <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        {aircraft.categoriaContraIncendio && (
          <div className="fire-badge" data-testid={`badge-fire-${aircraft.id}`}>
            {formatFireCategoryDisplay(aircraft.categoriaContraIncendio)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="aircraft-card fade-in" data-testid={`card-aircraft-${aircraft.id}`}>
      <Link href={`/aeronaves/${aircraft.id}`}>
        <div className={`aircraft-visual${coverUrl ? ' has-cover' : ''}${aircraft.id === 'uh-1h' ? ' uh1h-visual' : ''}`}>
          {coverUrl ? <img className="aircraft-cover" src={coverUrl} alt={`${aircraft.name} cover`} /> : <AircraftArt deactivated={aircraft.id === 'uh-1h'} />}
          {isDeactivated && <div className="catalog-deactivated-ribbon" aria-label="Aeronave desativada">Desativado</div>}
        </div>
        <div className="card-info">
          <div className="card-topline">
            <span className="card-tag">{getAircraftTypeLabel(aircraft)}</span>
            <span style={{ color: '#5a9b7a', fontSize: 10 }}>{getAircraftSummaryLabel(aircraft)}</span>
          </div>
          <h2 className="card-title">{aircraft.name}</h2>
          <div className="card-meta">{aircraft.manufacturer} · {aircraft.origin}</div>
          <div className="card-specs">
            <div className="spec-item">
              <span className="spec-label">tripulação</span>
              <span className="spec-val">{formatCompactMetric(aircraft.crew)}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">POB max.</span>
              <span className="spec-val">{formatCompactMetric(aircraft.pobMax)}</span>
            </div>
          </div>
        </div>
      </Link>
      <button
        className={`favorite-toggle ${favorite ? 'on' : ''}`}
        onClick={onFavorite}
        aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        data-testid={`button-favorite-${aircraft.id}`}
      >
        <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
      </button>
      {aircraft.categoriaContraIncendio && (
        <div className="fire-badge" data-testid={`badge-fire-${aircraft.id}`}>
          {formatFireCategoryDisplay(aircraft.categoriaContraIncendio)}
        </div>
      )}
    </div>
  );
}

function HomePage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('Ordem alfabética');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [favorites, setFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('aerorescue:favorites') || '[]'));
  const [toast, setToast] = useState<Toast>(null);
  const [history] = useState(() => JSON.parse(localStorage.getItem('aerorescue:history') || '[]') as string[]);

  useEffect(() => localStorage.setItem('aerorescue:favorites', JSON.stringify(favorites)), [favorites]);

  const toggleFavorite = (id: string) => {
    const exists = favorites.includes(id);
    setFavorites(exists ? favorites.filter((item) => item !== id) : [...favorites, id]);
    setToast(exists ? 'Removido dos favoritos' : 'AMX A-1 salvo nos favoritos');
    window.setTimeout(() => setToast(null), 2200);
  };

  const filtered = useMemo(() => aircraftCatalog.filter((aircraft) => {
    if (aircraft.hidden) return false;

    const matchesQuery = `${aircraft.name} ${aircraft.manufacturer} ${aircraft.category}`.toLowerCase().includes(query.toLowerCase());
    const category = aircraft.category.toLowerCase();
    const matchesFilter = filter === 'Todos'
      || (filter === 'Civis' && isCivilAircraft(aircraft.category))
      || (filter === 'Militares' && isMilitaryAircraft(aircraft.category))
      || (filter === 'Aviões' && isFixedWingAircraft(aircraft.category))
      || (filter === 'Helicópteros' && /helicóptero|rotativa|rotor/i.test(aircraft.category));
    return matchesQuery && matchesFilter;
  }), [query, filter, favorites]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    const historyOrder = new Map(history.map((id, index) => [id, index]));
    const favoriteIds = new Set(favorites);

    if (sortBy === 'Ordem alfabética') {
      return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }

    if (sortBy === 'Mais consultados') {
      return next.sort((a, b) => {
        const aIndex = historyOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = historyOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER;

        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    if (sortBy === 'Favoritos') {
      return next.sort((a, b) => {
        const aFavorite = favoriteIds.has(a.id) ? 0 : 1;
        const bFavorite = favoriteIds.has(b.id) ? 0 : 1;

        if (aFavorite !== bFavorite) return aFavorite - bFavorite;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    if (sortBy === 'Maior Categoria Contraincêndio') {
      return next.sort((a, b) => {
        const aRank = getFireCategoryRank(a.categoriaContraIncendio);
        const bRank = getFireCategoryRank(b.categoriaContraIncendio);

        if (aRank !== bRank) return bRank - aRank;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    if (sortBy === 'Menor Categoria Contraincêndio') {
      return next.sort((a, b) => {
        const aRank = getFireCategoryRank(a.categoriaContraIncendio);
        const bRank = getFireCategoryRank(b.categoriaContraIncendio);

        if (aRank !== bRank) return aRank - bRank;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    return next;
  }, [filtered, sortBy, history, favorites]);

  const viewOptions = [
    { value: 'grid', label: 'Grade' },
    { value: 'list', label: 'Lista' },
  ] as const;
  const selectedViewLabel = viewMode === 'grid' ? 'Grade' : 'Lista';

  return (
    <main className="page-wrap">
      <div className="search-row fade-in stagger-1">
        <label className="search-box">
          <Search size={17} />
          <input
            data-testid="input-search-aircraft"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por modelo, fabricante ou função..."
          />
        </label>
      </div>

      <div className="result-count-inline">
        <div className="result-count">{aircraftCatalog.filter((aircraft) => !aircraft.hidden).length} aeronaves catalogadas</div>
      </div>

      <div className="catalog-grid">
        <section className="catalog-main-column">
          <div className="result-head">
            <div />
            <div className="catalog-controls">
              <div className="control-group">
                <span className="control-label">Tipo</span>
                <select
                  className="sort-select"
                  aria-label="Filtrar resultados"
                  data-testid="select-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  {quickFilters.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <span className="control-label">Ordenar por</span>
                <select
                  className="sort-select"
                  aria-label="Ordenar resultados"
                  data-testid="select-sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option>Ordem alfabética</option>
                  <option>Mais consultados</option>
                  <option>Favoritos</option>
                  <option>Maior Categoria Contraincêndio</option>
                  <option>Menor Categoria Contraincêndio</option>
                </select>
              </div>

              <div className="control-group">
                <span className="control-label">Visualização</span>
                <select
                  className="sort-select"
                  aria-label="Visualização do catálogo"
                  data-testid="select-view-mode"
                  value={selectedViewLabel}
                  onChange={(event) => setViewMode(event.target.value === 'Lista' ? 'list' : 'grid')}
                >
                  {viewOptions.map((option) => (
                    <option key={option.value} value={option.label}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={`aircraft-grid${viewMode === 'list' ? ' list' : ''}`}>
            {sorted.length ? (
              sorted.map((aircraft, index) => (
                <AircraftCard
                  key={aircraft.id}
                  aircraft={aircraft}
                  favorite={favorites.includes(aircraft.id)}
                  viewMode={viewMode}
                  onFavorite={() => toggleFavorite(aircraft.id)}
                />
              ))
            ) : (
              <div className="empty-state">
                <Search size={25} />
                <h3>Nenhuma aeronave encontrada</h3>
                <p>Não há resultados para “{query}”. Tente outro modelo ou limpe os filtros.</p>
                <button
                  className="outline-btn"
                  onClick={() => {
                    setQuery('');
                    setFilter('Todos');
                  }}
                  data-testid="button-clear-search"
                >
                  Limpar busca
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {toast && (
        <div className="toast" role="status" data-testid="status-toast">
          <Check size={14} style={{ verticalAlign: 'middle', marginRight: 7, color: '#efb349' }} />
          {toast}
        </div>
      )}
    </main>
  );
}

function CategoryPage() {
  return (
    <main className="page-wrap">
      <div className="crumb">
        <Link href="/" data-testid="link-breadcrumb-catalogo">Catálogo</Link>
        <ArrowRight size={12} />
        <span>Categoria Contraincêndio</span>
      </div>

      <div className="info-heading" style={{ marginBottom: 22 }}>
        <span>
          <Sparkles size={15} className="heading-icon" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Categoria Contraincêndio
        </span>
      </div>

      <FireCategoryReference />
    </main>
  );
}

function Viewer({ aircraft }: { aircraft: Aircraft }) {
  const [selected, setSelected] = useState(1);
  const [overviewIndex, setOverviewIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const hotspotText: Record<number, string> = {
    1: 'Cabine e canopy — acesso primário do piloto.',
    2: 'Ponto de parada — manter equipe fora da exaustão.',
    3: 'Área de cauda — atenção à deriva e superfícies móveis.',
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  const rawOverviewModels = aircraft.overviewModels && aircraft.overviewModels.length > 0
    ? aircraft.overviewModels
    : aircraft.sketchfabModelId
      ? [{ label: 'Visão geral 1', sketchfabModelId: aircraft.sketchfabModelId }]
      : [];

  const overviewModels = rawOverviewModels.map((model) => ({
    ...model,
    label: normalizeOverviewLabel(model.label),
  }));

  const selectedModel = overviewModels[overviewIndex] || overviewModels[0] || null;
  const isDeactivated = aircraft.status === 'Desativado';
  const embedUrl = selectedModel?.sketchfabModelId
      ? `https://sketchfab.com/models/${selectedModel.sketchfabModelId}/embed?autostart=1&ui_infos=0&ui_controls=1&ui_annots=0&ui_watermark=0`
      : selectedModel?.url
        ? selectedModel.url
      : null;

  return (
    <div className={`viewer ${fullscreen ? 'viewer-fullscreen' : ''}`} data-testid="viewer-3d">
      <div className="viewer-grid" />
      <div className="viewer-label">{aircraft.name} / VISUALIZAÇÃO TÉCNICA</div>
      {isDeactivated && <div className="deactivated-ribbon" aria-label="Aeronave desativada">Desativado</div>}

      {overviewModels.length > 1 && (
        <div className="viewer-overview-switch">
          <div className="viewer-switcher" aria-label="Seleção de visão geral">
            {overviewModels.map((model, index) => (
              <button
                key={model.label}
                className={`viewer-mode-button ${index === overviewIndex ? 'active' : ''}`}
                onClick={() => {
                  setOverviewIndex(index);
                  showToast(model.label);
                }}
                data-testid={`button-overview-${index + 1}`}
              >
                {model.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {embedUrl ? (
        <>
          <div className="viewer-model-reference">
            <span className="model-ref-label">Modelos disponíveis:</span>
            <div className="model-ref-list">
              {overviewModels.map((model) => (
                <a
                  key={model.label}
                  href={model.url || `https://sketchfab.com/models/${model.sketchfabModelId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="model-ref-link"
                >
                  {model.label}
                </a>
              ))}
            </div>
          </div>
          <iframe
            title={`${aircraft.name} ${selectedModel.label} 3D model`}
            src={embedUrl}
            frameBorder="0"
            allow="autoplay; fullscreen; vr; accelerometer; magnetometer; gyroscope"
            allowFullScreen
            className="viewer-iframe"
          />
        </>
      ) : (
        <>
          <div className="viewer-label">{aircraft.name} / VISUALIZAÇÃO TÉCNICA</div>
          <div className="viewer-legend"><span className="legend-dot" /> HOTSPOTS ATIVOS</div>
          <AircraftArt large />
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`hotspot ${n === 1 ? 'one' : n === 2 ? 'two' : 'three'} ${selected === n ? 'selected' : ''}`}
              onClick={() => setSelected(n)}
              data-testid={`button-hotspot-${n}`}
            >
              {n.toString().padStart(2, '0')}
            </button>
          ))}
          <div className="hotspot-note" data-testid="text-hotspot-note">
            <strong style={{ display: 'block', color: '#efb349', fontSize: 10, marginBottom: 3 }}>
              PONTO {selected.toString().padStart(2, '0')}
            </strong>
            {hotspotText[selected]}
          </div>
          <div className="viewer-tools">
            <div className="viewer-controls">
              <button className="viewer-tool" onClick={() => setFullscreen((value) => !value)}>
                {fullscreen ? 'Fechar vista' : 'Ampliar vista'}
              </button>
              <button className="viewer-tool" onClick={() => showToast(`Hotspot ${selected.toString().padStart(2, '0')}`)}>
                Detalhe {selected.toString().padStart(2, '0')}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="toast" role="status" data-testid="status-viewer-toast">
          <Check size={14} style={{ verticalAlign: 'middle', marginRight: 7, color: '#efb349' }} />
          {toast}
        </div>
      )}
    </div>
  );
}

function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const aircraft = aircraftCatalog.find((item) => item.id === id) || aircraftCatalog[0];
  const [activeTab, setActiveTab] = useState('Visão geral');
  const [selectedTechnicalVariant, setSelectedTechnicalVariant] = useState(() => (
    aircraft.technicalVariants ? Object.keys(aircraft.technicalVariants)[0] : 'e99m'
  ));
  const [favorite, setFavorite] = useState(() => JSON.parse(localStorage.getItem('aerorescue:favorites') || '[]').includes(aircraft.id));
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('aerorescue:history') || '[]');
    localStorage.setItem(
      'aerorescue:history',
      JSON.stringify([aircraft.id, ...history.filter((item: string) => item !== aircraft.id)].slice(0, 5)),
    );
  }, [aircraft.id]);

  const toggleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem('aerorescue:favorites') || '[]') as string[];
    const next = favorites.includes(aircraft.id)
      ? favorites.filter((item) => item !== aircraft.id)
      : [...favorites, aircraft.id];

    localStorage.setItem('aerorescue:favorites', JSON.stringify(next));
    setFavorite(!favorite);
    setToast(!favorite ? 'AMX A-1 salvo nos favoritos' : 'Removido dos favoritos');
    window.setTimeout(() => setToast(null), 2200);
  };

  const overviewAndGalleryOnly = new Set(['uh-1h']);
  const tabs = overviewAndGalleryOnly.has(aircraft.id) ? ['Visão geral', 'Galeria'] : ['Visão geral', 'Material', 'Galeria', 'Vídeos'];
  const coverUrl = aircraft.coverImage ? `${import.meta.env.BASE_URL}${aircraft.coverImage}` : undefined;
  const galleryItems = aircraft.gallery && aircraft.gallery.length > 0 ? aircraft.gallery : [{ title: aircraft.name, url: coverUrl }];
  const videoItems = aircraft.videos && aircraft.videos.length > 0 ? aircraft.videos : [];
  const driveVideoItems = videoItems.filter((video) => video.url.includes('drive.google.com'));
  const youtubeVideoItems = videoItems.filter((video) => !video.url.includes('drive.google.com'));
  const materialItems = aircraft.manuals && aircraft.manuals.length > 0 ? aircraft.manuals : [];
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState<number | null>(null);
  const [expandedGalleryItem, setExpandedGalleryItem] = useState<GalleryItem | null>(null);
  const [mediaTitles, setMediaTitles] = useState<Record<string, string>>({});
  const selectedVideo = selectedVideoIndex === null ? null : videoItems[selectedVideoIndex] || null;
  const selectedMaterial = selectedMaterialIndex === null ? null : materialItems[selectedMaterialIndex] || null;
  const selectedVideoEmbedUrl = selectedVideo ? getVideoEmbedUrl(selectedVideo.url) : null;
  const selectedMaterialEmbedUrl = selectedMaterial?.url ? getDrivePreviewUrl(selectedMaterial.url) : null;
  const renderVideoGroup = (title: string, items: VideoLink[]) => (
    items.length > 0 && (
      <section className="video-group" aria-labelledby={`video-group-${title.toLowerCase()}`}>
        <h4 id={`video-group-${title.toLowerCase()}`} className="video-group-title">{title}</h4>
        <div className="video-list">
          {items.map((video) => {
            const index = videoItems.indexOf(video);
            return (
              <button
                type="button"
                className={`manual-row video-row ${selectedVideoIndex === index ? 'active' : ''}`}
                key={`${video.title}-${index}`}
                onClick={() => setSelectedVideoIndex(index)}
                data-testid={`button-select-video-${index}`}
              >
                <span className="manual-icon"><Play size={16} /></span>
                <span>
                  <span className="manual-name">{getMediaTitle(video.url, video.title)}</span>
                  <span className="manual-meta">{video.url}</span>
                </span>
                <a className="icon-btn" href={video.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  Abrir <ArrowRight size={13} />
                </a>
              </button>
            );
          })}
        </div>
      </section>
    )
  );
  const technicalVariant = aircraft.technicalVariants?.[selectedTechnicalVariant];
  const technicalCategory = technicalVariant?.category || aircraft.category;
  const technicalRole = technicalVariant?.role || aircraft.role;
  const technicalCrew = technicalVariant?.crew || aircraft.crew;
  const technicalPobMax = technicalVariant?.pobMax || aircraft.pobMax;
  const technicalDesignation = technicalVariant?.designacaoFab || aircraft.designacaoFab;

  useEffect(() => {
    if (!expandedGalleryItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedGalleryItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedGalleryItem]);

  useEffect(() => {
    const activeMediaItems = activeTab === 'Material' ? materialItems : activeTab === 'Vídeos' ? videoItems : [];
    const mediaUrls = activeMediaItems.map((item) => item.url).filter(
      (url): url is string => Boolean(url),
    );
    const uncachedUrls = mediaUrls.filter((url) => !mediaTitles[url]);
    if (!uncachedUrls.length) return;

    let cancelled = false;
    const loadTitles = async () => {
      const resolvedTitles: Array<readonly [string, string]> = [];
      let nextIndex = 0;
      const worker = async () => {
        while (!cancelled) {
          const url = uncachedUrls[nextIndex++];
          if (!url) return;
          try {
            const response = await fetch(`/api/media-metadata?url=${encodeURIComponent(url)}`);
            if (!response.ok) continue;
            const payload = (await response.json()) as { title?: string | null };
            if (payload.title) resolvedTitles.push([url, payload.title]);
          } catch {
            // Keep rendering the catalog if an individual source is unavailable.
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(6, uncachedUrls.length) }, () => worker()),
      );
      if (!cancelled && resolvedTitles.length) {
        setMediaTitles((current) => ({ ...current, ...Object.fromEntries(resolvedTitles) }));
      }
    };

    void loadTitles();
    return () => {
      cancelled = true;
    };
  }, [activeTab, aircraft.id, materialItems, videoItems, mediaTitles]);

  const getMediaTitle = (url: string | undefined, fallback: string) => (url && mediaTitles[url]) || fallback;

  const handlePrint = () => {
    setActiveTab('Visão geral');
    document.body.classList.add('print-mode');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove('print-mode'), 250);
    }, 30);
  };

  return (
    <main className="page-wrap">
      <div className="crumb">
        <Link href="/" data-testid="link-breadcrumb-catalogo">Catálogo</Link>
        <ArrowRight size={12} />
        <span>{aircraft.name}</span>
      </div>

      <div className="detail-head">
        <div>
          <h1 className="page-title">{aircraft.name}</h1>
          <p className="page-lede">
            {aircraft.manufacturer} · {technicalCategory} - {technicalRole}
          </p>
        </div>

        <div className="detail-actions">
          <button className="outline-btn" onClick={handlePrint} data-testid="button-print">
            <FileText size={15} />
            <span>Imprimir ficha</span>
          </button>
          <button className={`outline-btn ${favorite ? 'filter-btn active' : ''}`} onClick={toggleFavorite} data-testid="button-detail-favorite">
            <Heart size={15} fill={favorite ? 'currentColor' : 'none'} />
            <span>{favorite ? 'Favoritado' : 'Favoritar'}</span>
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-info-panel">
          <Viewer aircraft={aircraft} />

          <div className="info-card">
            <div className="info-heading">
              <span>
                <Gauge size={15} className="heading-icon" style={{ verticalAlign: 'middle', marginRight: 7 }} />
                ficha informativa
              </span>
              <span className="section-kicker">{technicalVariant ? technicalVariant.label : 'SI / métrico'}</span>
            </div>

            {aircraft.technicalVariants && (
              <div className="technical-variant-selector" aria-label="Selecionar variante técnica">
                <span className="technical-variant-label">Configuração da ficha</span>
                <div className="technical-variant-options">
                  {Object.entries(aircraft.technicalVariants).map(([variantKey, variant]) => (
                    <button
                      key={variantKey}
                      type="button"
                      className={`technical-variant-button ${selectedTechnicalVariant === variantKey ? 'active' : ''}`}
                      onClick={() => setSelectedTechnicalVariant(variantKey)}
                      data-testid={`button-technical-variant-${variantKey}`}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aircraft.categoriaContraIncendio && (
              <div className="fire-category-banner" aria-label="Categoria de contra incêndio">
                <span className="fire-category-label">Categoria Contraincêndio</span>
                <strong>{formatFireCategoryDisplay(aircraft.categoriaContraIncendio)}</strong>
              </div>
            )}

            <div className="metric-list">
              {technicalDesignation && (
                <div className="metric">
                  <span className="metric-label">{getAircraftIdentificationLabel(aircraft)}</span>
                  <span className="metric-value">{technicalDesignation}</span>
                </div>
              )}
              <div className="metric"><span className="metric-label">tripulação</span><span className="metric-value">{technicalCrew}</span></div>
              <div className="metric"><span className="metric-label">POB max.</span><span className="metric-value">{technicalPobMax}</span></div>
              <div className="metric"><span className="metric-label">categoria</span><span className="metric-value">{technicalCategory}</span></div>
              <div className="metric"><span className="metric-label">papel operacional</span><span className="metric-value">{technicalRole}</span></div>
              <div className="metric"><span className="metric-label">origem</span><span className="metric-value">{aircraft.origin}</span></div>
              <div className="metric"><span className="metric-label">entrada em serviço</span><span className="metric-value">{aircraft.year}</span></div>
              <div className="metric"><span className="metric-label">comprimento</span><span className="metric-value">{aircraft.length}</span></div>
              <div className="metric"><span className="metric-label">envergadura</span><span className="metric-value">{aircraft.wingspan}</span></div>
              <div className="metric"><span className="metric-label">altura</span><span className="metric-value">{aircraft.height}</span></div>
              <div className="metric"><span className="metric-label">velocidade máx.</span><span className="metric-value">{aircraft.maxSpeed}</span></div>
              <div className="metric"><span className="metric-label">alcance</span><span className="metric-value">{aircraft.range}</span></div>
              <div className="metric"><span className="metric-label">peso máx. decolagem</span><span className="metric-value">{aircraft.weight}</span></div>
              {aircraft.fabricanteDetalhe && <div className="metric"><span className="metric-label">Fabricante</span><span className="metric-value">{aircraft.fabricanteDetalhe}</span></div>}
              {aircraft.alturaSoloCockpit && <div className="metric"><span className="metric-label">Altura solo ao cockpit</span><span className="metric-value">{aircraft.alturaSoloCockpit}</span></div>}
              {aircraft.combustivel && <div className="metric"><span className="metric-label">Combustível</span><span className="metric-value">{aircraft.combustivel}</span></div>}
              {aircraft.quantidadeSaidas && <div className="metric"><span className="metric-label">Quantidade de saídas</span><span className="metric-value">{aircraft.quantidadeSaidas}</span></div>}
              {aircraft.assentoEjetavel && <div className="metric"><span className="metric-label">Assento ejetável</span><span className="metric-value">{aircraft.assentoEjetavel}</span></div>}
              {(technicalVariant?.sistemaDefesa || aircraft.sistemaDefesa) && <div className="metric"><span className="metric-label">Sistema de defesa</span><span className="metric-value">{technicalVariant?.sistemaDefesa || aircraft.sistemaDefesa}</span></div>}
              {aircraft.motor && <div className="metric"><span className="metric-label">Motor</span><span className="metric-value">{aircraft.motor}</span></div>}
              {aircraft.armamentoFixo && <div className="metric"><span className="metric-label">Armamento fixo</span><span className="metric-value">{aircraft.armamentoFixo}</span></div>}
              {aircraft.armamentosCompativeis && <div className="metric"><span className="metric-label">Armamentos compatíveis</span><span className="metric-value">{aircraft.armamentosCompativeis}</span></div>}
            </div>
          </div>

          <p className="info-note">As informações apresentadas são destinadas à consulta e podem variar conforme versão, configuração ou fonte.</p>
        </div>
      </div>

      <nav className="tab-bar" aria-label="Seções da ficha">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-${tab.toLowerCase().replaceAll(' ', '-')}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {activeTab === 'Visão geral' && (
          <div className="text-card">
            <h3>Perfil operacional</h3>
            <p>
              {aircraft.name} é uma {technicalCategory.toLowerCase()} com {technicalRole.toLowerCase()}. A configuração operacional atual está alinhada com {aircraft.origin} e com {technicalCrew.toLowerCase()} na tripulação.
            </p>
          </div>
        )}

        {activeTab === 'Material' && (
          <div className="text-card" id="biblioteca">
            <h3>Material</h3>
            <p style={{ marginBottom: 15 }}>Links de referência do Google Drive.</p>

            <div className="video-player-mold">
              {selectedMaterial ? (
                selectedMaterialEmbedUrl ? (
                  <iframe
                    className="document-mold-frame"
                    src={selectedMaterialEmbedUrl}
                    title={getMediaTitle(selectedMaterial.url, selectedMaterial.name)}
                    frameBorder="0"
                    loading="eager"
                    scrolling="yes"
                    allow="fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <div className="video-mold-placeholder">Este material não pode ser visualizado neste player.</div>
                )
              ) : (
                <div className="video-mold-placeholder">Clique em um material abaixo para visualizar.</div>
              )}
            </div>

            <div className="video-list">
              {materialItems.length ? (
                materialItems.map((manual, index) => (
                  <button
                    type="button"
                    className={`manual-row video-row ${selectedMaterialIndex === index ? 'active' : ''}`}
                    key={`${manual.name}-${index}`}
                    onClick={() => setSelectedMaterialIndex(index)}
                    data-testid={`button-select-manual-${index}`}
                  >
                    <span className="manual-icon"><FileText size={16} /></span>
                    <span>
                      <span className="manual-name">{getMediaTitle(manual.url, manual.name)}</span>
                      <span className="manual-meta">{manual.meta}</span>
                    </span>
                    <a className="icon-btn" href={manual.url || '#'} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                      Abrir <ArrowRight size={13} />
                    </a>
                  </button>
                ))
              ) : (
                <div className="manual-row">
                  <span className="manual-icon"><FileText size={16} /></span>
                  <span>
                    <span className="manual-name">Material em breve</span>
                    <span className="manual-meta">Links do Google Drive serão adicionados aqui.</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Galeria' && (
          <div className="text-card">
            <h3>Galeria</h3>
            <p style={{ marginBottom: 15 }}>Fotos de referência para apoio operacional.</p>
            <div className="gallery-grid">
              {galleryItems.map((item, index) => (
                <button
                  type="button"
                  className="gallery-tile"
                  key={`${item.title}-${index}`}
                  data-testid={`gallery-image-${index + 1}`}
                  onClick={() => item.url && setExpandedGalleryItem(item)}
                  aria-label={`Ampliar ${item.title}`}
                >
                  {item.url && <img className="gallery-image" src={getDriveImageUrl(item.url)} alt={item.title} />}
                </button>
              ))}
            </div>
            {expandedGalleryItem?.url && (
              <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={expandedGalleryItem.title} onClick={() => setExpandedGalleryItem(null)}>
                <button type="button" className="gallery-lightbox-close" aria-label="Fechar imagem ampliada" onClick={() => setExpandedGalleryItem(null)}>
                  <X size={20} />
                </button>
                <img className="gallery-lightbox-image" src={getDriveImageUrl(expandedGalleryItem.url)} alt={expandedGalleryItem.title} onClick={(event) => event.stopPropagation()} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'Vídeos' && (
          <div className="text-card" id="videos-section">
            <h3>Vídeos</h3>
            <div className="video-player-mold">
              {selectedVideo ? (
                selectedVideoEmbedUrl ? (
                  <iframe
                    className="video-mold-frame"
                    src={selectedVideoEmbedUrl}
                    title={getMediaTitle(selectedVideo.url, selectedVideo.title)}
                    data-drive-video="true"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="video-mold-placeholder">Este vídeo não pode ser reproduzido neste player.</div>
                )
              ) : (
                <div className="video-mold-placeholder">Clique em um vídeo abaixo para abrir no player.</div>
              )}
            </div>

            {videoItems.length ? (
              <>
                {renderVideoGroup('Google Drive', driveVideoItems)}
                {renderVideoGroup('YouTube', youtubeVideoItems)}
              </>
            ) : (
                <div className="manual-row">
                  <span className="manual-icon"><Play size={16} /></span>
                  <span>
                    <span className="manual-name">Vídeos em breve</span>
                    <span className="manual-meta">Links do YouTube serão adicionados aqui.</span>
                  </span>
                </div>
              )}
          </div>
        )}
      </div>

      {toast && (
        <div className="toast" role="status" data-testid="status-detail-toast">
          <Check size={14} style={{ verticalAlign: 'middle', marginRight: 7, color: '#efb349' }} />
          {toast}
        </div>
      )}
    </main>
  );
}

function Router() { return <Switch><Route path="/" component={HomePage} /><Route path="/categoria" component={CategoryPage} /><Route path="/aeronaves/:id" component={DetailPage} /><Route component={NotFound} /></Switch>; }
function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    return (window.localStorage.getItem('aerorescue:theme') as ThemeMode | null) ?? 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    window.localStorage.setItem('aerorescue:theme', theme);
  }, [theme]);

  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Shell theme={theme} onSetTheme={setTheme}><Router /></Shell></WouterRouter>;
}
export default App;

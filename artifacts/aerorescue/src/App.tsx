import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, ClipboardList, Crosshair, FileText, Gauge, Heart, History, Layers3, Maximize2, Menu, Minimize2, Moon, Move3d, Plane, Play, Rotate3d, Search, SlidersHorizontal, Sparkles, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import NotFound from '@/pages/not-found';
import { aircraftCatalog, quickFilters, type Aircraft, type VideoLink } from '@/data/aircraft';

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
  return match ? `https://drive.google.com/file/d/${match[1]}/preview` : null;
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
    return `CAT HL H${helicopterLevel} → CAT-AV ${equivalent}`;
  }

  const fixedMatch = normalized.match(/(\d+)/);
  if (fixedMatch) {
    return `CAT-AV ${Number(fixedMatch[1])}`;
  }

  return text;
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

function FireCategoryReference() {
  return (
    <section className="reference-section" aria-labelledby="reference-title">
      <div className="reference-heading">
        <div>
          <h2 id="reference-title">Categoria Contraincêndio</h2>
        </div>
      </div>

      <div className="reference-grid">
        <div className="reference-card">
          <div className="reference-card-heading">
            <span><Sparkles size={15} /> Explicação</span>
          </div>
          <p className="reference-intro">
            A Categoria Contraincêndio da Aeronave é determinada conforme as características dimensionais da aeronave,
            sendo definida por critérios específicos para asa fixa e asa rotativa. Essa classificação orienta a
            compatibilidade operacional e de proteção contra incêndio no entorno da aeronave.
          </p>
          <p className="reference-footnote">
            <strong>Referências:</strong> [1] RBAC 153 — ANAC · [2] ICA 92-1/2025 — COMAER
          </p>
        </div>

        <div className="reference-card">
          <div className="reference-card-heading">
            <span><Plane size={15} /> Como calcular — Asa Fixa</span>
            <span className="section-kicker">categorias 1 — 10</span>
          </div>
          <p>Para aeronaves de asa fixa, determina-se inicialmente a categoria pelo comprimento total da aeronave. Em seguida, verifica-se a largura máxima da fuselagem. Caso a largura máxima da fuselagem ultrapasse o limite estabelecido para a categoria determinada pelo comprimento, a aeronave será enquadrada na categoria imediatamente superior.</p>
          <div className="category-table-wrapper">
            <table className="category-table reference-table">
              <thead>
                <tr>
                  <th>Comprimento total do avião (m)</th>
                  <th>Largura máxima da fuselagem (m)</th>
                  <th>Categoria</th>
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
          <div className="reference-card-heading">
            <span><Plane size={15} /> Como calcular — Asa Rotativa</span>
            <span className="section-kicker">categorias H1 — H3</span>
          </div>
          <p>Para aeronaves de asa rotativa, a categoria é determinada pelo comprimento total do helicóptero, incluindo os rotores.</p>
          <div className="category-table-wrapper">
            <table className="category-table reference-table">
              <thead>
                <tr>
                  <th>Comprimento total do helicóptero (m)</th>
                  <th>Categoria</th>
                  <th>Área de pouso</th>
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
      </div>
    </section>
  );
}rimento total do helicóptero (m)</th><th>Categoria do helicóptero</th><th>Categoria do aeródromo</th></tr></thead><tbody>{rotaryWingReference.map((row) => <tr key={`${row.range}-${row.category}`}><td>{row.range}</td><td><strong>{row.category}</strong></td><td>{row.aerodrome}</td></tr>)}</tbody></table></div></div></div><div className="reference-card"><div className="reference-card-heading"><span><Plane size={15} /> Aeronaves e Categoria Contraincêndio</span><span className="section-kicker">lista de aeronaves</span></div><p>Esta tabela apresenta a categoria de contraincêndio atribuída a cada aeronave do inventário operacional.</p><div className="category-table-wrapper"><table className="category-table reference-table"><thead><tr><th>Categoria</th><th>Anv</th><th>Nome</th><th>Categoria Contraincêndio</th></tr></thead><tbody>{fireCategoryRows.map((row) => <tr key={`${row.categoria}-${row.anv}`}><td>{row.categoria}</td><td>{row.anv}</td><td>{row.nome}</td><td><strong>{row.cat_contraincendio}</strong></td></tr>)}</tbody></table></div></div></section>;
}

function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Plane size={18} strokeWidth={2.6} /></span><span><span className="brand-name">AERORESCUE</span><span className="brand-sub">catálogo operacional · SESCINC</span></span></Link>;
}
function Shell({ children, theme, onToggleTheme }: { children: ReactNode; theme: ThemeMode; onToggleTheme: () => void }) {
  const [location] = useLocation();
  return <div className="app-shell"><header className="topbar"><Brand /><nav className="topnav" aria-label="Navegação principal"><Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-catalogo"><Layers3 size={15} /> Catálogo</Link><Link href="/categoria" className={`nav-link ${location === '/categoria' ? 'active' : ''}`} data-testid="link-contraincendio"><Sparkles size={15} /> Categoria Contraincêndio</Link></nav><div className="topbar-spacer" /><div className="status-pill" data-testid="status-offline"><span className="status-dot" /> banco local sincronizado</div><button className="theme-toggle" onClick={onToggleTheme} aria-label={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`} data-testid="button-theme-toggle">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}<span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span></button><span className="profile-badge" data-testid="text-profile">BS</span><div className="mobile-nav"><Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-mobile-home"><Layers3 size={17} /></Link><Link href="/categoria" className={`nav-link ${location === '/categoria' ? 'active' : ''}`} data-testid="link-mobile-contraincendio"><Sparkles size={17} /></Link></div></header>{children}</div>;
}
function AircraftArt({ large = false }: { large?: boolean }) {
  return <div className={large ? 'viewer-plane' : 'plane-card-art'} aria-label="Silhueta ilustrativa do AMX A-1"><span className="fuselage" /><span className="nose" /><span className="wing" /><span className="tail" /><span className="canopy" /><span className="stripe" /></div>;
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

  if (isListView) {
    return (
      <div className="aircraft-card fade-in list-view" data-testid={`card-aircraft-${aircraft.id}`}>
        <div className="aircraft-thumb">
          {coverUrl ? <img className="aircraft-thumb-image" src={coverUrl} alt={`${aircraft.name} cover`} /> : <AircraftArt />}
        </div>
        <Link href={`/aeronaves/${aircraft.id}`} className="list-main-link">
          <div className="card-info">
            <div className="card-topline">
              <span className="card-tag">{aircraft.category}</span>
              <span style={{ color: '#5a9b7a', fontSize: 10 }}>● {aircraft.status}</span>
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
        <div className={`aircraft-visual${coverUrl ? ' has-cover' : ''}`}>
          {coverUrl ? <img className="aircraft-cover" src={coverUrl} alt={`${aircraft.name} cover`} /> : <AircraftArt />}
        </div>
        <div className="card-info">
          <div className="card-topline">
            <span className="card-tag">{aircraft.category}</span>
            <span style={{ color: '#5a9b7a', fontSize: 10 }}>● {aircraft.status}</span>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [history] = useState(() => JSON.parse(localStorage.getItem('aerorescue:history') || '[]') as string[]);

  useEffect(() => localStorage.setItem('aerorescue:favorites', JSON.stringify(favorites)), [favorites]);

  const toggleFavorite = (id: string) => {
    const exists = favorites.includes(id);
    setFavorites(exists ? favorites.filter((item) => item !== id) : [...favorites, id]);
    setToast(exists ? 'Removido dos favoritos' : 'AMX A-1 salvo nos favoritos');
    window.setTimeout(() => setToast(null), 2200);
  };

  const filtered = useMemo(() => aircraftCatalog.filter((aircraft) => {
    const matchesQuery = `${aircraft.name} ${aircraft.manufacturer} ${aircraft.category}`.toLowerCase().includes(query.toLowerCase());
    const category = aircraft.category.toLowerCase();
    const matchesFilter = filter === 'Todos'
      || (filter === 'Favoritos' && favorites.includes(aircraft.id))
      || (filter === 'Civis' && category.includes('civil'))
      || (filter === 'Militares' && category.includes('militar'))
      || (filter === 'Jatos' && category.includes('jato'))
      || (filter === 'Helicópteros' && category.includes('helicóptero'))
      || (filter === 'Transporte' && category.includes('transporte'));
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

    return next;
  }, [filtered, sortBy, history, favorites]);

  const viewOptions = [
    { value: 'grid', label: 'Grade' },
    { value: 'list', label: 'Lista' },
  ] as const;

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
          <span style={{ font: '10px var(--app-font-mono)', color: '#9ba8a8' }}>⌘ K</span>
        </label>
        <button
          className={`filter-btn ${filtersOpen ? 'active' : ''}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
          data-testid="button-toggle-filters"
        >
          <SlidersHorizontal size={15} /> Filtros <ChevronDown size={14} />
        </button>
      </div>

      <div className="catalog-grid">
        <section>
          <div className="result-head">
            <div>
              <span className="section-kicker">inventário de aeronaves</span>
              <div className="result-count">
                {sorted.length} resultado{sorted.length !== 1 ? 's' : ''}
                <span> / {aircraftCatalog.length} catalogado</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              </select>

              <div className="view-mode-switch" role="group" aria-label="Modo de visualização de catálogo">
                {viewOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`view-mode-button ${viewMode === option.value ? 'active' : ''}`}
                    onClick={() => setViewMode(option.value)}
                    data-testid={`button-view-${option.value}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(filtersOpen || filter !== 'Todos') && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 15 }}>
              <span className="section-kicker" style={{ alignSelf: 'center', marginRight: 5 }}>
                filtrar por
              </span>
              {quickFilters.map((item) => (
                <button
                  key={item}
                  className={`filter-btn ${filter === item ? 'active' : ''}`}
                  style={{ height: 31, padding: '0 10px', fontSize: 10 }}
                  onClick={() => setFilter(item)}
                  data-testid={`button-filter-${item.toLowerCase()}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

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

        <aside>
          <div className="side-panel">
            <div className="side-heading">
              <span>
                <History size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> histórico recente
              </span>
              <small>{history.length || 1} item</small>
            </div>
            <div className="history-row">
              <div className="history-thumb">
                <AircraftArt />
              </div>
              <div>
                <div className="history-name">AMX A-1</div>
                <div className="history-time">consultado agora</div>
              </div>
            </div>
          </div>

          <div className="side-panel" id="operacional">
            <div className="side-heading">
              <span>
                <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> para a sua operação
              </span>
            </div>
            <ul className="tip-list">
              <li>
                <ClipboardList size={14} /> Procedimentos revisados para treinamento e resposta.
              </li>
              <li>
                <CircleHelp size={14} /> Use os hotspots para localizar acessos e zonas críticas.
              </li>
            </ul>
          </div>
        </aside>
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
  const [selected, setSelected] = useState(1); const [overviewIndex, setOverviewIndex] = useState(0); const [fullscreen, setFullscreen] = useState(false); const [toast, setToast] = useState<Toast>(null); const hotspotText: Record<number, string> = { 1: 'Cabine e canopy — acesso primário do piloto.', 2: 'Ponto de parada — manter equipe fora da exaustão.', 3: 'Área de cauda — atenção à deriva e superfícies móveis.' }; const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(null), 1800); };
  const rawOverviewModels = aircraft.overviewModels && aircraft.overviewModels.length > 0 ? aircraft.overviewModels : aircraft.sketchfabModelId ? [{ label: 'Visão geral 1', sketchfabModelId: aircraft.sketchfabModelId }] : [];
  const overviewModels = rawOverviewModels.map((model) => ({ ...model, label: normalizeOverviewLabel(model.label) }));
  const selectedModel = overviewModels[overviewIndex] || overviewModels[0] || null;
  const embedUrl = selectedModel?.url
    ? selectedModel.url
    : selectedModel?.sketchfabModelId
      ? `https://sketchfab.com/models/${selectedModel.sketchfabModelId}/embed?autostart=1&ui_infos=0&ui_controls=1&ui_annots=0&ui_watermark=0`
      : null;
  return <div className={`viewer ${fullscreen ? 'viewer-fullscreen' : ''}`} data-testid="viewer-3d"><div className="viewer-grid" /><div className="viewer-label">{aircraft.name} / VISUALIZAÇÃO TÉCNICA</div>{overviewModels.length > 1 && <div className="viewer-overview-switch"><div className="viewer-switcher" aria-label="Seleção de visão geral">{overviewModels.map((model, index) => <button key={model.label} className={`viewer-mode-button ${index === overviewIndex ? 'active' : ''}`} onClick={() => { setOverviewIndex(index); showToast(model.label); }} data-testid={`button-overview-${index + 1}`}>{model.label}</button>)}</div></div>}{embedUrl ? <><div className="viewer-model-reference"><span className="model-ref-label">Modelos disponíveis:</span><div className="model-ref-list">{overviewModels.map((model) => <a key={model.label} href={`https://sketchfab.com/models/${model.sketchfabModelId}`} target="_blank" rel="noreferrer" className="model-ref-link">{model.label}</a>)}</div></div><iframe title={`${aircraft.name} ${selectedModel.label} 3D model`} src={embedUrl} frameBorder="0" allow="autoplay; fullscreen; vr; accelerometer; magnetometer; gyroscope" allowFullScreen className="viewer-iframe" /></> : <><div className="viewer-label">{aircraft.name} / VISUALIZAÇÃO TÉCNICA</div><div className="viewer-legend"><span className="legend-dot" /> HOTSPOTS ATIVOS</div><AircraftArt large />{[1, 2, 3].map((n) => <button key={n} className={`hotspot ${n === 1 ? 'one' : n === 2 ? 'two' : 'three'} ${selected === n ? 'selected' : ''}`} onClick={() => setSelected(n)} data-testid={`button-hotspot-${n}`}>{n.toString().padStart(2, '0')}</button>)}<div className="hotspot-note" data-testid="text-hotspot-note"><strong style={{ display: 'block', color: '#efb349', fontSize: 10, marginBottom: 3 }}>PONTO {selected.toString().padStart(2, '0')}</strong>{hotspotText[selected]}</div><div className="viewer-tools"><div className="viewer-controls"><button className="viewer-tool" onClick={() => showToast('Rotação resetada')} aria-label="Resetar câmera" data-testid="button-reset-camera"><Rotate3d size={14} /></button><button className="viewer-tool" onClick={() => showToast('Mais zoom')} aria-label="Aumentar zoom" data-testid="button-zoom-in"><ZoomIn size={14} /></button><button className="viewer-tool" onClick={() => showToast('Menos zoom')} aria-label="Diminuir zoom" data-testid="button-zoom-out"><ZoomOut size={14} /></button><button className="viewer-tool" onClick={() => { setFullscreen(!fullscreen); showToast(fullscreen ? 'Janela restaurada' : 'Visualizador expandido'); }} aria-label="Tela cheia" data-testid="button-fullscreen">{fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button></div><span className="viewer-mode"><Move3d size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> arraste para explorar · roda para zoom</span></div></>}</div>;
}
function DetailPage() {
  const { id } = useParams<{ id: string }>(); const aircraft = aircraftCatalog.find((item) => item.id === id) || aircraftCatalog[0]; const [activeTab, setActiveTab] = useState('Visão geral'); const [favorite, setFavorite] = useState(() => JSON.parse(localStorage.getItem('aerorescue:favorites') || '[]').includes(aircraft.id)); const [toast, setToast] = useState<Toast>(null);
  useEffect(() => { const history = JSON.parse(localStorage.getItem('aerorescue:history') || '[]'); localStorage.setItem('aerorescue:history', JSON.stringify([aircraft.id, ...history.filter((item: string) => item !== aircraft.id)].slice(0, 5))); }, [aircraft.id]);
  const toggleFavorite = () => { const favorites = JSON.parse(localStorage.getItem('aerorescue:favorites') || '[]') as string[]; const next = favorites.includes(aircraft.id) ? favorites.filter((item) => item !== aircraft.id) : [...favorites, aircraft.id]; localStorage.setItem('aerorescue:favorites', JSON.stringify(next)); setFavorite(!favorite); setToast(!favorite ? 'AMX A-1 salvo nos favoritos' : 'Removido dos favoritos'); window.setTimeout(() => setToast(null), 2200); };
  const tabs = ['Visão geral', 'Material', 'Galeria', 'Vídeos'];
  const coverUrl = aircraft.coverImage ? `${import.meta.env.BASE_URL}${aircraft.coverImage}` : undefined;
  const galleryItems = aircraft.gallery && aircraft.gallery.length > 0 ? aircraft.gallery : [{ title: aircraft.name, url: coverUrl }];
  const videoItems = aircraft.videos && aircraft.videos.length > 0 ? aircraft.videos : [];
  const materialItems = aircraft.manuals && aircraft.manuals.length > 0 ? aircraft.manuals : [];
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState(0);
  const selectedVideo = videoItems[selectedVideoIndex] || videoItems[0] || null;
  const selectedMaterial = materialItems[selectedMaterialIndex] || materialItems[0] || null;
  const selectedVideoEmbedUrl = selectedVideo ? getVideoEmbedUrl(selectedVideo.url) : null;
  const selectedMaterialEmbedUrl = selectedMaterial?.url ? getDrivePreviewUrl(selectedMaterial.url) : null;
  return <main className="page-wrap"><div className="crumb"><Link href="/" data-testid="link-breadcrumb-catalogo">Catálogo</Link><ArrowRight size={12} /><span>{aircraft.name}</span></div><div className="detail-head"><div><div className="eyebrow">ficha da aeronave · código AR-001</div><h1 className="page-title">{aircraft.name}</h1><p className="page-lede">{aircraft.manufacturer} · {aircraft.role} · <span style={{ color: '#4e9974' }}>● {aircraft.status}</span></p></div><div className="detail-actions"><button className="outline-btn" onClick={() => window.print()} data-testid="button-print"><FileText size={15} /><span>Imprimir ficha</span></button><button className={`outline-btn ${favorite ? 'filter-btn active' : ''}`} onClick={toggleFavorite} data-testid="button-detail-favorite"><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /><span>{favorite ? 'Favoritado' : 'Favoritar'}</span></button></div></div><div className="detail-grid"><Viewer aircraft={aircraft} /><div><div className="info-card"><div className="info-heading"><span><Gauge size={15} className="heading-icon" style={{ verticalAlign: 'middle', marginRight: 7 }} /> ficha técnica</span><span className="section-kicker">SI / métrico</span></div><div className="metric-list"><div className="metric"><span className="metric-label">categoria</span><span className="metric-value">{aircraft.category}</span></div><div className="metric"><span className="metric-label">papel operacional</span><span className="metric-value">{aircraft.role}</span></div><div className="metric"><span className="metric-label">origem</span><span className="metric-value">{aircraft.origin}</span></div><div className="metric"><span className="metric-label">tripulação</span><span className="metric-value">{aircraft.crew}</span></div><div className="metric"><span className="metric-label">POB max.</span><span className="metric-value">{aircraft.pobMax}</span></div><div className="metric"><span className="metric-label">entrada em serviço</span><span className="metric-value">{aircraft.year}</span></div><div className="metric"><span className="metric-label">comprimento</span><span className="metric-value">{aircraft.length}</span></div><div className="metric"><span className="metric-label">envergadura</span><span className="metric-value">{aircraft.wingspan}</span></div><div className="metric"><span className="metric-label">altura</span><span className="metric-value">{aircraft.height}</span></div><div className="metric"><span className="metric-label">velocidade máx.</span><span className="metric-value">{aircraft.maxSpeed}</span></div><div className="metric"><span className="metric-label">alcance</span><span className="metric-value">{aircraft.range}</span></div><div className="metric"><span className="metric-label">peso máx. decolagem</span><span className="metric-value">{aircraft.weight}</span></div>{aircraft.designacaoFab && <div className="metric"><span className="metric-label">Designação FAB</span><span className="metric-value">{aircraft.designacaoFab}</span></div>}{aircraft.fabricanteDetalhe && <div className="metric"><span className="metric-label">Fabricante</span><span className="metric-value">{aircraft.fabricanteDetalhe}</span></div>}{aircraft.categoriaContraIncendio && <div className="metric"><span className="metric-label">Categoria Contraincêndio</span><span className="metric-value">{aircraft.categoriaContraIncendio}</span></div>}{aircraft.alturaSoloCockpit && <div className="metric"><span className="metric-label">Altura solo ao cockpit</span><span className="metric-value">{aircraft.alturaSoloCockpit}</span></div>}{aircraft.combustivel && <div className="metric"><span className="metric-label">Combustível</span><span className="metric-value">{aircraft.combustivel}</span></div>}{aircraft.quantidadeSaidas && <div className="metric"><span className="metric-label">Quantidade de saídas</span><span className="metric-value">{aircraft.quantidadeSaidas}</span></div>}{aircraft.assentoEjetavel && <div className="metric"><span className="metric-label">Assento ejetável</span><span className="metric-value">{aircraft.assentoEjetavel}</span></div>}{aircraft.sistemaDefesa && <div className="metric"><span className="metric-label">Sistema de defesa</span><span className="metric-value">{aircraft.sistemaDefesa}</span></div>}{aircraft.motor && <div className="metric"><span className="metric-label">Motor</span><span className="metric-value">{aircraft.motor}</span></div>}{aircraft.armamentoFixo && <div className="metric"><span className="metric-label">Armamento fixo</span><span className="metric-value">{aircraft.armamentoFixo}</span></div>}{aircraft.armamentosCompativeis && <div className="metric"><span className="metric-label">Armamentos compatíveis</span><span className="metric-value">{aircraft.armamentosCompativeis}</span></div>}</div></div></div></div><nav className="tab-bar" aria-label="Seções da ficha">{tabs.map((tab) => <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)} data-testid={`tab-${tab.toLowerCase().replaceAll(' ', '-')}`}>{tab}</button>)}</nav><div className="tab-content">{activeTab === 'Visão geral' && <div className="two-column"><div className="text-card"><h3>Perfil operacional</h3><p>{aircraft.name} é uma {aircraft.category.toLowerCase()} com {aircraft.role.toLowerCase()}. A configuração operacional atual está alinhada com {aircraft.origin} e com {aircraft.crew.toLowerCase()} na tripulação.</p></div></div>}{activeTab === 'Material' && <div className="text-card" id="biblioteca"><h3>Material</h3><p style={{ marginBottom: 15 }}>Links de referência do Google Drive.</p><div className="video-player-mold">{selectedMaterial ? selectedMaterialEmbedUrl ? <iframe className="video-mold-frame" src={selectedMaterialEmbedUrl} title={selectedMaterial.name} frameBorder="0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen /> : <div className="video-mold-placeholder">Este material não pode ser visualizado neste player.</div> : <div className="video-mold-placeholder">Selecione um material para visualizar.</div>}</div><div className="video-list">{materialItems.length ? materialItems.map((manual, index) => { return (<button type="button" className={`manual-row video-row ${selectedMaterialIndex === index ? 'active' : ''}`} key={`${manual.name}-${index}`} onClick={() => setSelectedMaterialIndex(index)} data-testid={`button-select-manual-${index}`}><span className="manual-icon"><FileText size={16} /></span><span><span className="manual-name">{manual.name}</span><span className="manual-meta">{manual.meta}</span></span><a className="icon-btn" href={manual.url || '#'} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Abrir <ArrowRight size={13} /></a></button>); }) : <div className="manual-row"><span className="manual-icon"><FileText size={16} /></span><span><span className="manual-name">Material em breve</span><span className="manual-meta">Links do Google Drive serão adicionados aqui.</span></span></div>}</div></div>}{activeTab === 'Galeria' && <div className="text-card"><h3>Galeria</h3><p style={{ marginBottom: 15 }}>Fotos de referência para apoio operacional.</p><div className="gallery-grid">{galleryItems.map((item, index) => <div className="gallery-tile" key={`${item.title}-${index}`} data-testid={`gallery-image-${index + 1}`}>{item.url && <img className="gallery-image" src={item.url} alt={item.title} />}</div>)}</div></div>}{activeTab === 'Vídeos' && <div className="text-card" id="videos-section"><h3>Vídeos</h3><div className="video-player-mold">{selectedVideo ? selectedVideoEmbedUrl ? <iframe className="video-mold-frame" src={selectedVideoEmbedUrl} title={selectedVideo.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div className="video-mold-placeholder">Este vídeo não pode ser reproduzido neste player.</div> : <div className="video-mold-placeholder">Selecione um vídeo para reproduzir.</div>}</div><div className="video-list">{videoItems.length ? videoItems.map((video, index) => { return (<button type="button" className={`manual-row video-row ${selectedVideoIndex === index ? 'active' : ''}`} key={`${video.title}-${index}`} onClick={() => setSelectedVideoIndex(index)} data-testid={`button-select-video-${index}`}><span className="manual-icon"><Play size={16} /></span><span><span className="manual-name">{video.title}</span><span className="manual-meta">{video.url}</span></span><a className="icon-btn" href={video.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Abrir <ArrowRight size={13} /></a></button>); }) : <div className="manual-row"><span className="manual-icon"><Play size={16} /></span><span><span className="manual-name">Vídeos em breve</span><span className="manual-meta">Links do YouTube serão adicionados aqui.</span></span></div>}</div></div>}</div>{toast && <div className="toast" role="status" data-testid="status-detail-toast"><Check size={14} style={{ verticalAlign: 'middle', marginRight: 7, color: '#efb349' }} />{toast}</div>}</main>;
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

  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Shell theme={theme} onToggleTheme={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}><Router /></Shell></WouterRouter>;
}
export default App;

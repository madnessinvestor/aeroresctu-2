export type Aircraft = {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  role: string;
  origin: string;
  status: string;
  year: string;
  length: string;
  wingspan: string;
  height: string;
  maxSpeed: string;
  range: string;
  crew: string;
  weight: string;
  sketchfabModelId?: string;
  notes: string[];
  procedures: { title: string; body: string }[];
  manuals: { name: string; meta: string }[];
};

export const aircraftCatalog: Aircraft[] = [
  {
    id: 'amx-a1',
    name: 'AMX A-1',
    manufacturer: 'Embraer / AMX International',
    category: 'Aeronave de ataque',
    role: 'Apoio aéreo tático',
    origin: 'Brasil / Itália',
    status: 'Operacional',
    year: '1989',
    length: '13,58 m',
    wingspan: '8,87 m',
    height: '4,55 m',
    maxSpeed: '1.160 km/h',
    range: '3.330 km',
    crew: '01 piloto',
    weight: '13.000 kg',
    sketchfabModelId: 'c776611d54b9490ebd088415fc44bd4a',
    notes: [
      'Confirmar configuração de armamento e carga externa antes da aproximação.',
      'A entrada na área de exaustão exige comunicação com o chefe de equipe.',
      'Preservar pontos de acesso e respeitar zonas de risco identificadas.',
    ],
    procedures: [
      { title: 'Aproximação segura', body: 'Estabeleça contato com a equipe de pista e aproxime-se pelo setor frontal, mantendo-se fora da linha de exaustão.' },
      { title: 'Desenergização', body: 'Solicite confirmação de corte de motor e bateria. Trate a aeronave como energizada até confirmação visual e operacional.' },
      { title: 'Acesso à cabine', body: 'Use o acesso lateral indicado. Em deformação estrutural, aguarde avaliação técnica antes de aplicar força.' },
      { title: 'Triagem e extração', body: 'Priorize o piloto, estabilize a área e coordene a extração com o responsável por trauma.' },
    ],
    manuals: [
      { name: 'Ficha de emergência — AMX A-1', meta: 'PDF · 2,4 MB · revisão 03/2024' },
      { name: 'Mapa de zonas de risco', meta: 'PDF · 890 KB · revisão 11/2023' },
      { name: 'Procedimento SESCINC 14.2', meta: 'PDF · 1,1 MB · revisão 08/2024' },
    ],
  },
];

export const quickFilters = ['Todos', 'Jatos', 'Transporte', 'Helicópteros', 'Favoritos'];
const PLANET_RULES = [
  {
    id: 'hoth',
    name: 'Hoth',
    backgrounds: { day: 'hoth', night: 'hothNight' },
    requirement: { key: 'passport_requirement_hoth', tempsF: [32] },
    predicate: ({ tempF, weatherMain }) => weatherMain === 'Snow' || tempF <= 32
  },
  {
    id: 'kamino',
    name: 'Kamino',
    backgrounds: { day: 'kamino', night: 'kaminoNight' },
    requirement: { key: 'passport_requirement_kamino' },
    predicate: ({ weatherMain }) => ['Rain', 'Drizzle', 'Thunderstorm'].includes(weatherMain)
  },
  {
    id: 'endor',
    name: 'Endor',
    backgrounds: { day: 'endor', night: 'endorNight' },
    requirement: { key: 'passport_requirement_endor' },
    predicate: ({ weatherMain }) => ['Fog', 'Mist'].includes(weatherMain)
  },
  {
    // Ahead of Bespin on purpose: squalls are high-wind events, so Bespin's
    // wind >= 35 rule would otherwise swallow every squall report.
    id: 'ahchTo',
    name: 'Ahch-To',
    backgrounds: { day: 'ahchTo', night: 'ahchToNight' },
    requirement: { key: 'passport_requirement_ahchTo' },
    predicate: ({ weatherMain }) => weatherMain === 'Squall'
  },
  {
    id: 'bespin',
    name: 'Bespin',
    backgrounds: { day: 'bespin', night: 'bespinNight' },
    requirement: { key: 'passport_requirement_bespin' },
    predicate: ({ windSpeedMph }) => windSpeedMph >= 35
  },
  {
    // Behind Bespin on purpose: sandstorms are wind-driven and would steal the
    // high-wind cases Bespin exists for.
    id: 'geonosis',
    name: 'Geonosis',
    backgrounds: { day: 'geonosis', night: 'geonosisNight' },
    requirement: { key: 'passport_requirement_geonosis' },
    predicate: ({ weatherMain }) => ['Sand', 'Dust'].includes(weatherMain)
  },
  {
    id: 'scarif',
    name: 'Scarif',
    backgrounds: { day: 'scarif', night: 'scarifNight' },
    requirement: { key: 'passport_requirement_scarif', tempsF: [70, 85] },
    predicate: ({ tempF, weatherMain, weatherDescription }) => {
      const normalizedDescription = weatherDescription.toLowerCase();
      return tempF >= 70 && tempF <= 85 && (weatherMain === 'Clear' || normalizedDescription.includes('few clouds'));
    }
  },
  {
    id: 'dagobah',
    name: 'Dagobah',
    backgrounds: { day: 'dagobah', night: 'dagobahNight' },
    requirement: { key: 'passport_requirement_dagobah', tempsF: [80] },
    predicate: ({ humidity, tempF }) => humidity >= 93 && tempF >= 80
  },
  {
    // Behind Dagobah on purpose: humid tropical air often reports as Haze.
    id: 'nevarro',
    name: 'Nevarro',
    backgrounds: { day: 'nevarro', night: 'nevarroNight' },
    requirement: { key: 'passport_requirement_nevarro' },
    predicate: ({ weatherMain }) => ['Ash', 'Smoke', 'Haze'].includes(weatherMain)
  },
  {
    id: 'naboo',
    name: 'Naboo',
    backgrounds: { day: 'naboo', night: 'nabooNight' },
    requirement: { key: 'passport_requirement_naboo', tempsF: [33, 54] },
    predicate: ({ tempF }) => tempF >= 33 && tempF <= 54
  },
  {
    id: 'coruscant',
    name: 'Coruscant',
    backgrounds: { day: 'coruscant', night: 'coruscantNight' },
    requirement: { key: 'passport_requirement_coruscant', tempsF: [55, 79] },
    predicate: ({ tempF }) => tempF >= 55 && tempF < 80
  },
  {
    id: 'tatooine',
    name: 'Tatooine',
    backgrounds: { day: 'tatooine', night: 'tatooineNight' },
    requirement: { key: 'passport_requirement_tatooine', tempsF: [80, 95] },
    predicate: ({ tempF }) => tempF >= 80 && tempF <= 95
  },
  {
    id: 'mustafar',
    name: 'Mustafar',
    backgrounds: { day: 'mustafar', night: 'mustafarNight' },
    requirement: { key: 'passport_requirement_mustafar', tempsF: [96] },
    predicate: ({ tempF }) => tempF >= 96
  }
];

const DEFAULT_PLANET_RULE = {
  id: 'coruscant',
  name: 'Coruscant',
  backgrounds: { day: 'coruscant', night: 'coruscantNight' }
};

function explainMatch(rule, context = {}) {
  const id = rule?.id;
  const { tempF, weatherMain = '' } = context;

  switch (id) {
    case 'hoth':
      if (weatherMain === 'Snow') {
        return 'planet_reason_hoth_snow';
      }
      return 'planet_reason_hoth_cold';
    case 'kamino':
      return 'planet_reason_kamino_rain';
    case 'endor':
      return 'planet_reason_endor_fog';
    case 'ahchTo':
      return 'planet_reason_ahchTo_squall';
    case 'bespin':
      return 'planet_reason_bespin_wind';
    case 'geonosis':
      return 'planet_reason_geonosis_sandstorm';
    case 'nevarro':
      return 'planet_reason_nevarro_ash';
    case 'scarif':
      return 'planet_reason_scarif_tropical';
    case 'dagobah':
      return 'planet_reason_dagobah_humid';
    case 'naboo':
      return 'planet_reason_naboo_chilly';
    case 'coruscant':
      if (Number.isFinite(tempF) && tempF >= 55 && tempF < 80) {
        return 'planet_reason_coruscant_mild';
      }
      return 'planet_reason_coruscant_default';
    case 'tatooine':
      return 'planet_reason_tatooine_hot';
    case 'mustafar':
      return 'planet_reason_mustafar_scorching';
    default:
      return 'planet_reason_coruscant_default';
  }
}

export { PLANET_RULES, DEFAULT_PLANET_RULE, explainMatch };

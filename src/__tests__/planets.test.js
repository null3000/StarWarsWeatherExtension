import { describe, expect, test } from 'bun:test';
import { PLANET_RULES, explainMatch } from '../planets.js';

describe('planet rules', () => {
  // PLANET_RULES is first-match-wins and the late temperature-band rules cover every
  // integer temp, so a condition rule placed after them is silently unreachable.
  test('every planet rule is reachable', () => {
    const weatherMains = [
      'Thunderstorm', 'Drizzle', 'Rain', 'Snow', 'Mist', 'Smoke', 'Haze', 'Dust',
      'Fog', 'Sand', 'Ash', 'Squall', 'Tornado', 'Clear', 'Clouds'
    ];
    const descriptions = ['', 'few clouds', 'overcast clouds'];
    const humidities = [0, 50, 95];
    const winds = [0, 40];

    const matched = new Set();

    for (const weatherMain of weatherMains) {
      for (const weatherDescription of descriptions) {
        for (let tempF = -40; tempF <= 130; tempF += 1) {
          for (const humidity of humidities) {
            for (const windSpeedMph of winds) {
              const context = { tempF, weatherMain, weatherDescription, humidity, windSpeedMph };
              const rule = PLANET_RULES.find((candidate) => candidate.predicate(context));
              expect(rule).toBeTruthy();
              matched.add(rule.id);
            }
          }
        }
      }
    }

    expect([...matched].sort()).toEqual(PLANET_RULES.map((rule) => rule.id).sort());
  });

  test('explainMatch covers each planet rule', () => {
    const contexts = {
      hoth: { weatherMain: 'Snow', tempF: 10 },
      kamino: { weatherMain: 'Rain', tempF: 60 },
      endor: { weatherMain: 'Fog', tempF: 60 },
      ahchTo: { weatherMain: 'Squall', tempF: 55, windSpeedMph: 40 },
      bespin: { windSpeedMph: 40, tempF: 60, weatherMain: 'Clear' },
      geonosis: { weatherMain: 'Sand', tempF: 95 },
      nevarro: { weatherMain: 'Haze', tempF: 70 },
      scarif: { tempF: 75, weatherMain: 'Clear', weatherDescription: 'clear sky' },
      dagobah: { humidity: 95, tempF: 85, weatherMain: 'Clouds' },
      naboo: { tempF: 40, weatherMain: 'Clear' },
      coruscant: { tempF: 65, weatherMain: 'Clear' },
      tatooine: { tempF: 90, weatherMain: 'Clear' },
      mustafar: { tempF: 100, weatherMain: 'Clear' }
    };

    PLANET_RULES.forEach((rule) => {
      const key = explainMatch(rule, contexts[rule.id]);
      expect(key.startsWith('planet_reason_')).toBe(true);
      expect(key.includes(rule.id) || key.includes('coruscant')).toBe(true);
    });
  });
});

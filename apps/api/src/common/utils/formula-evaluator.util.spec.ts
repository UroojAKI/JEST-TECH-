import { evaluateSafeFormula } from './formula-evaluator.util';

describe('evaluateSafeFormula (SEC-008)', () => {
  const vars = {
    leads_converted: 25,
    leads_total: 100,
    rev_now: 1500,
    rev_prev: 1000,
    zero_val: 0,
  };

  it('evaluates basic arithmetic expressions', () => {
    expect(evaluateSafeFormula('10 + 20', vars)).toBe(30);
    expect(evaluateSafeFormula('100 - 45', vars)).toBe(55);
    expect(evaluateSafeFormula('6 * 7', vars)).toBe(42);
    expect(evaluateSafeFormula('100 / 4', vars)).toBe(25);
    expect(evaluateSafeFormula('2 ^ 3', vars)).toBe(8);
  });

  it('respects operator precedence and parentheses', () => {
    expect(evaluateSafeFormula('10 + 20 * 3', vars)).toBe(70);
    expect(evaluateSafeFormula('(10 + 20) * 3', vars)).toBe(90);
    expect(evaluateSafeFormula('((10 + 20) * 3) / 2', vars)).toBe(45);
  });

  it('evaluates expressions with variable identifiers', () => {
    expect(evaluateSafeFormula('leads_converted / leads_total * 100', vars)).toBe(25);
    expect(evaluateSafeFormula('rev_now - rev_prev', vars)).toBe(500);
  });

  it('handles division by zero safely without throwing or returning Infinity', () => {
    expect(evaluateSafeFormula('100 / 0', vars)).toBe(0);
    expect(evaluateSafeFormula('leads_total / zero_val', vars)).toBe(0);
  });

  it('safely handles empty or missing formula strings', () => {
    expect(evaluateSafeFormula('', vars)).toBe(0);
    expect(evaluateSafeFormula('   ', vars)).toBe(0);
    expect(evaluateSafeFormula(null as any, vars)).toBe(0);
  });

  it('neutralizes prototype pollution and injection attempts', () => {
    expect(evaluateSafeFormula('constructor.prototype', vars)).toBe(0);
    expect(evaluateSafeFormula('__proto__', vars)).toBe(0);
    expect(evaluateSafeFormula('require("child_process")', vars)).toBe(0);
    expect(evaluateSafeFormula('process.exit(1)', vars)).toBe(0);
  });
});

/**
 * Safe Mathematical Expression Evaluator (SEC-008 Fix)
 * Replaces vulnerable 'expr-eval' package with an in-memory recursive descent parser.
 * Supports basic arithmetic (+, -, *, /, %, ^) on numbers and whitelisted variable identifiers.
 * Zero external dependencies, immune to prototype pollution, AST injection, or code execution.
 */

export function evaluateSafeFormula(
  formula: string,
  variables: Record<string, number> = {},
): number {
  if (!formula || typeof formula !== 'string') return 0;
  const str = formula.trim();
  if (str.length === 0) return 0;

  // Lexing
  const tokens: string[] = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(str[i + 1] || ''))) {
      let num = '';
      while (i < str.length && (/[0-9]/.test(str[i]) || str[i] === '.')) {
        num += str[i++];
      }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        id += str[i++];
      }
      tokens.push(id);
      continue;
    }
    if ('+-*/%^()'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    // Any unrecognized character immediately renders the formula invalid
    return 0;
  }

  let pos = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (
      pos < tokens.length &&
      (tokens[pos] === '*' || tokens[pos] === '/' || tokens[pos] === '%')
    ) {
      const op = tokens[pos++];
      const right = parsePower();
      if (op === '*') result = result * right;
      else if (op === '/') result = right !== 0 ? result / right : 0;
      else result = right !== 0 ? result % right : 0;
    }
    return result;
  }

  function parsePower(): number {
    let result = parseUnary();
    if (pos < tokens.length && tokens[pos] === '^') {
      pos++;
      const exponent = parsePower(); // right-associative
      result = Math.pow(result, exponent);
    }
    return result;
  }

  function parseUnary(): number {
    if (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const val = parseUnary();
      return op === '-' ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    if (pos >= tokens.length) return 0;
    const token = tokens[pos++];
    if (token === '(') {
      const val = parseExpression();
      if (pos < tokens.length && tokens[pos] === ')') {
        pos++;
      }
      return val;
    }
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) {
      return parseFloat(token);
    }
    if (Object.prototype.hasOwnProperty.call(variables, token)) {
      return Number(variables[token]) || 0;
    }
    return 0;
  }

  try {
    const res = parseExpression();
    return isNaN(res) || !isFinite(res) ? 0 : Math.round(res * 100) / 100;
  } catch {
    return 0;
  }
}

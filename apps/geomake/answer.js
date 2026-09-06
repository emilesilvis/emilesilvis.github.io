/** Evaluate arithmetic, never JavaScript. Supports numbers, pi, sqrt and + - * / ^. */
export function evaluateAnswer(input) {
  if (typeof input !== 'string' || input.length > 160) throw new Error('Try a shorter arithmetic expression.');
  const source = input.toLowerCase().trim()
    .replace(/\s*(?:cm(?:\^?2|²)?|sq\.?\s*cm|°)\s*$/, '')
    .replace(/π/g, 'pi').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/\*\*/g, '^').replace(/√/g, 'sqrt');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|sqrt|pi|[()+\-*/^]/g) || [];
  const invalid = () => new Error('Use numbers, π, +, −, ×, ÷, parentheses, or sqrt(2).');
  const isNumber = token => !!token && /^(?:\d|\.)/.test(token);
  if (!tokens.length || tokens.join('') !== source.replace(/\s/g, '') || tokens.length > 100) throw invalid();
  if (tokens.some((token, i) => isNumber(token) && isNumber(tokens[i + 1]))) throw invalid();
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position];
  const bounded = value => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error('That expression does not give a finite, manageable number.');
    return value;
  };
  function primary() {
    if (++depth > 32) throw invalid();
    const token = tokens[position++];
    let result;
    if (isNumber(token)) result = Number(token);
    else if (token === 'pi') result = Math.PI;
    else if (token === 'sqrt') result = Math.sqrt(primary());
    else if (token === '(') { result = expression(); if (tokens[position++] !== ')') throw invalid(); }
    else throw invalid();
    depth--;
    return bounded(result);
  }
  function power() {
    const left = primary();
    if (peek() !== '^') return left;
    position++;
    const right = unary();
    if (Math.abs(right) > 64) throw new Error('Please use an exponent between −64 and 64.');
    return bounded(left ** right);
  }
  function unary() {
    if (peek() === '+') { position++; return unary(); }
    if (peek() === '-') { position++; return -unary(); }
    return power();
  }
  function product() {
    let value = unary();
    while (peek() === '*' || peek() === '/' || peek() === '(' || peek() === 'pi' || peek() === 'sqrt' || isNumber(peek())) {
      const op = peek();
      if (op === '*' || op === '/') position++;
      const right = unary();
      value = bounded(op === '/' ? value / right : value * right);
    }
    return value;
  }
  function expression() {
    let value = product();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[position++];
      const right = product();
      value = bounded(op === '+' ? value + right : value - right);
    }
    return value;
  }
  const result = expression();
  if (position !== tokens.length) throw invalid();
  return bounded(result);
}

export function matchesAnswer(input, expected) {
  return Math.abs(evaluateAnswer(input) - expected) <= 0.005 + Math.abs(expected) * 1e-10;
}

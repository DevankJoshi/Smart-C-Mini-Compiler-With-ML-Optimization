/* ═══════════════════════════════════════════════════════
   PHASE 1 — LEXER
   Converts raw source text into a flat array of tokens.
   Each token: { type, val, pos }
   Token types: KEYWORD, IDENT, NUMBER, CHAR, OPERATOR,
                PUNCT, STRING, UNKNOWN

   NEW in this version:
   ● Char literals  'a'  → CHAR token (val = ASCII number)
   ● Preprocessor lines  #include / #define  → skipped
   ● Compound operators  += -=  already handled
   ● Postfix/prefix  ++ --  already handled
═══════════════════════════════════════════════════════ */
const KEYWORDS = [
  'int','float','char','void','return',
  'if','else','while','for','do','break','continue',
  'switch','case','default',
  'struct','typedef','sizeof'
];

function lex(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    // Whitespace
    if (/\s/.test(src[i])) { i++; continue; }

    // Preprocessor directive — skip entire line  (#include, #define …)
    if (src[i] === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // Single-line comment  //
    if (src[i] === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // Block comment  /* … */
    if (src[i] === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++;
      i += 2;
      continue;
    }

    // String literal  "…"
    if (src[i] === '"') {
      let j = i+1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\') j++; // skip escape
        j++;
      }
      j++;
      tokens.push({type:'STRING', val:src.slice(i,j), pos:i}); i=j; continue;
    }

    // Char literal  'a'  '\n'  '\0'
    if (src[i] === "'") {
      let j = i+1;
      let ch = src[j];
      if (ch === '\\') { j++; ch = src[j]; } // escape sequence
      j++; // char itself
      if (src[j] === "'") j++; // closing quote
      // Store ASCII value so it works like an integer in expressions
      const ascii = ch === 'n' ? 10 : ch === 't' ? 9 : ch === '0' ? 0 : ch.charCodeAt(0);
      tokens.push({type:'CHAR', val:String(ascii), pos:i}); i=j; continue;
    }

    // Number literal  (integers and floats)
    if (/[0-9]/.test(src[i])) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({type:'NUMBER', val:src.slice(i,j), pos:i}); i=j; continue;
    }

    // Identifier / keyword
    if (/[a-zA-Z_]/.test(src[i])) {
      let j = i;
      while (j < src.length && /\w/.test(src[j])) j++;
      const v = src.slice(i,j);
      tokens.push({type: KEYWORDS.includes(v) ? 'KEYWORD' : 'IDENT', val:v, pos:i});
      i=j; continue;
    }

    // Two-char operators (must check before single-char)
    const two = src.slice(i, i+2);
    if (['==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/='].includes(two)) {
      tokens.push({type:'OPERATOR', val:two, pos:i}); i+=2; continue;
    }

    // Single-char operators
    if ('+-*/%<>=!&|~'.includes(src[i])) {
      tokens.push({type:'OPERATOR', val:src[i], pos:i}); i++; continue;
    }

    // Punctuation
    if (';,(){}[]'.includes(src[i])) {
      tokens.push({type:'PUNCT', val:src[i], pos:i}); i++; continue;
    }

    tokens.push({type:'UNKNOWN', val:src[i], pos:i}); i++;
  }
  return tokens;
}

function renderTokens(tokens) {
  const pills = tokens.map(t => {
    // CHAR shown with same style as NUMBER (they act as integers)
    const cls = t.type === 'CHAR' ? 'NUMBER' : t.type;
    return `<div class="tok tok-${cls}">
       <span class="tok-val">${esc(t.val)}</span>
       <span class="tok-type">${t.type}</span>
     </div>`;
  }).join('');
  return `<div class="token-grid">${pills}</div>
    <p class="hint">${tokens.length} tokens produced</p>`;
}

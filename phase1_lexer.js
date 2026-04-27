
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
    
    if (/\s/.test(src[i])) { i++; continue; }

    if (src[i] === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    if (src[i] === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    if (src[i] === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++;
      i += 2;
      continue;
    }

    if (src[i] === '"') {
      let j = i+1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\') j++; 
        j++;
      }
      j++;
      tokens.push({type:'STRING', val:src.slice(i,j), pos:i}); i=j; continue;
    }

    if (src[i] === "'") {
      let j = i+1;
      let ch = src[j];
      if (ch === '\\') { j++; ch = src[j]; } 
      j++; 
      if (src[j] === "'") j++; 
      
      const ascii = ch === 'n' ? 10 : ch === 't' ? 9 : ch === '0' ? 0 : ch.charCodeAt(0);
      tokens.push({type:'CHAR', val:String(ascii), pos:i}); i=j; continue;
    }

    if (/[0-9]/.test(src[i])) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({type:'NUMBER', val:src.slice(i,j), pos:i}); i=j; continue;
    }

    if (/[a-zA-Z_]/.test(src[i])) {
      let j = i;
      while (j < src.length && /\w/.test(src[j])) j++;
      const v = src.slice(i,j);
      tokens.push({type: KEYWORDS.includes(v) ? 'KEYWORD' : 'IDENT', val:v, pos:i});
      i=j; continue;
    }

    const three = src.slice(i, i+3);
    if (['<<=', '>>=', '&=|', '|=^', '^='].includes(three)) {
      tokens.push({type:'OPERATOR', val:three, pos:i}); i+=3; continue;
    }

    const two = src.slice(i, i+2);
    if (['==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','<<','>>','&=','|=','^='].includes(two)) {
      tokens.push({type:'OPERATOR', val:two, pos:i}); i+=2; continue;
    }

    if ('+-*/%<>=!&|~'.includes(src[i])) {
      tokens.push({type:'OPERATOR', val:src[i], pos:i}); i++; continue;
    }

    if (';,(){}[]'.includes(src[i])) {
      tokens.push({type:'PUNCT', val:src[i], pos:i}); i++; continue;
    }

    tokens.push({type:'UNKNOWN', val:src[i], pos:i}); i++;
  }
  return tokens;
}

function renderTokens(tokens) {
  const pills = tokens.map(t => {
    
    const cls = t.type === 'CHAR' ? 'NUMBER' : t.type;
    return `<div class="tok tok-${cls}">
       <span class="tok-val">${esc(t.val)}</span>
       <span class="tok-type">${t.type}</span>
     </div>`;
  }).join('');
  return `<div class="token-grid">${pills}</div>
    <p class="hint">${tokens.length} tokens produced</p>`;
}

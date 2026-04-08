/* ═══════════════════════════
   SAMPLE PROGRAMS
═══════════════════════════ */
const SAMPLES = {
  basic:    `int main() {\n    int x = 5 + 3;\n    int y = x * 2;\n    return y;\n}`,
  if:       `int main() {\n    int a = 10;\n    if (a > 5) {\n        a = a - 1;\n    } else {\n        a = a + 1;\n    }\n    return a;\n}`,
  loop:     `int main() {\n    int i = 0;\n    while (i < 3) {\n        i = i + 1;\n    }\n    return i;\n}`,
  forloop:  `int main() {\n    int sum = 0;\n    int i;\n    for (i = 1; i <= 5; i++) {\n        sum += i;\n    }\n    return sum;\n}`,
  dowhile:  `int main() {\n    int x = 1;\n    int sum = 0;\n    do {\n        sum += x;\n        x++;\n    } while (x <= 5);\n    return sum;\n}`,
  switchc:  `int main() {\n    int day = 3;\n    int result = 0;\n    switch (day) {\n        case 1:\n            result = 10;\n            break;\n        case 2:\n            result = 20;\n            break;\n        case 3:\n            result = 30;\n            break;\n        default:\n            result = 99;\n            break;\n    }\n    return result;\n}`,
  array:    `int main() {\n    int arr[5];\n    arr[0] = 10;\n    arr[1] = 20;\n    arr[2] = arr[0] + arr[1];\n    return arr[2];\n}`,
  breakc:   `int main() {\n    int i = 0;\n    while (i < 10) {\n        if (i == 5) {\n            break;\n        }\n        i++;\n    }\n    return i;\n}`,
  func:     `int add(int a, int b) {\n    return a + b;\n}\nint main() {\n    int r = add(4, 6);\n    return r;\n}`,
  nested:   `int main() {\n    int a = 2;\n    int b = 3;\n    int c = (a + b) * (a - 1);\n    return c;\n}`,
};
function loadSample(k) { document.getElementById('src-editor').value = SAMPLES[k]; compile(); }

/* ═══════════════════════════
   UTILITIES
═══════════════════════════ */
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toggle(id) { document.getElementById(id).classList.toggle('open'); }
function resetAll() {
  for (let i=1;i<=7;i++) {
    document.getElementById('ph-'+i).classList.remove('active','errored','open');
    document.getElementById('pip-'+i).classList.remove('lit','err');
  }
}
function activatePhase(n, hasErr) {
  const el=document.getElementById('ph-'+n), pip=document.getElementById('pip-'+n);
  if (el) el.classList.add('open');
  if (hasErr) { 
    if (el) el.classList.add('errored'); 
    if (pip) pip.classList.add('err'); 
  } else { 
    if (el) el.classList.add('active');  
    if (pip) pip.classList.add('lit'); 
  }
}
function clearAll() {
  document.getElementById('src-editor').value='';
  for (let i=1;i<=7;i++) {
    const out = document.getElementById('out-'+i);
    if (out) out.innerHTML='';
    const ph = document.getElementById('ph-'+i);
    if (ph) ph.classList.remove('active','errored','open');
    const pip = document.getElementById('pip-'+i);
    if (pip) pip.classList.remove('lit','err');
  }
}

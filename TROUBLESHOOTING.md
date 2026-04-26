# Troubleshooting: "Can't find variable: execute" Error

## Problem
When compiling code, you get the error: **"Can't find variable: execute"**

This happens when the `execute()` function from `phase6_execute.js` is not available when the compiler tries to use it.

## Root Causes

1. **Browser Cache** - Old cached version of files
2. **Script Loading Order** - One of the earlier phase files failed to load
3. **Syntax Error in a Prior File** - A file before phase6_execute.js has a syntax error that breaks the loading chain
4. **Network Issue** - One of the script files failed to download

## Solutions

### Solution 1: Clear Browser Cache (FASTEST)
**In Chrome/Edge:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty cache and hard refresh"
4. Try compiling again

**In Safari:**
1. Develop menu → Empty Caches (Cmd+Option+E)
2. Hard refresh (Cmd+Shift+R)

**In Firefox:**
1. Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
2. Clear cache, then refresh

### Solution 2: Check Browser Console
1. Open DevTools (F12 or Right-click → Inspect)
2. Go to Console tab
3. Look for any red error messages
4. Run this command to see what loaded:
   ```javascript
   Object.keys(window).filter(k => 
     ['lex','parse','execute','optimizeTAC'].includes(k)
   )
   ```
5. The output should show: `['lex', 'parse', 'execute', 'optimizeTAC']`
6. If any are missing, screenshot the console and check below

### Solution 3: Check Script Loading
In the browser console, run:
```javascript
runDiagnostic()
```

This will show you which functions are missing, if any.

### Solution 4: Force Refresh All Files
Each script has a version parameter. Try clearing and refreshing:
1. Ctrl+Shift+Delete (clear cache)
2. Ctrl+F5 (hard refresh)
3. Try compiling again

### Solution 5: Check Network in DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Look for any red X or 404 errors on these files:
   - phase0_utils.js
   - phase1_lexer.js
   - phase2_parser.js
   - phase3_semantic.js
   - phase4_ir.js
   - phase5_codegen.js
   - phase6_execute.js ← **This one must load successfully**
   - phase7_optimizer.js
   - All ml_optimizer/js/*.js files

If any show red X or 404, the server might not be serving them correctly.

## Verification Checklist

After clearing cache, verify:

✓ Page loads without errors in console
✓ All 16 scripts show as loaded in Network tab  
✓ `runDiagnostic()` shows no missing functions
✓ Try sample code from dropdown (bottom doesn't have custom code)
✓ Try the user's code again

## If Still Not Fixed

### Step 1: Check Server
Make sure you're serving files from the correct directory:
```bash
# From /Users/devank/Downloads/cd/cd/
python3 -m http.server 8000
# Then visit http://localhost:8000/index.html
```

### Step 2: Check File Structure
Verify these files exist:
```bash
ls -la /Users/devank/Downloads/cd/cd/phase*.js
ls -la /Users/devank/Downloads/cd/cd/ml_optimizer/js/*.js
```

### Step 3: Test Each File
Open browser console and try each phase individually:
```javascript
// This will show if a file has a syntax error
console.log(typeof lex, typeof parse, typeof execute)
// Should output: function function function
```

### Step 4: Check HTML Script Tags
Open `index.html` and verify:
1. All 16 `<script>` tags are present
2. All 16 `</script>` closing tags match
3. No syntax errors in inline scripts

Count them:
```bash
grep -c "<script" index.html  # should be 16
grep -c "</script>" index.html # should be 16
```

## Technical Details

### What's Happening
1. Browser loads `index.html`
2. HTML contains `<script>` tags that load each phase file in order
3. Each phase file defines functions globally (e.g., `function lex(src) { ... }`)
4. When you click "Compile & Run", JavaScript calls `lex()`, `parse()`, `execute()`, etc.
5. If any phase file fails to load, its functions aren't defined
6. Calling `execute()` when it's undefined → "Can't find variable: execute"

### Why This Happens
- Most common: Browser cached old versions of files
- Second most: One of the earlier phase files has a typo or syntax error
- Rare: Network issue prevented a script from downloading

### Why the Fix Works
- **Clear cache**: Forces browser to re-download all files, including newer versions
- **Hard refresh**: Bypasses cache without clearing it permanently
- **Check console**: Shows exactly which functions are missing

---

## Quick Reference Commands

```bash
# Check all phase files exist
ls -la phase*.js ml_optimizer/js/*.js

# Check syntax of all JS files  
for f in phase*.js; do node -c "$f" && echo "✓ $f" || echo "✗ $f"; done

# Count braces in phase6_execute.js (must match)
grep -o "{" phase6_execute.js | wc -l  # open braces
grep -o "}" phase6_execute.js | wc -l  # close braces

# Test with Python server
python3 -m http.server 8000  # visit http://localhost:8000/index.html
```

---

## Browser Console Test

After clearing cache, paste this in browser console:
```javascript
// Test if all main functions exist
const test = {
  lex: typeof lex === 'function',
  parse: typeof parse === 'function',
  semanticAnalysis: typeof semanticAnalysis === 'function',
  generateIR: typeof generateIR === 'function',
  generateAsm: typeof generateAsm === 'function',
  execute: typeof execute === 'function',
  optimizeTAC: typeof optimizeTAC === 'function'
};

console.log(test);
console.log('All loaded:', Object.values(test).every(x => x));
```

Expected output:
```
{
  lex: true,
  parse: true,
  semanticAnalysis: true,
  generateIR: true,
  generateAsm: true,
  execute: true,
  optimizeTAC: true
}
All loaded: true
```

If any show `false`, that function's phase file didn't load properly.

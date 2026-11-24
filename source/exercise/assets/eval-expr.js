/* 表达式判分引擎（经典脚本 + CommonJS 双用）
 * 支持：数字、分数、e、pi、开方、阶乘、幂，以及常见 LaTeX 片段
 * 例：3/4  e^-4  -9/(8e^2)  100!  \frac{1}{12}  \sqrt{2}  2pi
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuizEval = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function fact(n) {
    if (!isFinite(n) || n < 0 || Math.floor(n) !== n) return NaN;
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // 读取一个 LaTeX 参数：{...}（支持嵌套）或单个字符
  function readGroup(s, i) {
    if (s[i] === '{') {
      let d = 0;
      for (let j = i; j < s.length; j++) {
        if (s[j] === '{') d++;
        else if (s[j] === '}') {
          d--;
          if (d === 0) return { val: s.slice(i + 1, j), next: j + 1 };
        }
      }
      return { val: s.slice(i + 1), next: s.length };
    }
    return { val: s[i] || '', next: i + 1 };
  }

  function expandCmd(s, names, render) {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const m = s.slice(i).match(/^\\(?:[dtc])?(frac|sqrt)/);
      if (!m || !names.includes(m[1])) {
        out += s[i++];
        continue;
      }
      let j = i + m[0].length;
      const a = readGroup(s, j);
      let k = a.next;
      if (m[1] === 'sqrt') {
        out += 'sqrt(' + expandCmd(a.val, names, render) + ')';
        i = a.next;
        continue;
      }
      const b = readGroup(s, k);
      out +=
        '((' +
        expandCmd(a.val, names, render) +
        ')/(' +
        expandCmd(b.val, names, render) +
        '))';
      i = b.next;
    }
    return out;
  }

  // 把常见 LaTeX / 中文输入整理成可求值表达式
  function normalize(input) {
    let s = String(input == null ? '' : input).trim();
    s = s.replace(/[（]/g, '(').replace(/[）]/g, ')');
    s = s.replace(/[×✕·]/g, '*').replace(/[−–—]/g, '-').replace(/[＝]/g, '=');
    s = s.replace(/，/g, ',');
    s = s.replace(/\s+/g, '');
    // 去掉 "a=" 之类的前缀
    const eq = s.lastIndexOf('=');
    if (eq >= 0 && eq < s.length - 1) s = s.slice(eq + 1);
    s = s.replace(/[$]/g, '');
    s = s.replace(/\\left|\\right|\\,|\\;|\\!/g, '');
    // \frac / \dfrac / \sqrt（含无花括号写法 \frac32，可嵌套）
    s = expandCmd(s, ['frac', 'sqrt']);
    // 手写 sqrt{...}
    s = s.replace(/sqrt\{([^{}]*)\}/g, 'sqrt($1)');
    s = s.replace(/\\(?:[dtc])?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
    s = s.replace(/\\pi/g, 'pi');
    s = s.replace(/\\cdot|\\times/g, '*');
    s = s.replace(/\\[a-zA-Z]+/g, '');
    s = s.replace(/[{}]/g, '');
    // 中文一律丢弃
    s = s.replace(/[\u4e00-\u9fa5]/g, '');
    return s;
  }

  function toJS(s) {
    // 阶乘：紧跟在数字 / 右括号后的 !
    s = s.replace(/(\d+(?:\.\d+)?|\))\s*!/g, 'fact($1)');
    // 幂
    s = s.replace(/\^/g, '**');
    s = s.replace(/\*\*\s*([+-])/g, '**($1');
    // 一元指数补右括号：**(-4  ->  **(-4)
    let open = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') open++;
      else if (s[i] === ')') open--;
    }
    if (open > 0) s += ')'.repeat(open);
    // 隐式乘法：数字/右括号/常量 之间补乘号
    s = s.replace(/(\d)(?=e(?![0-9])|pi|sqrt|ln|log|abs|\()/g, '$1*');
    s = s.replace(/\)(?=e(?![0-9A-Za-z_])|pi|sqrt|ln|log|abs|\()/g, ')*');
    s = s.replace(/(?<=pi|e)(?=\()/g, '*');
    // 常量与函数
    s = s.replace(/(?<![0-9A-Za-z_.])pi(?![0-9A-Za-z_])/g, 'Math.PI');
    s = s.replace(/(?<![0-9A-Za-z_.])e(?![0-9A-Za-z_])/g, 'Math.E');
    s = s.replace(/(?<![0-9A-Za-z_.])sqrt\s*\(/g, 'Math.sqrt(');
    s = s.replace(/(?<![0-9A-Za-z_.])ln\s*\(/g, 'Math.log(');
    s = s.replace(/(?<![0-9A-Za-z_.])log\s*\(/g, 'Math.log10(');
    s = s.replace(/(?<![0-9A-Za-z_.])abs\s*\(/g, 'Math.abs(');
    return s;
  }

  const ALLOWED = /^[0-9+\-*/().]*$/;

  function evaluate(input) {
    const norm = normalize(input);
    if (!norm) return NaN;
    const js = toJS(norm);
    // 白名单：替换已知标识符后，剩余只能是四则运算字符
    const probe = js
      .replace(/Math\.PI/g, '1')
      .replace(/Math\.E/g, '1')
      .replace(/Math\.sqrt/g, '1')
      .replace(/Math\.log10/g, '1')
      .replace(/Math\.log/g, '1')
      .replace(/Math\.abs/g, '1')
      .replace(/fact/g, '1');
    if (!ALLOWED.test(probe)) return NaN;
    try {
      const fn = new Function('fact', '"use strict"; return (' + js + ');');
      const v = fn(fact);
      return typeof v === 'number' && isFinite(v) ? v : NaN;
    } catch (e) {
      return NaN;
    }
  }

  function isCorrect(input, expect) {
    const a = evaluate(input);
    const b = evaluate(expect);
    if (!isFinite(a) || !isFinite(b)) return false;
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  }

  return { evaluate, isCorrect, normalize };
});

(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lite = document.getElementById('lite');
  function setLite(on) { document.body.classList.toggle('lite', on); lite.setAttribute('aria-pressed', on ? 'true' : 'false'); document.querySelectorAll('video').forEach(function (v) { if (on) v.pause(); else v.play().catch(function () {}); }); }
  var slow = navigator.connection && (navigator.connection.saveData || /(^|-)(2g|3g)$/.test(navigator.connection.effectiveType || ''));
  if (reduce || slow || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)) setLite(true);
  lite.addEventListener('click', function () { setLite(!document.body.classList.contains('lite')); });

  // kite select
  var kites = [8, 11, 4, 1, 9, 12, 6], picks = document.getElementById('picks'), big = document.getElementById('kbig'), kid = document.getElementById('kid');
  kites.forEach(function (n, i) {
    var b = document.createElement('button'); b.className = 'pick'; b.type = 'button'; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); b.setAttribute('aria-label', 'Preview kite ' + (i + 1));
    var im = document.createElement('img'); im.src = '/img/cutout_' + n + '.webp'; im.alt = ''; im.width = 64; im.height = 64; im.loading = 'lazy'; b.appendChild(im);
    b.addEventListener('click', function () {
      picks.querySelectorAll('.pick').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true'); big.src = im.src; kid.textContent = 'KITE ' + String(i + 1).padStart(2, '0');
    });
    picks.appendChild(b);
  });

  // leaderboard top 5 (names go in through textContent only)
  var t5 = document.getElementById('top5rows');
  if (t5) {
    var fmt = new Intl.NumberFormat();
    var msg = function (text) { t5.textContent = ''; var tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 4; td.className = 'state'; td.textContent = text; tr.appendChild(td); t5.appendChild(tr); };
    fetch('/api/top?limit=5').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (list) {
      if (!Array.isArray(list) || !list.length) return msg('No scores yet. Be the first!');
      t5.textContent = '';
      list.forEach(function (p) {
        var tr = document.createElement('tr'); if (p.rank <= 3) tr.className = 'top' + p.rank;
        [String(p.rank), p.name, fmt.format(p.score), String(p.wave)].forEach(function (v, i) {
          var td = document.createElement('td'); td.textContent = v; td.className = ['rank', 'name', 'num', 'num'][i];
          if (i === 1) { var tag = document.createElement('span'); tag.className = 'ptag'; tag.textContent = '#' + p.tag; td.appendChild(tag); }
          tr.appendChild(td);
        });
        t5.appendChild(tr);
      });
    }).catch(function () { msg('The leaderboard opens with the next game update.'); });
  }

  // section pager
  var pg = document.getElementById('pg');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) pg.textContent = e.target.getAttribute('data-ch'); }); }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('[data-ch]').forEach(function (s) { io.observe(s); });
  }

  // boot screen: short, skippable, skipped for reduced motion
  if (!reduce && !sessionStorageFlag()) {
    var boot = document.createElement('div'); boot.id = 'boot'; boot.setAttribute('role', 'presentation');
    boot.innerHTML = '<div><div>KTM-01 BOOTING&hellip;</div><div class="bar"><i></i></div><div id="bp">0%</div><div class="skip">tap to skip</div></div>';
    document.body.appendChild(boot);
    var bar = boot.querySelector('i'), bp = boot.querySelector('#bp'), p = 0, t = setInterval(function () { p += 8 + Math.random() * 12; if (p >= 100) { p = 100; done(); } bar.style.width = p + '%'; bp.textContent = Math.floor(p) + '%'; }, 90);
    function done() { clearInterval(t); boot.classList.add('off'); setTimeout(function () { boot.remove(); }, 400); try { sessionStorage.setItem('cc_boot', '1'); } catch (e) {} }
    boot.addEventListener('click', done); document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { done(); document.removeEventListener('keydown', k); } });
  }
  function sessionStorageFlag() { try { return sessionStorage.getItem('cc_boot') === '1'; } catch (e) { return false; } }
})();

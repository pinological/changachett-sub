(function () {
  var state = document.getElementById('state'), wrap = document.getElementById('wrap'), rows = document.getElementById('rows');
  var fmt = new Intl.NumberFormat();
  var dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  // Every value goes in through textContent, so player names can never inject HTML.
  function cell(tr, text, cls) { var td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; }

  function render(list) {
    rows.textContent = '';
    if (!list.length) { state.textContent = 'No scores yet. Be the first: play a round and tap Submit in the game.'; wrap.hidden = true; return; }
    list.forEach(function (p) {
      var tr = document.createElement('tr');
      if (p.rank <= 3) tr.className = 'top' + p.rank;
      cell(tr, String(p.rank), 'rank');
      var name = cell(tr, p.name, 'name');
      var tag = document.createElement('span'); tag.className = 'ptag'; tag.textContent = '#' + p.tag; name.appendChild(tag);
      cell(tr, fmt.format(p.score), 'num');
      cell(tr, String(p.wave), 'num');
      cell(tr, p.ts ? dateFmt.format(new Date(p.ts * 1000)) : '', 'hide-sm');
      rows.appendChild(tr);
    });
    state.textContent = '';
    wrap.hidden = false;
  }

  function load() {
    fetch('/api/top?limit=100', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { render(Array.isArray(d) ? d : []); })
      .catch(function () { if (!rows.children.length) state.textContent = 'The leaderboard could not be loaded right now. Please try again in a minute.'; });
  }
  load();
  setInterval(function () { if (!document.hidden) load(); }, 30000);
})();

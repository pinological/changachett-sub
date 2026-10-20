(function () {
  var form = document.getElementById('del'), msg = document.getElementById('msg'), btn = form.querySelector('button');
  function say(text, bad) { msg.textContent = text; msg.className = 'state' + (bad ? ' bad' : ' good'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('pid').value.trim().toLowerCase().replace(/[^0-9a-f]/g, '');
    var name = document.getElementById('pname').value.trim();
    if (!/^[0-9a-f]{32}$/.test(id)) return say('That player id does not look right. It is 32 letters and numbers (0-9, a-f), shown in the game under Profile.', true);
    if (name.length < 2) return say('Please type your gamer name too.', true);
    if (!document.getElementById('sure').checked) return say('Please tick the box to confirm.', true);

    btn.disabled = true; say('Deleting…');
    fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player_id: id }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (x) {
        if (x.d.ok) { form.reset(); say('Done. Any record for ' + name + '#' + id.slice(0, 4).toUpperCase() + ' has been deleted. The public board catches up within a minute.'); }
        else if (x.status === 429) say('Too many requests from this network. Please try again in an hour, or email us.', true);
        else say('That did not work. Please email ' + window.CC.contact + ' and we will delete it by hand.', true);
      })
      .catch(function () { say('No connection. Please try again, or email ' + window.CC.contact + '.', true); })
      .then(function () { btn.disabled = false; });
  });
})();

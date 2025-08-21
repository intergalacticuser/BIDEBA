// Navbar active link highlighting
(function () {
  try {
    var path = (location.pathname || '').split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.nav-links a');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href && href.indexOf(path) !== -1) {
        links[i].classList.add('active');
      }
    }
  } catch (e) {}
})();

// Index page: Live counter of newly deployed contracts via Toncenter (approximate)
(function () {
  try {
    var isIndex = (location.pathname || '').split('/').pop() === '' || (location.pathname || '').split('/').pop() === 'index.html';
    if (!isIndex) return;

    var ticker = document.getElementById('ticker-container');
    if (!ticker) return;

    // Create floating card above canvas
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'deploy-stats-card';
    card.style.position = 'absolute';
    card.style.top = 'calc(var(--nav-h) + 90px)';
    card.style.left = '50%';
    card.style.transform = 'translateX(-50%)';
    card.style.zIndex = '20';
    card.style.padding = '14px 18px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.boxShadow = '0 0 24px rgba(0, 200, 255, 0.18)';
    card.innerHTML = '<i class="fas fa-microchip" style="color:#00c6ff"></i><span style="opacity:.9;">New contracts (last 5 blocks)</span><strong id="deploy-count">—</strong><button id="set-toncenter-key" class="btn" style="padding:6px 10px; font-size:12px;">API Key</button>';
    document.body.appendChild(card);

    var apiBase = 'https://toncenter.com/api/v2';
    var apiKey = window.TONCENTER_API_KEY || localStorage.getItem('TONCENTER_API_KEY') || '';

    var keyBtn = document.getElementById('set-toncenter-key');
    if (keyBtn) {
      keyBtn.addEventListener('click', function(){
        var v = prompt('Enter Toncenter API key (kept in this browser only):', apiKey || '');
        if (v != null) {
          apiKey = v.trim();
          try { localStorage.setItem('TONCENTER_API_KEY', apiKey); } catch(e) {}
          updateDeployCount();
        }
      });
    }

    function qs(params) {
      var s = Object.keys(params).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
      if (apiKey) s += (s ? '&' : '') + 'api_key=' + encodeURIComponent(apiKey);
      return s;
    }

    function fetchJson(url) {
      // Toncenter enforces CORS; in case of CORS error, try a public CORS proxy fallback
      return fetch(url).then(function(r){ return r.json(); }).catch(function(){
        return fetch('https://r.jina.ai/http/' + url.replace(/^https?:\/\//,''))
          .then(function(r){ return r.json(); });
      });
    }

    function containsStateInit(obj) {
      try {
        var txt = JSON.stringify(obj);
        // Heuristic markers for deploy
        if (/state_init/i.test(txt)) return true;
        if (/deploy/i.test(txt)) return true;
        return false;
      } catch(e) { return false; }
    }

    function countDeploysInTxList(txs) {
      var c = 0;
      for (var i=0;i<txs.length;i++) {
        var t = txs[i];
        if (!t) continue;
        if (containsStateInit(t)) c++;
      }
      return c;
    }

    async function updateDeployCount() {
      try {
        var info = await fetchJson(apiBase + '/getMasterchainInfo' + (apiKey?('?api_key='+encodeURIComponent(apiKey)):'') );
        if (!info || !info.ok || !info.result || !info.result.last) throw new Error('bad masterchain info');
        var last = info.result.last;
        var blocksToScan = 5;
        var total = 0;
        var lastList = [];
        for (var i=0;i<blocksToScan;i++) {
          var seq = last.seqno - i;
          var url = apiBase + '/getBlockTransactions?' + qs({ workchain: last.workchain, shard: last.shard, seqno: seq, count: 1024 });
          try {
            var txs = await fetchJson(url);
            if (txs && txs.ok && txs.result && Array.isArray(txs.result.transactions)) {
              total += countDeploysInTxList(txs.result.transactions);
              var items = txs.result.transactions.slice(0,5).map(function(t){
                return { utime: t.utime || t.now || 0, hash: (t.transaction_id && t.transaction_id.hash) || '' };
              });
              lastList = lastList.concat(items);
            }
          } catch(e) { /* ignore individual block errors */ }
        }
        var el = document.getElementById('deploy-count');
        if (el) el.textContent = String(total);
        // Optionally render a tooltip-like list
        if (!document.getElementById('deploy-list') && lastList.length) {
          lastList.sort(function(a,b){ return b.utime - a.utime; });
          var list = document.createElement('div');
          list.id = 'deploy-list';
          list.style.fontSize = '12px';
          list.style.opacity = '0.85';
          list.style.marginTop = '6px';
          list.innerHTML = lastList.slice(0,5).map(function(it){
            var d = it.utime ? new Date(it.utime*1000).toLocaleTimeString() : '';
            var short = it.hash ? it.hash.slice(0,8) : '';
            return '<div>• ' + d + ' ' + short + '</div>';
          }).join('');
          card.appendChild(list);
        }
      } catch (e) {
        var el2 = document.getElementById('deploy-count');
        if (el2) el2.textContent = 'Set API key';
      }
    }

    updateDeployCount();
    setInterval(updateDeployCount, 60000);
  } catch (e) {}
})();

// Mark lazy iframes as loaded when content finishes loading
(function () {
  try {
    var iframes = document.querySelectorAll('iframe[loading="lazy"]');
    for (var i = 0; i < iframes.length; i++) {
      iframes[i].addEventListener('load', function () {
        this.classList.add('loaded');
      });
    }
  } catch (e) {}
})();

// Enhance info.html: add TON price card and copy button without editing HTML
(function () {
  try {
    var isInfo = (location.pathname || '').split('/').pop() === 'info.html';
    if (!isInfo) return;

    var infoContent = document.querySelector('.info-content');
    if (!infoContent) return;

    // Add copy button after contract address
    var contract = infoContent.querySelector('.contract-address');
    if (contract) {
      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn';
      copyBtn.id = 'copy-contract';
      copyBtn.textContent = 'Copy address';
      copyBtn.style.marginTop = '10px';
      contract.insertAdjacentElement('afterend', copyBtn);

      // Insert TON price card after copy button
      var card = document.createElement('div');
      card.className = 'card';
      card.id = 'ton-price-card';
      card.style.marginTop = '12px';
      card.style.marginBottom = '16px';
      card.style.padding = '16px';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.innerHTML = '<span style="opacity:.9;">TON Price (USD)</span><strong id="ton-usd-price">$—</strong>';
      copyBtn.insertAdjacentElement('afterend', card);

      copyBtn.addEventListener('click', function () {
        try {
          var text = contract.textContent.replace('Contract Address:', '').trim();
          navigator.clipboard.writeText(text).then(function(){
            var prev = copyBtn.textContent; copyBtn.textContent = 'Copied!';
            setTimeout(function(){ copyBtn.textContent = prev; }, 1500);
          });
        } catch (e) {}
      });
    }

    // Fetch TON price
    function fetchTONPrice() {
      try {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd')
          .then(function(r){ return r.json(); })
          .then(function(data){
            var v = data && data['the-open-network'] && data['the-open-network'].usd;
            if (v) {
              var t = document.getElementById('ton-usd-price');
              if (t) t.textContent = '$' + Number(v).toFixed(2);
            }
          })
          .catch(function(){});
      } catch (e) {}
    }
    fetchTONPrice();
    setInterval(fetchTONPrice, 30000);

    // Insert BDB price card (below TON price), sourcing price from main page script defaults
    if (document.getElementById('ton-price-card')) {
      var bdbCard = document.createElement('div');
      bdbCard.className = 'card';
      bdbCard.id = 'bdb-price-card';
      bdbCard.style.marginTop = '12px';
      bdbCard.style.padding = '16px';
      bdbCard.style.display = 'flex';
      bdbCard.style.alignItems = 'center';
      bdbCard.style.justifyContent = 'space-between';
      bdbCard.innerHTML = '<span style="opacity:.9;">BDB Price (USD)</span><strong id="bdb-usd-price">$0.000012</strong>';
      document.getElementById('ton-price-card').insertAdjacentElement('afterend', bdbCard);

      // Try to read BDB price from opener (if navigated from index) or fallback constant
      var bdbPrice = 0.000012;
      try {
        if (window.opener && window.opener.__BDB_PRICE_USD__) {
          bdbPrice = Number(window.opener.__BDB_PRICE_USD__);
        }
      } catch (e) {}
      var bdbEl = document.getElementById('bdb-usd-price');
      if (bdbEl) bdbEl.textContent = '$' + bdbPrice.toFixed(6);
    }
  } catch (e) {}
})();
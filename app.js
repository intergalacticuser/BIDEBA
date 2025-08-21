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

    // Create card under ticker
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'deploy-stats-card';
    card.style.margin = '10px auto 0';
    card.style.maxWidth = '1000px';
    card.style.padding = '12px 16px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.innerHTML = '<span style="opacity:.9;">New contracts (recent blocks)</span><strong id="deploy-count">—</strong>';
    ticker.insertAdjacentElement('afterend', card);

    var apiBase = 'https://toncenter.com/api/v2';
    var apiKey = window.TONCENTER_API_KEY || '';

    function qs(params) {
      var s = Object.keys(params).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
      if (apiKey) s += (s ? '&' : '') + 'api_key=' + encodeURIComponent(apiKey);
      return s;
    }

    function fetchJson(url) { return fetch(url).then(function(r){ return r.json(); }); }

    function containsStateInit(obj) {
      try {
        var txt = JSON.stringify(obj);
        return /state_init/i.test(txt);
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
        for (var i=0;i<blocksToScan;i++) {
          var seq = last.seqno - i;
          var url = apiBase + '/getBlockTransactions?' + qs({ workchain: last.workchain, shard: last.shard, seqno: seq, count: 1024 });
          try {
            var txs = await fetchJson(url);
            if (txs && txs.ok && txs.result && Array.isArray(txs.result.transactions)) {
              total += countDeploysInTxList(txs.result.transactions);
            }
          } catch(e) { /* ignore individual block errors */ }
        }
        var el = document.getElementById('deploy-count');
        if (el) el.textContent = String(total);
      } catch (e) {
        var el2 = document.getElementById('deploy-count');
        if (el2) el2.textContent = 'API limit';
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
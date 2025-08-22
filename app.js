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

// Mark lazy iframes as loaded when content finishes loading (kept for future)
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

// Index page: disable contracts widget (explicitly turned off)
(function () {
  try {
    var page = (location.pathname || '').split('/').pop();
    var isIndex = page === '' || page === 'index.html';
    if (!isIndex) return;
    // Widget disabled by request
    return;
  } catch (e) {}
})();

// Enhance info.html: add TON price card and copy button + BDB price
(function () {
  try {
    var isInfo = (location.pathname || '').split('/').pop() === 'info.html';
    if (!isInfo) return;

    var infoContent = document.querySelector('.info-content');
    if (!infoContent) return;

    var contract = infoContent.querySelector('.contract-address');
    if (contract) {
      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn';
      copyBtn.id = 'copy-contract';
      copyBtn.textContent = 'Copy address';
      copyBtn.style.marginTop = '10px';
      copyBtn.style.marginBottom = '20px';
      contract.insertAdjacentElement('afterend', copyBtn);
      copyBtn.addEventListener('click', function () {
        try {
          var text = contract.textContent.replace('Contract Address:', '').trim();
          navigator.clipboard.writeText(text).then(function(){
            var prev = copyBtn.textContent; copyBtn.textContent = 'Copied!';
            setTimeout(function(){ copyBtn.textContent = prev; }, 1500);
          });
        } catch (e) {}
      });

      var tonCard = document.createElement('div');
      tonCard.className = 'card';
      tonCard.id = 'ton-price-card';
      tonCard.style.marginTop = '12px';
      tonCard.style.marginBottom = '16px';
      tonCard.style.padding = '16px';
      tonCard.style.display = 'flex';
      tonCard.style.alignItems = 'center';
      tonCard.style.justifyContent = 'space-between';
      tonCard.innerHTML = '<span style="opacity:.9;">TON Price (USD)</span><strong id="ton-usd-price">$—</strong>';
      copyBtn.insertAdjacentElement('afterend', tonCard);

      var bdbCard = document.createElement('div');
      bdbCard.className = 'card';
      bdbCard.id = 'bdb-price-card';
      bdbCard.style.marginTop = '12px';
      bdbCard.style.padding = '16px';
      bdbCard.style.display = 'flex';
      bdbCard.style.alignItems = 'center';
      bdbCard.style.justifyContent = 'space-between';
      bdbCard.innerHTML = '<span style="opacity:.9;">BDB Price (USD)</span><strong id="bdb-usd-price">$0.000012</strong>';
      tonCard.insertAdjacentElement('afterend', bdbCard);
    }

    async function fetchTONPrice() {
      try {
        var r1 = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd');
        var d1 = await r1.json();
        var v1 = d1 && d1.rates && (d1.rates.TON || d1.rates.ton) && ((d1.rates.TON||d1.rates.ton).prices || (d1.rates.TON||d1.rates.ton).PRICES);
        var usd1 = v1 && (v1.USD || v1.usd);
        if (usd1) {
          var t1 = document.getElementById('ton-usd-price'); if (t1) t1.textContent = '$' + Number(usd1).toFixed(2);
          return;
        }
      } catch (e) {}
      try {
        var r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
        var d2 = await r2.json();
        var usd2 = d2 && d2['the-open-network'] && d2['the-open-network'].usd;
        if (usd2) {
          var t2 = document.getElementById('ton-usd-price'); if (t2) t2.textContent = '$' + Number(usd2).toFixed(2);
        }
      } catch (e) {}
    }
    fetchTONPrice();
    setInterval(fetchTONPrice, 30000);

    try {
      var bdbPrice = 0.000012;
      if (window.opener && window.opener.__BDB_PRICE_USD__) {
        bdbPrice = Number(window.opener.__BDB_PRICE_USD__);
      }
      var bdbEl = document.getElementById('bdb-usd-price');
      if (bdbEl) bdbEl.textContent = '$' + bdbPrice.toFixed(6);
    } catch (e) {}
  } catch (e) {}
})();
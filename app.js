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
  } catch (e) {}
})();
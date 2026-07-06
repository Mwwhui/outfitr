import{g as k}from"./auth-CZe-TDDt.js";const s=t=>document.getElementById(t);let b=0;function S(t,i,a,o){cancelAnimationFrame(b);const r=performance.now(),l=n=>{const c=Math.min((n-r)/o,1),p=1-Math.pow(1-c,3);t.style.strokeDashoffset=String(i+(a-i)*p),c<1&&(b=requestAnimationFrame(l))};b=requestAnimationFrame(l)}const $=["Detecting garment type...","Checking your wardrobe...","Calculating outfit combos...","Generating verdict..."];function h(t){s("state-error").classList.remove("hidden"),s("state-loading").classList.add("hidden"),s("state-result").classList.add("hidden"),s("error-msg").textContent=t}function x(t,i){const a=document.querySelectorAll(".step-row"),o=Date.now()-i;a.forEach((r,l)=>{const n=r.querySelector(".step-circle"),c=r.querySelector(".step-label");n.className="step-circle",c.className="step-label",l<t?(n.classList.add("done"),n.textContent="✓",c.classList.add("done")):l===t?(n.classList.add("active"),n.textContent=String(l+1),c.classList.add("active")):(n.textContent=String(l+1),c.classList.add("future"))}),o>3e4?s("stuck-warning").classList.remove("hidden"):s("stuck-warning").classList.add("hidden")}function C(t){var p,w,f;s("state-loading").classList.add("hidden"),s("state-result").classList.remove("hidden");const i=t.score>=70?"#22c55e":t.score>=40?"#f97316":"#ef4444",a=326.7,o=a-t.score/100*a,r=s("sc-circle");r.style.stroke=i,r.style.strokeDashoffset=String(a),S(r,a,o,800),s("sc-text").textContent=String(t.score);const l=s("sc-verdict");l.textContent=t.verdict==="worth_it"?"WORTH IT":t.verdict==="consider"?"CONSIDER":"SKIP",l.style.color=i,s("sc-one-liner").textContent=t.one_liner,s("sc-reasoning").textContent=t.reasoning,t.rate_limited?s("rate-limit-notice").classList.remove("hidden"):s("rate-limit-notice").classList.add("hidden");const n={gap_fill:"#22c55e",color_fit:"#3b82f6",outfit_potential:"#a855f7",similarity_risk:"#ef4444",versatility:"#14b8a6"},c=[{key:"gap_fill",label:"Gap Fill",value:t.breakdown.gap_fill},{key:"color_fit",label:"Color Fit",value:t.breakdown.color_fit},{key:"similarity_risk",label:"Similarity Risk",value:t.breakdown.similarity_risk},{key:"outfit_potential",label:"Outfit Pot.",value:t.breakdown.outfit_potential},{key:"versatility",label:"Versatility",value:t.breakdown.versatility}];if(s("breakdown-bars").innerHTML=c.map(e=>`
    <div class="bar-row">
      <span class="bar-label">${e.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${e.value}%;background:${n[e.key]||"#000"}"></div>
      </div>
      <span class="bar-value">${e.value}</span>
    </div>`).join(""),((p=t.similar_items)==null?void 0:p.length)>0&&(s("similar-section").classList.remove("hidden"),s("similar-list").innerHTML=t.similar_items.map(e=>`<div class="thumb-item">
        <div class="thumb">${e.image_url?`<img src="${e.image_url}" alt="${e.name}" />`:e.name[0]}</div>
        <span class="thumb-label">${e.name}</span>
      </div>`).join("")),((w=t.ghost_items)==null?void 0:w.length)>0&&(s("ghost-section").classList.remove("hidden"),s("ghost-list").innerHTML=`
      <div class="ghost-warning">
        <span class="ghost-warning-icon">⚠️</span>
        <p class="ghost-warning-text">You already own similar items you rarely wear</p>
      </div>
      <div class="ghost-scroll">
        ${t.ghost_items.map(e=>`
          <div class="ghost-item-card">
            <div class="ghost-thumb-wrap">
              ${e.image_url?`<img src="${e.image_url}" alt="${e.name}" class="ghost-thumb-img" />`:'<div class="ghost-thumb-placeholder">👕</div>'}
            </div>
            <span class="gi-name">${e.name}</span>
            <span class="gi-wear">worn ${e.wear_count}x</span>
          </div>
        `).join("")}
      </div>`),((f=t.suggested_pairings)==null?void 0:f.length)>0&&(s("pairings-section").classList.remove("hidden"),t.outfit_multiplier>0&&(s("multiplier-info").innerHTML=`
        <div class="multiplier-heading">
          <span class="multiplier-icon">✦</span>
          <div>
            <p class="multiplier-count">Unlocks <strong>${t.outfit_multiplier} new looks</strong></p>
            <p class="multiplier-sub">New outfit combinations with your existing wardrobe</p>
          </div>
        </div>`),s("pairings-list").innerHTML=t.suggested_pairings.map(e=>`<div class="pairing-card">
        <div class="pairing-thumb">
          ${e.image_url?`<img src="${e.image_url}" alt="${e.name}" />`:e.color?`<span class="pairing-color-dot" style="background:${e.color}"></span>`:'<span class="pairing-color-dot" style="background:#e3e2e2"></span>'}
        </div>
        <div class="pairing-info">
          <p class="pairing-name">${e.name}</p>
          <p class="pairing-type">${e.type}</p>
        </div>
      </div>`).join("")),t.cost_per_wear){s("cpw-section").classList.remove("hidden");const e=t.cost_per_wear,u=Math.max(e.projected_cpw,e.wardrobe_average_cpw,1),v=e.projected_cpw/u*100,_=e.wardrobe_average_cpw/u*100;let d,g,m;e.verdict==="below_average"?(d="#22c55e",g="✓",m="Better than average"):e.verdict==="similar"?(d="#f97316",g="!",m="Similar to average"):e.verdict==="above_average"?(d="#ef4444",g="⚠",m="Higher than average"):(d="#9ca3af",g="?",m="Unknown"),s("cpw-content").innerHTML=`
      <div class="cpw-grid">
        <div class="metric"><div class="val">$${e.projected_cpw}</div><div class="lbl">Proj. CPW</div></div>
        <div class="metric"><div class="val">$${e.wardrobe_average_cpw}</div><div class="lbl">Wardrobe Avg</div></div>
        <div class="metric"><div class="val">${e.projected_wears}</div><div class="lbl">Est. Wears</div></div>
        <div class="metric"><div class="val">$${e.estimated_price}</div><div class="lbl">Price</div></div>
      </div>
      <div class="cpw-bar-wrap">
        <div class="cpw-bar-container">
          <div class="cpw-bar-track"></div>
          <div class="cpw-bar-avg" style="right:${100-_}%"></div>
          <div class="cpw-bar-fill" style="width:${v}%;background:${d}"></div>
          <div class="cpw-bar-dot" style="left:${v}%;background:${d}"></div>
        </div>
        <div class="cpw-verdict" style="color:${d}">
          <span>${g}</span>
          <span>${m}</span>
        </div>
      </div>`}if(t.budget_context){s("budget-section").classList.remove("hidden");const e=t.budget_context,u=e.flag==="over_budget"?"#dc2626":"#16a34a";let v="";e.flag==="over_budget"&&e.wardrobe_average>0&&(v=`<div class="budget-warning">This is ${Math.round(e.item_price/e.wardrobe_average*10)/10}× your average item price.</div>`),s("budget-content").innerHTML=`
      <div class="budget-grid">
        <div class="metric"><div class="val" style="color:${u}">$${e.item_price}</div><div class="lbl">Item Price</div></div>
        <div class="metric"><div class="val">$${e.wardrobe_average}</div><div class="lbl">Your Avg</div></div>
        <div class="metric"><div class="val">$${e.wardrobe_median}</div><div class="lbl">Median</div></div>
        <div class="metric"><div class="val">$${e.wardrobe_max}</div><div class="lbl">Max</div></div>
      </div>
      ${v}`}}s("retry-btn").addEventListener("click",()=>{s("state-error").classList.add("hidden"),s("state-loading").classList.remove("hidden"),L()});function y(){s("state-loading").classList.add("hidden"),s("state-error").classList.add("hidden"),s("state-result").classList.add("hidden"),s("state-ready").classList.remove("hidden")}s("scan-another-btn").addEventListener("click",async()=>{await chrome.storage.session.remove(["lastResult","lastError","progressStep","startedAt"]),await chrome.storage.session.set({scanningStatus:"ready"}),y()});async function L(){const t=()=>{chrome.storage.session.get(["scanningStatus","lastResult","lastError","progressStep","startedAt"],i=>{if(i.scanningStatus==="scanning"){s("state-loading").classList.remove("hidden"),s("state-error").classList.add("hidden"),s("state-result").classList.add("hidden");const a=i.progressStep??0,o=i.startedAt??Date.now(),r=Date.now()-o;s("progress-steps").classList.remove("hidden"),x(a,o);const l=Math.min(a,$.length-1);if(s("loading-msg").textContent=$[l],r>9e4){h("Scan timed out. Please try again.");return}setTimeout(t,500)}else i.lastResult?C(i.lastResult):i.lastError?h(i.lastError):k()?y():h("Not connected. Open the popup to enter your API token.")})};t()}L();

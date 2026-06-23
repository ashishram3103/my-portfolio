'use strict';

if(!window.gsap || !window.ScrollTrigger){
  if('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.body.classList.add('no-gsap');
  document.body.classList.remove('is-loading');
  const loader=document.getElementById('site-loader');
  if(loader) loader.remove();
  throw new Error('GSAP or ScrollTrigger failed to load.');
}

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ignoreMobileResize:true,limitCallbacks:true,fastScrollEnd:true,preventOverlaps:true});
gsap.defaults({ease:'expo.out',duration:0.9});
gsap.ticker.lagSmoothing(500, 33);

// matchMedia matches the CSS @media(max-width:900px) exactly and is accurate in all
// browsers/DevTools — unlike window.innerWidth which is stale in emulation mode.
const IS_MOBILE = window.matchMedia('(max-width:900px)').matches;

let RESET_SCROLL_ON_LOAD = !window.location.hash;
try{
  const nav = performance.getEntriesByType('navigation')[0];
  if(nav && nav.type === 'reload') RESET_SCROLL_ON_LOAD = true;
}catch(e){}

if('scrollRestoration' in window.history){
  window.history.scrollRestoration = 'manual';
}

function hardResetScroll(){
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

if(RESET_SCROLL_ON_LOAD){
  hardResetScroll();
}

function refreshScrollSystems(delay=0){
  const run=()=>{
    if(window.ScrollTrigger) ScrollTrigger.refresh(true);
  };
  if(delay) setTimeout(run, delay);
  else requestAnimationFrame(run);
}

window.addEventListener('pageshow', e=>{
  if(e.persisted){
    if(RESET_SCROLL_ON_LOAD) hardResetScroll();
    refreshScrollSystems(0);
  }
});

/* ============================================================
   ANCHOR SMOOTH SCROLL
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const href = a.getAttribute('href');
    if(!href || href === '#') return;
    const target = document.querySelector(href);
    if(!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.pageYOffset - 36;
    window.scrollTo({top:y, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  });
});

/* ============================================================
   CURSOR — single setState system. Work cursor = yellow ring + LOOK label.
   ============================================================ */
(function(){
  if(IS_MOBILE) return;
  const dot=document.getElementById('cur-dot');
  const ring=document.getElementById('cur-ring');
  const label=document.getElementById('cur-label');
  if(!dot||!ring||!label) return;
  let mx=0,my=0,rx=0,ry=0;
  document.addEventListener('mousemove',e=>{
    mx=e.clientX;my=e.clientY;
    gsap.set(dot,{x:mx,y:my});
    gsap.set(label,{x:mx,y:my});
  },{passive:true});
  gsap.ticker.add(()=>{rx+=(mx-rx)*.18;ry+=(my-ry)*.18;gsap.set(ring,{x:rx,y:ry});});

  let __curState = null;
  function setState(state, text){
    if(state === __curState){
      // Same state — only update label if it actually changed
      if(text != null && label.textContent !== text) label.textContent = text;
      return;
    }
    __curState = state;
    document.body.classList.remove('cur-hover','cur-text','cur-image','cur-drag','cur-work','cur-hidden');
    if(state) document.body.classList.add('cur-'+state);
    if(text != null) label.textContent = text;
  }

  // Exclude work-tile anchors so the section-level cur-work state isn't overwritten
  document.querySelectorAll('a:not(.wcard):not(.wcard-cta-link),button,.svc-row,.exp-item,.skill-tag,.cnt-btn-email,.cnt-btn-phone,.currently-badge,.testi-glass,.rs-stage').forEach(el=>{
    el.addEventListener('mouseenter',()=>setState('hover'));
    el.addEventListener('mouseleave',()=>setState(null));
  });
  // Work tiles — bind enter/leave at SECTION level so the ring stays in cur-work
  // when sliding between tiles (no shrink/regrow flicker). Per-tile mouseenter
  // only swaps the --cur-work-color CSS variable on body. Color is read from each
  // tile's own .wcard-bg / .wcard-overlay inline style so no markup change needed.
  const workSection = document.getElementById('work-section');
  const workGrid = workSection && workSection.querySelector('.work-grid');
  if(workSection && workGrid){
    workGrid.addEventListener('mouseenter',()=>setState('work','LOOK'));
    workGrid.addEventListener('mouseleave',()=>{
      setState(null);
      ring.style.removeProperty('--cur-work-color');
    });
    workSection.querySelectorAll('.wcard, .wcard-cta').forEach(card=>{
      const src = card.querySelector('.wcard-bg, .wcard-overlay');
      let color = '';
      if(src){
        const m = (src.getAttribute('style')||'').match(/background\s*:\s*([^;]+)/i);
        if(m) color = m[1].trim();
      }
      if(!color) return;
      const isDark = /var\(--black\)|#0d0d0d|#000|^black$/i.test(color.trim());
      const cursorColor = isDark ? '#ffffff' : color;
      card.addEventListener('mouseenter',()=>{
        ring.style.setProperty('--cur-work-color', cursorColor);
      });
    });
  }
  document.querySelectorAll('.arch-card img,.vid-reel-card').forEach(el=>{
    el.addEventListener('mouseenter',()=>setState('image'));
    el.addEventListener('mouseleave',()=>setState(null));
  });
  document.querySelectorAll('.arch-flow-wrap').forEach(el=>{
    el.addEventListener('mouseenter',()=>setState('drag','DRAG'));
    el.addEventListener('mouseleave',()=>setState(null));
  });
  document.querySelectorAll('.about-bio-block,.exp-item .exp-role,.hero-bio').forEach(el=>{
    el.addEventListener('mouseenter',()=>setState('text'));
    el.addEventListener('mouseleave',()=>setState(null));
  });
})();

/* ============================================================
   INK TRAIL — single source, coloured per section
   ============================================================ */
(function(){
  if(IS_MOBILE) return;
  const POOL=10, THROTTLE=80;
  const pool=[];
  for(let i=0;i<POOL;i++){
    const b=document.createElement('div');
    b.className='ink-blob';
    document.body.appendChild(b);
    pool.push(b);
  }
  let idx=0, lastT=0;
  document.addEventListener('mousemove',e=>{
    const now=performance.now();
    if(now-lastT<THROTTLE) return;
    lastT=now;
    const blob=pool[idx%POOL]; idx++;
    const sectionColor=(window.__trailColor && window.__trailColor()) || '#F9D100';
    blob.style.setProperty('--ink-color', sectionColor);
    blob.style.left=e.clientX+'px';
    blob.style.top=e.clientY+'px';
    const size=10+Math.random()*8;
    blob.style.width=size+'px';
    blob.style.height=size+'px';
    blob.style.transform='translate(-50%,-50%) scale(1)';
    blob.style.opacity='0.55';
    blob.style.transition='none';
    requestAnimationFrame(()=>{
      blob.style.transition='transform 0.7s ease-out, opacity 0.7s ease-out';
      blob.style.transform='translate(-50%,-50%) scale(0.1)';
      blob.style.opacity='0';
    });
  },{passive:true});
})();

/* ============================================================
   TRAIL COLOUR PER SECTION
   ============================================================ */
(function(){
  if(IS_MOBILE) return;
  const sections=[
    {id:'hero-section',color:'#F9D100'},
    {id:'work-section',color:'#EE3A5A'},
    {id:'vid-section',color:'#2B5EB8'},
    {id:'archive-section',color:'#45B649'},
    {id:'services-section',color:'#F9D100'},
    {id:'exp-section',color:'#F9D100'},
    {id:'testimonials-section',color:'#EE3A5A'},
    {id:'about-section',color:'#EE3A5A'},
    {id:'skills-section',color:'#45B649'},
    {id:'capability-section',color:'#F9D100'},
    {id:'contact-section',color:'#F9D100'},
  ];
  let currentColor='#F9D100';
  window.__trailColor=()=>currentColor;
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const found=sections.find(s=>s.id===entry.target.id);
        if(found) currentColor=found.color;
      }
    });
  },{threshold:0.3});
  sections.forEach(s=>{const el=document.getElementById(s.id);if(el)obs.observe(el);});
})();

/* ============================================================
   SPLIT TEXT HELPER
   ============================================================ */
function __splitChars(t){
  function walk(node){
    const kids = Array.from(node.childNodes);
    kids.forEach(child=>{
      if(child.nodeType===Node.TEXT_NODE){
        const frag = document.createDocumentFragment();
        child.textContent.split('').forEach(ch=>{
          const sp = document.createElement('span');
          sp.className='split-char';
          sp.textContent = ch === ' ' ? '\u00a0' : ch;
          frag.appendChild(sp);
        });
        child.replaceWith(frag);
      } else if(child.nodeType===Node.ELEMENT_NODE && child.tagName !== 'BR'){
        walk(child);
      }
    });
  }
  walk(t);
  return t.querySelectorAll('.split-char');
}

/* ============================================================
   DEFAULT CHAR REVEAL (titles without data-anim) — once
   ============================================================ */
(function(){
  document.querySelectorAll('.sec-title, .testi-board-head h2, .vid-flow-head h2').forEach(t=>{
    if(t.dataset.splitDone) return;
    if(t.classList.contains('sec-title-reveal') || t.querySelector('.char')) return;
    if(t.dataset.anim) return;
    t.dataset.splitDone='1';
    const chars = __splitChars(t);
    gsap.set(chars, {yPercent:105, opacity:0, force3D:true});
    ScrollTrigger.create({
      trigger:t, start:'top 88%', once:true,
      onEnter:()=>gsap.to(chars,{yPercent:0, opacity:1, stagger:0.018, duration:0.85, ease:'expo.out', overwrite:'auto'})
    });
  });
})();

/* ============================================================
   VARIED SECTION TITLE ENTRANCES — by data-anim, once
   ============================================================ */
(function(){
  if(window.matchMedia('(max-width:599px)').matches) return;
  const variants = {
    drop:(chars)=>{
      gsap.set(chars,{yPercent:-120,opacity:0,rotate:-8,force3D:true});
      return ()=>gsap.to(chars,{yPercent:0,opacity:1,rotate:0,stagger:{each:0.024,from:'random'},duration:1.0,ease:'expo.out',overwrite:'auto'});
    },
    mask:(chars)=>{
      gsap.set(chars,{y:34,opacity:0,force3D:true});
      return ()=>gsap.to(chars,{y:0,opacity:1,stagger:0.022,duration:0.9,ease:'expo.out',overwrite:'auto'});
    },
    zoom:(chars)=>{
      gsap.set(chars,{scale:1.45,opacity:0,rotate:-4,force3D:true});
      return ()=>gsap.to(chars,{scale:1,opacity:1,rotate:0,stagger:{each:0.017,from:'edges'},duration:0.85,ease:'expo.out',overwrite:'auto'});
    },
    skew:(chars)=>{
      gsap.set(chars,{opacity:0,skewX:18,x:-28,filter:'blur(4px)',force3D:true});
      return ()=>gsap.to(chars,{opacity:1,skewX:0,x:0,filter:'blur(0px)',stagger:0.02,duration:0.85,ease:'expo.out',overwrite:'auto'});
    },
    scramble:(chars)=>{
      gsap.set(chars,{opacity:0,scale:1.35,rotate:5,force3D:true});
      return ()=>gsap.to(chars,{opacity:1,scale:1,rotate:0,stagger:{each:0.014,from:'center'},duration:0.85,ease:'back.out(1.35)',overwrite:'auto'});
    }
  };
  document.querySelectorAll('[data-anim]').forEach(t=>{
    if(t.dataset.splitDone) return;
    const fn=variants[t.dataset.anim];
    if(!fn) return;
    t.dataset.splitDone='1';
    const chars=__splitChars(t);
    const play=fn(chars);
    ScrollTrigger.create({trigger:t,start:'top 86%',once:true,onEnter:play});
  });
})();

/* ============================================================
   HERO CANVAS — IO-paused (already section-scoped)
   ============================================================ */
(function(){
  const cv=document.getElementById('hero-canvas');if(!cv) return;
  const ctx=cv.getContext('2d');
  const N=IS_MOBILE?12:22,COL=['#2B5EB8','#EE3A5A','#45B649','#F9D100'],CONN_DIST=105,SPEED=0.24;
  let W,H,pts=[],raf,active=true;
  function resize(){W=cv.width=cv.offsetWidth;H=cv.height=cv.offsetHeight;}
  function mkPts(){pts=[];for(let i=0;i<N;i++)pts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*SPEED,vy:(Math.random()-.5)*SPEED,r:Math.random()*2.2+1.2,c:COL[i%4]});}
  function tick(){
    if(!active) return;
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<CONN_DIST){ctx.beginPath();ctx.strokeStyle=`rgba(13,13,13,${(1-d/CONN_DIST)*.12})`;ctx.lineWidth=1;ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.stroke();}}
    pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.c+'30';ctx.fill();p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;});
    raf=requestAnimationFrame(tick);
  }
  let rt,lastVW=window.innerWidth,lastVH=window.innerHeight;
  window.addEventListener('resize',()=>{
    if(IS_MOBILE){
      const vw=window.innerWidth,vh=window.innerHeight;
      if(Math.abs(vw-lastVW)<2 && Math.abs(vh-lastVH)<120) return;
      lastVW=vw;lastVH=vh;
    }
    clearTimeout(rt);rt=setTimeout(()=>{resize();mkPts();},260);
  },{passive:true});
  resize();mkPts();tick();
  const hero=document.getElementById('hero-section');
  if('IntersectionObserver' in window && hero){
    const io=new IntersectionObserver(entries=>{
      active=entries[0].isIntersecting && !document.hidden;
      if(active && !raf) tick();
      if(!active){cancelAnimationFrame(raf);raf=null;}
    },{threshold:0});
    io.observe(hero);
  }
  document.addEventListener('visibilitychange',()=>{
    active=!document.hidden && (!hero || hero.getBoundingClientRect().bottom>0);
    if(active && !raf) tick();
    if(!active){cancelAnimationFrame(raf);raf=null;}
  });
})();

/* ============================================================
   SCRAMBLE TEXT — IO-guarded (only loops while hero visible)
   ============================================================ */
(function(){
  const els=Array.from(document.querySelectorAll('.hero-scramble-text'));if(!els.length) return;
  const TARGET='moves.',CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%&*';
  let interval, loopTimer, heroInView=true;

  function setScrambleText(text){els.forEach(el=>{el.textContent=text;});}

  function scramble(){
    if(!heroInView){setScrambleText(TARGET);return;}
    let i=0;clearInterval(interval);
    interval=setInterval(()=>{
      const text=TARGET.split('').map((_,j)=>j<i?TARGET[j]:CHARS[Math.floor(Math.random()*CHARS.length)]).join('').toLowerCase();
      setScrambleText(text);
      if(i>=TARGET.length){clearInterval(interval);setScrambleText(TARGET);}
      i+=0.4;
    },50);
  }

  function startLoop(){clearInterval(loopTimer);loopTimer=setInterval(scramble,5000);}
  function stopLoop(){clearInterval(loopTimer);clearInterval(interval);loopTimer=null;}

  const hero=document.getElementById('hero-section');
  if('IntersectionObserver' in window && hero){
    const io=new IntersectionObserver(entries=>{
      heroInView=entries.some(entry=>entry.isIntersecting);
      if(heroInView){startLoop();}
      else{stopLoop();setScrambleText(TARGET);}
    },{threshold:0.05});
    io.observe(hero);
  } else {
    startLoop();
  }

  window.addEventListener('load',()=>setTimeout(scramble,1800));
})();

/* ============================================================
   HERO LOAD ANIMATION
   ============================================================ */
function playHeroIntro(){
  gsap.to('.h-li',{y:'0%',duration:1.05,stagger:.09,ease:'power3.out'});
  gsap.from('.hero-top-row > *',{opacity:0,y:20,duration:.75,stagger:.08,ease:'power2.out',delay:.75});
  if(IS_MOBILE){
    gsap.set('.hero-bottom-row > *',{clearProps:'opacity,transform'});
  }else{
    gsap.from('.hero-bottom-row > *',{opacity:0,y:24,duration:.78,stagger:.08,ease:'power2.out',delay:.8});
    gsap.fromTo(['.hero-svg-panel','#hero-icon-terminal','.hero-build-lab'],
      {opacity:0,y:22,scale:.96},
      {opacity:1,y:0,scale:1,duration:.82,stagger:.12,ease:'power3.out',delay:.72}
    );
  }
  gsap.from('#main-nav',{opacity:0,y:-12,duration:.65,delay:.2,ease:'power2.out'});
}

function finishSiteLoader(){
  const loader=document.getElementById('site-loader');
  const done=()=>{
    if(RESET_SCROLL_ON_LOAD) hardResetScroll();
    document.body.classList.remove('is-loading');
    playHeroIntro();
    /* Single safe refresh after the loader changes the visual viewport */
    refreshScrollSystems(450);
  };
  if(!loader){done();return;}
  const tl=gsap.timeline({defaults:{ease:'power3.out'},onComplete:()=>{loader.remove();done();}});
  tl.to('.loader-title',{y:-14,opacity:0,duration:.45})
    .to('.loader-kicker,.loader-meta,.loader-mark,.loader-signature',{opacity:0,y:-12,duration:.35},'<')
    .to('#site-loader',{clipPath:'inset(0 0 100% 0)',duration:.8,ease:'power4.inOut'},'-=.1');
}

window.addEventListener('load',()=>setTimeout(finishSiteLoader,650));


/* ============================================================
   WORD SCROLL — verb auto-switch IO-guarded
   ============================================================ */
(function(){
  const words=['web applications.','interactive systems.','scroll experiences.',
    'animation engines.','brand websites.','component systems.',
    'user interfaces.','digital products.','creative code.','scrollytelling.'];
  const curEl=document.getElementById('word-current');
  const pipsEl=document.getElementById('word-pips');
  const inner=document.getElementById('word-inner');
  const tapIndicator=document.getElementById('word-tap-indicator');
  if(!curEl||!pipsEl||!inner) return;
  let idx=0,tapped=false;

  /* Verb auto-switch — IO-guarded */
  const verbEl=document.getElementById('word-verb');
  let verbIdx=0,verbTimer=null;
  const verbs=['develop','design'];
  function startVerbLoop(){
    if(verbTimer || !verbEl) return;
    verbTimer=setInterval(()=>{
      verbIdx=(verbIdx+1)%verbs.length;
      gsap.to(verbEl,{y:-18,opacity:0,duration:.22,ease:'power2.in',onComplete:()=>{
        verbEl.textContent=verbs[verbIdx];
        gsap.fromTo(verbEl,{y:18,opacity:0},{y:0,opacity:1,duration:.34,ease:'power3.out'});
      }});
    },1800);
  }
  function stopVerbLoop(){if(verbTimer){clearInterval(verbTimer);verbTimer=null;}}

  const wordSection=document.getElementById('word-section');
  let flashLine=null;
  if(wordSection && !IS_MOBILE){
    flashLine=document.createElement('span');
    flashLine.className='word-flash-line';
    wordSection.appendChild(flashLine);
  }
  if('IntersectionObserver' in window && wordSection && verbEl){
    const io=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting) startVerbLoop();
      else stopVerbLoop();
    },{threshold:0.05});
    io.observe(wordSection);
  } else if(verbEl){
    startVerbLoop();
  }

  words.forEach((_,i)=>{
    const p=document.createElement('span');p.className='word-pip'+(i===0?' is-active':'');pipsEl.appendChild(p);
  });
  gsap.set(curEl,{y:'0%',opacity:1});

  function advance(){
    if(!tapped&&tapIndicator){
      tapped=true;
      tapIndicator.classList.add('tapped');
      setTimeout(()=>tapIndicator.style.display='none',400);
    }
    idx=(idx+1)%words.length;
    gsap.to(curEl,{y:'-110%',opacity:0,duration:.3,ease:'power2.in',
      onComplete:()=>{
        curEl.textContent=words[idx];
        gsap.fromTo(curEl,{y:'110%',opacity:0},{y:'0%',opacity:1,duration:.45,ease:'back.out(1.8)'});
      }
    });
    if(flashLine){
      gsap.killTweensOf(flashLine);
      gsap.set(flashLine,{scaleX:0,opacity:1,overwrite:true});
      gsap.to(flashLine,{scaleX:1,duration:.22,ease:'power2.in',
        onComplete:()=>{
          gsap.to(flashLine,{opacity:0,duration:.16,ease:'power2.out',
            onComplete:()=>{ gsap.set(flashLine,{scaleX:0}); }
          });
        }
      });
    }
    document.querySelectorAll('.word-pip').forEach((p,i)=>p.classList.toggle('is-active',i===idx));
  }
  inner.addEventListener('click',advance);
  let touchStartX=0,touchStartY=0,touchStartT=0;
  inner.addEventListener('touchstart',e=>{
    const t=e.changedTouches&&e.changedTouches[0];
    if(!t) return;
    touchStartX=t.clientX;touchStartY=t.clientY;touchStartT=Date.now();
    inner.classList.add('touch-active');
  },{passive:true});
  inner.addEventListener('touchend',e=>{
    const t=e.changedTouches&&e.changedTouches[0];
    if(!t){inner.classList.remove('touch-active');return;}
    const dx=Math.abs(t.clientX-touchStartX);
    const dy=Math.abs(t.clientY-touchStartY);
    const dt=Date.now()-touchStartT;
    if(dx<14 && dy<14 && dt<450) advance();
    setTimeout(()=>{ inner.classList.remove('touch-active'); },320);
  },{passive:true});
  inner.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')advance();});
})();

/* ============================================================
   COUNTERS — once, no recount
   ============================================================ */
(function(){
  document.querySelectorAll('.ctr-num').forEach(el=>{
    const target=parseInt(el.dataset.target);
    const flash=el.previousElementSibling;
    ScrollTrigger.create({trigger:el,start:'top 85%',once:true,
      onEnter:()=>{
        const o={v:0};
        if(flash)gsap.to(flash,{opacity:.35,duration:.1,yoyo:true,repeat:5,ease:'none'});
        gsap.to(o,{v:target,duration:1.6,ease:'power2.out',onUpdate:()=>{el.textContent=Math.round(o.v);}});
        gsap.to(el,{scale:1.05,duration:.15,delay:1.55,yoyo:true,repeat:1,ease:'power2.out'});
      }
    });
  });
})();

/* ============================================================
   HERO LIGHT STREAK TRAILS
   ============================================================ */
(function(){
  if(IS_MOBILE) return;
  const hero=document.getElementById('hero-section');if(!hero) return;
  const trails=[];
  const TRAIL_MAX=8;
  let lastTrailX=0,lastTrailY=0,lastTrailTime=0;

  function spawnTrail(x,y,prevX,prevY){
    const now=performance.now();
    if(now-lastTrailTime<38) return;
    lastTrailTime=now;
    const dx=x-prevX,dy=y-prevY,speed=Math.sqrt(dx*dx+dy*dy);
    if(speed<10) return;
    const el=document.createElement('div');
    el.className='hero-trail';
    const size=Math.random()*8+4;
    const col=window.__trailColor?window.__trailColor():'#F9D100';
    Object.assign(el.style,{
      width:size+'px',height:size+'px',
      background:col,opacity:'0.7',
      left:(x-size/2)+'px',top:(y-size/2)+'px',
      position:'fixed',pointerEvents:'none',zIndex:'1',
      borderRadius:'50%',filter:`blur(${Math.random()*2}px)`
    });
    hero.appendChild(el);
    trails.push(el);
    gsap.to(el,{scale:0,opacity:0,duration:.55,ease:'power2.out',
      onComplete:()=>{el.remove();const i=trails.indexOf(el);if(i>-1)trails.splice(i,1);}});
    if(trails.length>TRAIL_MAX){const old=trails.shift();old.remove();}
  }

  hero.addEventListener('mousemove',e=>{
    spawnTrail(e.clientX,e.clientY,lastTrailX,lastTrailY);
    lastTrailX=e.clientX;lastTrailY=e.clientY;
  });
})();

/* ============================================================
   WORK CARDS — reverse on scroll-back
   ============================================================ */
gsap.utils.toArray('.wcard,.wcard-cta').forEach((c,i)=>{
  gsap.from(c,{clipPath:'inset(0 0 100% 0)',duration:.85,delay:(i%2)*.1,ease:'power3.out',
    scrollTrigger:{trigger:c,start:'top 86%',toggleActions:'play none none reverse'}});
});

/* ============================================================
   WORK SVG DRAW
   ============================================================ */
(function(){
  gsap.utils.toArray('.wcard-svg').forEach(svg=>{
    const parts=svg.querySelectorAll('path,line,circle,polyline');
    parts.forEach((el,i)=>{
      let len=420;try{len=el.getTotalLength?el.getTotalLength():420;}catch(e){}
      el.style.strokeDasharray=len;el.style.strokeDashoffset=len;
      gsap.to(el,{strokeDashoffset:0,duration:.9,delay:i*.025,ease:'power2.out',
        scrollTrigger:{trigger:svg,start:'top 82%',toggleActions:'play none none reverse'}});
    });
    const card=svg.closest('.wcard');
    if(card){
      card.addEventListener('mouseenter',()=>gsap.to(parts,{strokeDashoffset:0,scale:1.025,transformOrigin:'50% 50%',duration:.45,ease:'power2.out',stagger:.006}));
      card.addEventListener('mouseleave',()=>gsap.to(parts,{scale:1,duration:.45,ease:'power2.out'}));
    }
  });
})();

/* ============================================================
   VIDEO / BUILD REEL — connector scrub, IO autoplay, card reveal
   ============================================================ */
(function(){
  const path=document.getElementById('vid-conn-path');
  const allVideos=document.querySelectorAll('#vid-section video');

  allVideos.forEach(v=>{
    v.muted=true;v.playsInline=true;v.loop=true;
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
  });

  const safePlay=v=>{try{const p=v.play();if(p&&p.catch) p.catch(()=>{});}catch(e){}};

  if(IS_MOBILE){
    // Save bandwidth: only the first video keeps its source on mobile. The rest
    // unload. We DON'T return — the connector draw + copy/hook reveals still run
    // so the full build-reel narrative is present on mobile, not just the video.
    allVideos.forEach((v,i)=>{
      if(i===0){v.preload='auto';safePlay(v);}
      else{v.pause();v.removeAttribute('src');v.querySelectorAll('source').forEach(s=>s.removeAttribute('src'));v.load();}
    });
  }

  if(path){
    /* Hide immediately with a large safe value */
    path.style.strokeDasharray = '9999';
    path.style.strokeDashoffset = '9999';

    /* Measure after full paint — requestAnimationFrame + setTimeout ensures layout is done */
    function initPath(){
      let len = 9999;
      try{
        const l = path.getTotalLength();
        if(l > 10) len = l;
      }catch(e){}
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;

      /* Scrub: start drawing when section top hits viewport bottom.
         Finish drawing when section bottom hits viewport top.
         This matches the full scroll distance through the section. */
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger:{
          trigger: '#vid-01',
          start: 'center 62%',
          endTrigger: '.vid-copy-end',
          end: 'top 88%',
          scrub: 0.3,
          invalidateOnRefresh: true,
        }
      });
    }

    /* Double-deferred so layout is fully calculated */
    requestAnimationFrame(()=>setTimeout(initPath, 50));
  }

  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const v=entry.target;
        if(entry.isIntersecting) safePlay(v);
        else v.pause();
      });
    },{threshold:0.18,rootMargin:'120px 0px'});
    allVideos.forEach(v=>io.observe(v));
  } else { allVideos.forEach(safePlay); }

  gsap.utils.toArray('.vid-reel-card').forEach((card,i)=>{
    gsap.fromTo(card,{autoAlpha:0,y:60,scale:.94,rotate:i%2?-1.5:1.5},
      {autoAlpha:1,y:0,scale:1,rotate:0,duration:.85,ease:'power3.out',
       scrollTrigger:{trigger:card,start:'top 84%',toggleActions:'play none none reverse'}});
  });
  gsap.utils.toArray('.vid-copy,.vid-break-hook').forEach(el=>{
    gsap.fromTo(el,{autoAlpha:0,y:34},{autoAlpha:1,y:0,duration:.72,ease:'power3.out',
      scrollTrigger:{trigger:el,start:'top 86%',toggleActions:'play none none reverse'}});
  });
  gsap.to('.vid-orb--sq',{rotation:120,scrollTrigger:{trigger:'#vid-section',start:'top bottom',end:'bottom top',scrub:1}});
  gsap.to('.vid-orb--dot',{y:180,x:-80,scrollTrigger:{trigger:'#vid-section',start:'top bottom',end:'bottom top',scrub:1}});
})();


/* ============================================================
   BUILD UX CHIPS — section-scoped, paused outside
   ============================================================ */
(function(){
  // Gear runs at all widths; CSS controls visibility (shown >=600px, hidden below).
  // Path + chips are percentage-based so they adapt to the stage size automatically.
  const stage=document.querySelector('#vid-section .vid-flow-stage');
  if(!stage || stage.querySelector('.ux-build-layer')) return;
  const layer=document.createElement('div');
  layer.className='ux-build-layer';
  layer.innerHTML=`
    <span class="ux-dc-path-gear"><span class="ux-dc-gear-body"></span><span class="ux-dc-gear-ring"></span><span class="ux-dc-gear-hub"></span></span>
    <span class="ux-obj ux-obj--magnet"><svg viewBox="0 0 210 156" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="59" y="48" width="95" height="67" fill="#0D0D0D" rx="2"/>
      <rect x="54" y="43" width="95" height="67" fill="#F7F7F4" stroke="#0D0D0D" stroke-width="2" rx="2"/>
      <line class="ux-mb-gla" x1="20" y1="55" x2="54" y2="62" stroke="rgba(13,13,13,.55)" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"/>
      <line class="ux-mb-glb" x1="190" y1="70" x2="149" y2="76" stroke="rgba(13,13,13,.55)" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"/>
      <g class="ux-mb-moda"><rect x="2" y="32" width="64" height="19" fill="#F9D100" stroke="#0D0D0D" stroke-width="2" rx="1"/><rect x="9" y="37" width="22" height="6" fill="rgba(13,13,13,.18)" rx="1"/><rect x="36" y="37" width="18" height="6" fill="rgba(13,13,13,.1)" rx="1"/></g>
      <g class="ux-mb-modb"><rect x="4" y="102" width="40" height="40" fill="#F7F7F4" stroke="#0D0D0D" stroke-width="2" rx="1"/><rect x="10" y="109" width="24" height="6" fill="rgba(13,13,13,.18)" rx="1"/><rect x="10" y="120" width="16" height="6" fill="rgba(13,13,13,.1)" rx="1"/></g>
      <g class="ux-mb-modc"><rect x="154" y="26" width="54" height="36" fill="#D8E4F5" stroke="#0D0D0D" stroke-width="2" rx="1"/><rect x="160" y="32" width="16" height="6" fill="rgba(43,94,184,.28)" rx="1"/><rect x="160" y="42" width="30" height="5" fill="rgba(43,94,184,.18)" rx="1"/></g>
      <circle cx="72" cy="60" r="4" fill="#F9D100" stroke="#0D0D0D" stroke-width="1.5"/>
      <circle cx="101" cy="77" r="4" fill="#F9D100" stroke="#0D0D0D" stroke-width="1.5"/>
      <circle cx="130" cy="94" r="4" fill="#F9D100" stroke="#0D0D0D" stroke-width="1.5"/>
      <circle cx="101" cy="77" r="8" fill="none" stroke="#EE3A5A" stroke-width="2"/>
      <circle cx="101" cy="77" r="3" fill="#EE3A5A"/>
    </svg></span>
    <span class="ux-obj ux-obj--switcher"><svg viewBox="0 0 230 152" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="218" height="140" fill="#0D0D0D" rx="3"/>
      <rect x="2" y="2" width="218" height="140" fill="#F7F7F4" stroke="#0D0D0D" stroke-width="2" rx="3"/>
      <g><rect x="14" y="13" width="190" height="34" fill="white" stroke="#0D0D0D" stroke-width="1.5" rx="17"/><circle cx="31" cy="30" r="9" fill="#F9D100" stroke="#0D0D0D" stroke-width="1.5"/><rect x="47" y="24" width="72" height="7" fill="rgba(13,13,13,.2)" rx="3"/><rect x="47" y="34" width="48" height="6" fill="rgba(13,13,13,.1)" rx="2"/></g>
      <g><rect x="14" y="55" width="190" height="38" fill="white" stroke="#0D0D0D" stroke-width="1.5" rx="3"/><rect x="24" y="64" width="28" height="20" fill="#F9D100" stroke="#0D0D0D" stroke-width="1.5" rx="2"/><rect x="60" y="64" width="80" height="7" fill="rgba(13,13,13,.2)" rx="2"/><rect x="60" y="75" width="55" height="6" fill="rgba(13,13,13,.1)" rx="2"/></g>
      <g><rect x="14" y="101" width="190" height="34" fill="white" stroke="#0D0D0D" stroke-width="1.5" rx="2"/><rect x="24" y="109" width="5" height="18" fill="#0D0D0D" rx="1"/><rect x="36" y="109" width="90" height="7" fill="rgba(13,13,13,.2)" rx="2"/><rect x="36" y="120" width="60" height="6" fill="rgba(13,13,13,.1)" rx="2"/><circle cx="195" cy="118" r="6" fill="rgba(69,182,73,.38)" stroke="#0D0D0D" stroke-width="1.5"/></g>
      <rect class="ux-sw-sel" x="10" y="9" width="198" height="42" fill="none" stroke="#F9D100" stroke-width="3" rx="19"/>
      <circle class="ux-sw-dot" cx="212" cy="30" r="5" fill="#EE3A5A" stroke="#0D0D0D" stroke-width="1.5"/>
    </svg></span>
    <span class="ux-obj ux-obj--ripple"><svg viewBox="0 0 180 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="126" height="112" fill="#0D0D0D" rx="3"/>
      <rect x="2" y="2" width="126" height="112" fill="#F7F7F4" stroke="#0D0D0D" stroke-width="2" rx="3"/>
      <circle class="ux-rp-ra" cx="65" cy="58" r="10" fill="none" stroke="#F9D100" stroke-width="2.5"/>
      <circle class="ux-rp-rb" cx="65" cy="58" r="18" fill="none" stroke="#F9D100" stroke-width="1.5" stroke-dasharray="4 3"/>
      <circle class="ux-rp-press" cx="65" cy="58" r="7" fill="#EE3A5A" stroke="#0D0D0D" stroke-width="1.5"/>
      <g class="ux-rp-bla"><rect x="138" y="8" width="36" height="26" fill="#F9D100" stroke="#0D0D0D" stroke-width="2" rx="2"/><rect x="144" y="14" width="16" height="5" fill="rgba(13,13,13,.2)" rx="1"/></g>
      <g class="ux-rp-blb"><rect x="138" y="50" width="36" height="26" fill="#F7F7F4" stroke="#0D0D0D" stroke-width="2" rx="2"/><rect x="144" y="56" width="20" height="5" fill="rgba(13,13,13,.15)" rx="1"/></g>
      <g class="ux-rp-blc"><rect x="138" y="92" width="36" height="26" fill="#D8E4F5" stroke="#0D0D0D" stroke-width="2" rx="2"/><rect x="144" y="98" width="14" height="5" fill="rgba(43,94,184,.25)" rx="1"/></g>
    </svg></span>
  `;
  stage.appendChild(layer);
  const gear=layer.querySelector('.ux-dc-path-gear');
  const mbWrap=layer.querySelector('.ux-obj--magnet');
  const mbModa=mbWrap.querySelector('.ux-mb-moda');
  const mbModb=mbWrap.querySelector('.ux-mb-modb');
  const mbModc=mbWrap.querySelector('.ux-mb-modc');
  const mbGla=mbWrap.querySelector('.ux-mb-gla');
  const mbGlb=mbWrap.querySelector('.ux-mb-glb');
  const swWrap=layer.querySelector('.ux-obj--switcher');
  const swSel=swWrap.querySelector('.ux-sw-sel');
  const swDot=swWrap.querySelector('.ux-sw-dot');
  const rpWrap=layer.querySelector('.ux-obj--ripple');
  const rpRa=rpWrap.querySelector('.ux-rp-ra');
  const rpRb=rpWrap.querySelector('.ux-rp-rb');
  const rpPress=rpWrap.querySelector('.ux-rp-press');
  const rpBla=rpWrap.querySelector('.ux-rp-bla');
  const rpBlb=rpWrap.querySelector('.ux-rp-blb');
  const rpBlc=rpWrap.querySelector('.ux-rp-blc');
  const clamp01=gsap.utils.clamp(0,1);
  const range=(p,a,b)=>clamp01((p-a)/(b-a));
  const pulseAt=(p,c,w)=>Math.max(0,1-Math.abs(p-c)/w);
  const gearPts=[
    {p:.10,x:50,y:9},{p:.28,x:50,y:24},{p:.46,x:82,y:41},
    {p:.62,x:22,y:62},{p:.78,x:66,y:84},{p:.94,x:54,y:97}
  ];
  gsap.set([mbWrap,swWrap,rpWrap],{opacity:0});
  let uxW=1,uxH=1,lastUxProgress=-1;

  function clampPx(v,min,max){
    return Math.max(min,Math.min(max,v));
  }
  function stageItem(selector){
    return stage.querySelector(selector);
  }
  function gapCenter(prev,next,fallbackPct){
    const fallback=uxH*fallbackPct;
    if(!prev || !next) return fallback;
    const prevBottom=prev.offsetTop+prev.offsetHeight;
    const nextTop=next.offsetTop;
    const gap=nextTop-prevBottom;
    if(gap<24) return fallback;
    return prevBottom+gap*.5;
  }
  function gapTop(prev,next,objH,fallbackPct){
    return clampPx(gapCenter(prev,next,fallbackPct)-objH*.5,0,Math.max(0,uxH-objH));
  }
  function setMobileBuildPositions(){
    if(!IS_MOBILE) return;
    const copyMain=stageItem('.vid-copy-main');
    const hookB=stageItem('.vid-hook-b');
    const copyRight=stageItem('.vid-copy-right');
    const hookC=stageItem('.vid-hook-c');
    const copyLeft=stageItem('.vid-copy-left');
    const hookD=stageItem('.vid-hook-d');
    const mbW=mbWrap.offsetWidth||108;
    const mbH=mbWrap.offsetHeight||80;
    const swW=swWrap.offsetWidth||116;
    const swH=swWrap.offsetHeight||77;
    const rpW=rpWrap.offsetWidth||96;
    const rpH=rpWrap.offsetHeight||70;

    mbWrap.style.left=`${clampPx(18,8,Math.max(8,uxW-mbW-8))}px`;
    mbWrap.style.right='auto';
    mbWrap.style.top=`${gapTop(copyMain,hookB,mbH,.39)}px`;

    swWrap.style.left=`${clampPx(uxW-swW-22,8,Math.max(8,uxW-swW-8))}px`;
    swWrap.style.right='auto';
    swWrap.style.top=`${gapTop(copyRight,hookC,swH,.61)}px`;

    rpWrap.style.left=`${clampPx(20,8,Math.max(8,uxW-rpW-8))}px`;
    rpWrap.style.right='auto';
    rpWrap.style.top=`${gapTop(copyLeft,hookD,rpH,.80)}px`;
  }
  function measureUx(){
    uxW=layer.clientWidth||stage.clientWidth||1;
    uxH=layer.clientHeight||stage.clientHeight||1;
    setMobileBuildPositions();
  }
  measureUx();
  // Pixel arc lengths recomputed on resize so gear rotation ties to actual pixel
  // distance — makes the gear physically roll rather than spin uniformly with progress.
  const pixelSegLens=[];
  let pixelTotalLen=0;
  const GEAR_CIRC=2*Math.PI*32; // 64px CSS width → r=32 → circ≈201px
  function recomputeGearPx(){
    pixelSegLens.length=0; pixelTotalLen=0;
    for(let i=1;i<gearPts.length;i++){
      const dx=(gearPts[i].x-gearPts[i-1].x)/100*uxW;
      const dy=(gearPts[i].y-gearPts[i-1].y)/100*uxH;
      const len=Math.hypot(dx,dy);
      pixelSegLens.push(len); pixelTotalLen+=len;
    }
  }
  recomputeGearPx();
  let mainTrigger=null;
  function measureAndRecompute(){
    measureUx();
    recomputeGearPx();
    // After dimensions change, force a re-render at the trigger's current progress
    // so gear/chips reposition with the new pixel values (otherwise they stay where
    // they were last drawn — which can be off-screen if layout hadn't settled at init).
    if(mainTrigger) updateDesignerCoderObjects(mainTrigger.progress, true);
  }
  ScrollTrigger.addEventListener('refreshInit',measureAndRecompute);
  window.addEventListener('resize',measureAndRecompute,{passive:true});
  function pointOnPath(p){
    for(let i=1;i<gearPts.length;i++){
      if(p<=gearPts[i].p){
        const a=gearPts[i-1],b=gearPts[i],t=range(p,a.p,b.p);
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      }
    }
    return gearPts[gearPts.length-1];
  }
  function gearPixelArc(p){
    let acc=0;
    for(let i=1;i<gearPts.length;i++){
      if(p<=gearPts[i].p){
        const t=range(p,gearPts[i-1].p,gearPts[i].p);
        return acc+t*pixelSegLens[i-1];
      }
      acc+=pixelSegLens[i-1];
    }
    return pixelTotalLen;
  }
  // Per-sub-tile last-applied values — gates writes when a chip's local progress
  // hasn't moved meaningfully (no behavior change, just elides redundant SVG attr writes)
  let lastMg=-1,lastSw=-1,lastRp=-1;
  let _gX=null,_gY=null,_gR=null,_gS=null;
  const SUB_EPS = 0.0008;
  function updateDesignerCoderObjects(progress,force=false){
    if(!force && Math.abs(progress-lastUxProgress)<0.0003) return;
    lastUxProgress=progress;
    const pt=pointOnPath(progress);
    // Direct style write with quantized cache — no GSAP overhead per frame.
    // Pixel arc rolling: gear turns exactly as far as it travels in pixels.
    const gx=+((pt.x/100)*uxW).toFixed(1);
    const gy=+((pt.y/100)*uxH).toFixed(1);
    const rolling=+(gearPixelArc(progress)/GEAR_CIRC*360).toFixed(1);
    const gsPulse=1+pulseAt(progress,.46,.08)*.18+pulseAt(progress,.62,.08)*.14+pulseAt(progress,.78,.08)*.16;
    const gs=+gsPulse.toFixed(3);
    if(gear && (force || gx!==_gX || gy!==_gY || rolling!==_gR || gs!==_gS)){
      _gX=gx; _gY=gy; _gR=rolling; _gS=gs;
      gear.style.transform=`translate3d(${gx}px,${gy}px,0) rotate(${rolling}deg) scale(${gs})`;
    }

    /* magnet board — 0.12 → 0.48 */
    const mg=range(progress,.12,.48);
    if(force || Math.abs(mg-lastMg)>SUB_EPS){
      lastMg=mg;
      mbWrap.style.opacity=+mg.toFixed(3);
      mbWrap.style.transform=`translate3d(${+((1-mg)*-32).toFixed(1)}px,${+((1-mg)*18).toFixed(1)}px,0)`;
      mbModa.style.transform=`translate3d(${+((1-mg)*-44).toFixed(1)}px,${+((1-mg)*-20).toFixed(1)}px,0) rotate(${+((1-mg)*-8).toFixed(2)}deg)`;
      mbModb.style.transform=`translate3d(${+((1-mg)*-26).toFixed(1)}px,${+((1-mg)*34).toFixed(1)}px,0) rotate(${+((1-mg)*-5).toFixed(2)}deg)`;
      mbModc.style.transform=`translate3d(${+((1-mg)*42).toFixed(1)}px,${+((1-mg)*-28).toFixed(1)}px,0) rotate(${+((1-mg)*8).toFixed(2)}deg)`;
      // SVG geometry mutation forces per-frame re-rasterization (expensive on mobile GPUs).
      // Skip the subtle glare-line shift on mobile — the markup defaults already sit at the
      // revealed state, so the magnet still looks right; only the micro-detail is dropped.
      if(!IS_MOBILE){
        mbGla.setAttribute('x1',+(16+(1-mg)*-20).toFixed(1));
        mbGla.setAttribute('y1',+(55+(1-mg)*8).toFixed(1));
        mbGlb.setAttribute('x2',+(149+(1-mg)*22).toFixed(1));
        mbGlb.setAttribute('y2',+(76+(1-mg)*-10).toFixed(1));
      }
    }

    /* component switcher — 0.28 → 0.70 */
    const sw=range(progress,.28,.70);
    if(force || Math.abs(sw-lastSw)>SUB_EPS){
      lastSw=sw;
      swWrap.style.opacity=+sw.toFixed(3);
      swWrap.style.transform=`translate3d(${+((1-sw)*28).toFixed(1)}px,${+((1-sw)*-16).toFixed(1)}px,0)`;
      let sY,sH,sRx;
      if(sw<.45){sY=9;sH=42;sRx=19;}
      else if(sw<.78){const t=(sw-.45)/.33;sY=9+t*42;sH=42-t*4;sRx=19-t*16;}
      else{sY=51;sH=38;sRx=3;}
      swSel.style.transform=`translateY(${+(sY-9).toFixed(1)}px)`;
      // Skip the rect height/rx morph on mobile — same per-frame SVG raster cost. The
      // selection still slides (cheap transform); it just keeps its default size/corners.
      if(!IS_MOBILE){
        swSel.setAttribute('height',+sH.toFixed(1));
        swSel.setAttribute('rx',+sRx.toFixed(1));
      }
      swDot.style.transform=`translateY(${+((sY+sH*.5)-30).toFixed(2)}px)`;
    }

    /* ripple pad — 0.55 → 0.95 */
    const rp=range(progress,.55,.95);
    if(force || Math.abs(rp-lastRp)>SUB_EPS){
      lastRp=rp;
      rpWrap.style.opacity=+rp.toFixed(3);
      rpWrap.style.transform=`translate3d(0,${+((1-rp)*24).toFixed(1)}px,0)`;
      rpRa.style.transform=`scale(${+(1+rp*2).toFixed(3)})`;
      rpRb.style.transform=`scale(${+(1+rp*1.667).toFixed(3)})`;
      rpPress.style.transform=`scale(${+(1+pulseAt(progress,.72,.09)*.5).toFixed(3)})`;
      rpBla.style.transform=`translate3d(${+(rp*12).toFixed(1)}px,${+(-rp*10).toFixed(1)}px,0)`;
      rpBlb.style.transform=`translate3d(${+(rp*12).toFixed(1)}px,${+(rp*6).toFixed(1)}px,0)`;
      rpBlc.style.transform=`translate3d(${+(rp*12).toFixed(1)}px,${+(rp*16).toFixed(1)}px,0)`;
    }
  }
  updateDesignerCoderObjects(0,true);

  // Direct scroll-driven update — no lerp, no trailing. ScrollTrigger.onUpdate fires
  // inside GSAP's ticker so the gear's style write lands in the same frame as scroll.
  // Combined with layer-promoted gear children (will-change in CSS), the rotation is
  // a pure GPU composite op — no rasterization of clip-path/border/shadow per frame.
  mainTrigger=ScrollTrigger.create({
    trigger:stage,start:'top 82%',end:'bottom 18%',
    onUpdate:self=>updateDesignerCoderObjects(self.progress),
    onLeave:()=>updateDesignerCoderObjects(1,true),
    onLeaveBack:()=>{ lastUxProgress=-1; updateDesignerCoderObjects(0,true); }
  });
  // Explicit initial sync — refreshInit during ScrollTrigger.create fires BEFORE
  // mainTrigger gets the assignment above, so the first refresh skipped the re-render.
  measureUx(); recomputeGearPx();
  updateDesignerCoderObjects(mainTrigger.progress, true);
})();

/* ============================================================
   SERVICES — reveal + auto-cycle highlight (section-scoped)
   ============================================================ */
(function(){
  gsap.utils.toArray('.svc-row').forEach((r,i)=>{
    gsap.from(r,{opacity:0,x:-45,duration:.75,delay:i*.08,ease:'power3.out',
      scrollTrigger:{trigger:r,start:'top 88%',toggleActions:'play none none reverse'}});
  });
  const rows=[...document.querySelectorAll('.svc-row')];
  if(!rows.length) return;
  let active=0, svcTimer=null;
  const setActive=()=>{rows.forEach((r,i)=>r.classList.toggle('is-auto',i===active));active=(active+1)%rows.length;};
  const start=()=>{if(svcTimer) return;setActive();svcTimer=setInterval(setActive,1800);};
  const stop=()=>{clearInterval(svcTimer);svcTimer=null;rows.forEach(r=>r.classList.remove('is-auto'));};
  ScrollTrigger.create({trigger:'#services-section',start:'top bottom',end:'bottom top',
    onEnter:start,onEnterBack:start,onLeave:stop,onLeaveBack:stop});
})();

/* ============================================================
   EXPERIENCE — progress line scrub
   ============================================================ */
(function(){
  ['exp-group-1','exp-group-2'].forEach((gid,gi)=>{
    const group=document.getElementById(gid);
    const line=document.getElementById(`exp-line-${gi+1}`);
    if(!group||!line) return;
    gsap.set(line,{height:'0%'});
    gsap.to(line,{height:'100%',ease:'none',
      scrollTrigger:{trigger:group,start:'top 80%',end:'bottom 40%',scrub:.5}});
  });
})();

(function(){
  const cols=document.querySelector('.exp-cols');
  const left=document.querySelector('.exp-sticky-copy');
  const foot=document.querySelector('.exp-footnote');
  if(!cols || !left || !foot || IS_MOBILE) return;

  left.classList.add('is-gsap-pin-ready');
  const pinTop=()=>Math.max(112,Math.min(148,Math.round(window.innerHeight*0.16)));
  const endOffset=()=>pinTop()+left.offsetHeight+36;
  ScrollTrigger.create({
    trigger:cols,
    start:()=>`top ${pinTop()}`,
    endTrigger:foot,
    end:()=>`top ${endOffset()}`,
    pin:left,
    pinSpacing:false,
    anticipatePin:1,
    invalidateOnRefresh:true
  });
})();

/* ============================================================
   ABOUT — bio reveal with reverse, meta + photo
   ============================================================ */
gsap.utils.toArray('.about-bio-block p').forEach((p,i)=>{
  gsap.to(p,{clipPath:'inset(0 0% 0 0)',opacity:1,duration:1,delay:i*.12,ease:'power3.out',
    scrollTrigger:{trigger:'.about-bio-block',start:'top 88%',toggleActions:'play none none reverse'}});
});
gsap.fromTo('.about-meta-card',{opacity:0,x:45},{opacity:1,x:0,duration:.9,ease:'power3.out',
  scrollTrigger:{trigger:'.about-meta-card',start:'top 88%',toggleActions:'play none none reverse'}});
// once:true (no reverse) + clearProps so the pinned wrapper is transform-clean when GSAP
// pins it — a leftover inline transform from the scale reveal is what flickered at pin engage.
gsap.fromTo('.about-photo-wrap',{opacity:0,scale:.94},{opacity:1,scale:1,duration:.9,ease:'power3.out',
  scrollTrigger:{trigger:'.about-photo-wrap',start:'top 88%',once:true},
  onComplete:()=>gsap.set('.about-photo-wrap',{clearProps:'transform'})});

(function(){
  const flow=document.querySelector('.about-skills-flow');
  const photo=document.querySelector('.about-photo-wrap');
  const skills=document.getElementById('skills-section');
  if(!flow || !photo || !skills || IS_MOBILE) return;

  photo.classList.add('is-gsap-pin-ready');
  const pinTop=()=>Math.round(window.innerHeight * 0.18);
  ScrollTrigger.create({
    trigger:photo,
    start:()=>`top ${pinTop()}`,
    endTrigger:skills,
    end:()=>`top ${pinTop()}`,
    pin:photo,
    pinSpacing:false,
    anticipatePin:1,
    invalidateOnRefresh:true
  });
})();

(function(){
  const flow=document.querySelector('.about-skills-flow');
  const photo=document.querySelector('.about-photo-wrap');
  const skills=document.getElementById('skills-section');
  const svg=document.getElementById('about-dock-divider');
  const path=document.getElementById('about-dock-path');
  if(!flow || !photo || !skills || !svg || !path || IS_MOBILE) return;

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  let raf=0;

  function buildDockPath(){
    raf=0;
    const flowRect=flow.getBoundingClientRect();
    const photoRect=photo.getBoundingClientRect();
    const skillsRect=skills.getBoundingClientRect();
    const width=Math.max(flow.scrollWidth,Math.round(flowRect.width));
    const height=Math.max(flow.scrollHeight,Math.round(skills.offsetTop+skills.offsetHeight));
    const seamY=skillsRect.top-flowRect.top;            // divider sits at the Skills seam (constant)
    const photoBottom=photoRect.bottom-flowRect.top;    // photo bottom in flow coords (grows while pinned)
    const m=28;                                          // breathing space (also clears the +10 red shadow)
    const r=20;                                          // corner radius
    const xL=clamp((photoRect.left-flowRect.left)-m,30,width-180);
    const xR=clamp((photoRect.right-flowRect.left)+m,xL+150,width-(r+4));
    const dipY=photoBottom+m;                            // pocket floor sits below the photo (with margin)
    const f=n=>n.toFixed(1);

    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.setAttribute('width',width);
    svg.setAttribute('height',height);

    // Straight until the photo's bottom dips past the seam; then a rounded pocket wraps
    // DOWN around the photo (down the left side, under the bottom, up the right) with an
    // even margin — the photo sits docked in a clean cut-out. The pocket deepens as the
    // pinned photo descends, so it hugs more of the photo's sides until Skills releases it.
    if(dipY <= seamY + r){
      path.setAttribute('d',`M0 ${f(seamY)} H${width}`); // straight divider
    } else {
      path.setAttribute('d',[
        `M0 ${f(seamY)}`,
        `H${f(xL-r)}`,
        `Q${f(xL)} ${f(seamY)} ${f(xL)} ${f(seamY+r)}`,
        `V${f(dipY-r)}`,
        `Q${f(xL)} ${f(dipY)} ${f(xL+r)} ${f(dipY)}`,
        `H${f(xR-r)}`,
        `Q${f(xR)} ${f(dipY)} ${f(xR)} ${f(dipY-r)}`,
        `V${f(seamY+r)}`,
        `Q${f(xR)} ${f(seamY)} ${f(xR+r)} ${f(seamY)}`,
        `H${width}`
      ].join(' '));
    }
  }

  function requestDockPath(){
    if(raf) return;
    raf=requestAnimationFrame(buildDockPath);
  }

  buildDockPath();
  window.addEventListener('resize',requestDockPath);
  // Only rebuild the dock path on scroll while the about→skills region is near the viewport.
  // Previously this ran 3× getBoundingClientRect + an SVG path rebuild on EVERY scroll frame
  // across the whole page (desktop). Off-region scrolls now cost one cheap rect read and bail.
  window.addEventListener('scroll',()=>{
    const r=flow.getBoundingClientRect();
    if(r.bottom > -300 && r.top < (window.innerHeight||0)+300) requestDockPath();
  },{passive:true});
  if(window.ResizeObserver){
    const ro=new ResizeObserver(requestDockPath);
    ro.observe(flow);
    ro.observe(photo);
    ro.observe(skills);
  }
  ScrollTrigger.addEventListener('refresh',requestDockPath);
  setTimeout(requestDockPath,80);
  setTimeout(requestDockPath,320);
})();

/* ============================================================
   SKILLS TITLE — char reveal + colour shift, once
   ============================================================ */
(function(){
  const title=document.getElementById('skills-title');
  if(!title) return;
  const parts=Array.from(title.childNodes);
  title.innerHTML='';
  parts.forEach(node=>{
    if(node.nodeType===3){
      node.textContent.split('').forEach(ch=>{
        if(ch===' '){const s=document.createElement('span');s.className='char is-space';s.innerHTML='&nbsp;';title.appendChild(s);}
        else{const s=document.createElement('span');s.className='char';s.textContent=ch;title.appendChild(s);}
      });
    } else if(node.nodeName==='BR'){
      title.appendChild(document.createElement('br'));
    } else {
      title.appendChild(node.cloneNode(true));
    }
  });

  const chars=title.querySelectorAll('.char');
  ScrollTrigger.create({
    trigger:title,start:'top 92%',once:true,
    onEnter:()=>{
      gsap.to(chars,{opacity:1,y:0,duration:.55,stagger:.035,ease:'back.out(1.6)'});
      gsap.to(chars,{color:'var(--red)',duration:.4,stagger:.035,delay:.2,ease:'power2.out',
        onComplete:()=>{gsap.to(chars,{color:'var(--black)',duration:.5,stagger:.02,ease:'power2.out'});}
      });
    }
  });
})();

/* ============================================================
   SKILL TAGS — stagger
   ============================================================ */
gsap.utils.toArray('.skill-tag').forEach((tag,i)=>{
  gsap.from(tag,{opacity:0,y:18,duration:.45,delay:(i%12)*.025,ease:'power2.out',
    scrollTrigger:{trigger:tag,start:'top 92%',toggleActions:'play none none reverse'}});
});

/* ============================================================
   CONTACT TITLE — 3D rotation once, shapes scrub
   ============================================================ */
(function(){
  const title=document.getElementById('cnt-title');
  if(!title) return;
  gsap.set(title,{rotationX:90,transformOrigin:'50% 100%',opacity:0,perspective:800});
  ScrollTrigger.create({
    trigger:'#contact-section',start:'top 70%',once:true,
    onEnter:()=>gsap.to(title,{rotationX:0,opacity:1,duration:1.1,ease:'power4.out'})
  });
  gsap.to('#cnt-shape-c1',{rotation:360,scrollTrigger:{trigger:'#contact-section',start:'top bottom',end:'bottom top',scrub:2}});
  gsap.to('#cnt-shape-c2',{rotation:-360,scrollTrigger:{trigger:'#contact-section',start:'top bottom',end:'bottom top',scrub:1.5}});
  gsap.to('#cnt-shape-sq',{rotation:720,scrollTrigger:{trigger:'#contact-section',start:'top bottom',end:'bottom top',scrub:2.5}});

  title.addEventListener('mouseenter',()=>{
    gsap.to(title,{skewX:2,duration:.08,yoyo:true,repeat:5,ease:'none',onComplete:()=>gsap.set(title,{skewX:0})});
    const em=title.querySelector('em');
    if(em) gsap.to(em,{color:'var(--white)',duration:.06,yoyo:true,repeat:7,ease:'none',
      onComplete:()=>gsap.set(em,{color:'var(--yellow)'})});
  });
})();

/* ============================================================
   CONTACT BULB + MAGNETIC BUTTONS
   ============================================================ */
function addRipple(btn,e){
  const r=btn.getBoundingClientRect(),size=Math.max(r.width,r.height)*2;
  const rip=document.createElement('span');rip.className='btn-ripple';
  Object.assign(rip.style,{width:size+'px',height:size+'px',
    left:(e.clientX-r.left-size/2)+'px',top:(e.clientY-r.top-size/2)+'px'});
  btn.appendChild(rip);setTimeout(()=>rip.remove(),700);
}
(function(){
  const btn=document.getElementById('cnt-email-btn');
  if(!btn) return;
  let isOn=false;
  btn.addEventListener('click',function(e){
    isOn=!isOn;
    btn.classList.toggle('bulb-on',isOn);
    addRipple(btn,e);
    setTimeout(()=>{
      window.open('https://mail.google.com/mail/?view=cm&fs=1&to=ashishram3103@gmail.com&su=Project%20Inquiry','_blank');
    },220);
    if(isOn){gsap.to('#contact-section',{backgroundColor:'rgba(249,209,0,.05)',duration:.25,yoyo:true,repeat:1,ease:'power2.inOut'});}
  });
  if(!IS_MOBILE){
    btn.addEventListener('mousemove',e=>{
      const r=btn.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.15,y=(e.clientY-r.top-r.height/2)*.15;
      gsap.to(btn,{x,y,duration:.5,ease:'power2.out'});
    });
    btn.addEventListener('mouseleave',()=>gsap.to(btn,{x:0,y:0,duration:.8,ease:'elastic.out(1,.5)'}));
  }
  const phone=document.getElementById('cnt-phone-btn');
  if(phone&&!IS_MOBILE){
    phone.addEventListener('mousemove',e=>{
      const r=phone.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*.28,y=(e.clientY-r.top-r.height/2)*.28;
      gsap.to(phone,{x,y,duration:.4,ease:'power2.out'});
    });
    phone.addEventListener('mouseleave',()=>gsap.to(phone,{x:0,y:0,duration:.7,ease:'elastic.out(1,.5)'}));
    phone.addEventListener('click',e=>addRipple(phone,e));
  }
})();

/* ============================================================
   ARCHIVE — RAF auto-scroll + drag, section-scoped
   ============================================================ */
(function(){
  const wrap = document.querySelector('.arch-flow-wrap');
  const track = document.getElementById('arch-track');
  if(!wrap || !track) return;

  track.style.animation='none';
  track.style.transform='none';

  const origCards=Array.from(track.querySelectorAll('.arch-card:not([aria-hidden])'));
  if(!track.querySelector('[aria-hidden="true"]')){
    origCards.forEach(c=>{
      const clone=c.cloneNode(true);
      clone.setAttribute('aria-hidden','true');
      track.appendChild(clone);
    });
  }

  let scrollPos=0;
  const speed=IS_MOBILE?0.5:0.8;
  let isDragging=false;
  let dragStartX=0;
  let dragStartScroll=0;
  let isPaused=false;
  let sectionActive=false;
  let resumeTimer=null;
  let raf=null;

  function halfWidth(){return track.scrollWidth/2;}
  function stopTick(){if(raf){cancelAnimationFrame(raf);raf=null;}}
  function startTick(){if(sectionActive && !isPaused && !raf) raf=requestAnimationFrame(tick);}
  function resumeAfter(ms){
    clearTimeout(resumeTimer);
    resumeTimer=setTimeout(()=>{isPaused=false;startTick();},ms);
  }

  function tick(){
    if(!sectionActive || isPaused){raf=null;return;}
    scrollPos+=speed;
    const hw=halfWidth();
    if(scrollPos>=hw){scrollPos-=hw;wrap.scrollLeft=scrollPos;}
    else{wrap.scrollLeft=scrollPos;}
    raf=requestAnimationFrame(tick);
  }

  ScrollTrigger.create({
    trigger:wrap,start:'top bottom',end:'bottom top',
    onEnter:()=>{sectionActive=true;startTick();},
    onEnterBack:()=>{sectionActive=true;startTick();},
    onLeave:()=>{sectionActive=false;stopTick();},
    onLeaveBack:()=>{sectionActive=false;stopTick();}
  });

  if(!IS_MOBILE){
    wrap.style.cursor='grab';
    wrap.addEventListener('mousedown',e=>{
      isDragging=true;isPaused=true;
      dragStartX=e.clientX;dragStartScroll=wrap.scrollLeft;
      wrap.style.cursor='grabbing';
      clearTimeout(resumeTimer);
      e.preventDefault();
    });
    window.addEventListener('mousemove',e=>{
      if(!isDragging) return;
      const dx=dragStartX-e.clientX;
      wrap.scrollLeft=dragStartScroll+dx;
      scrollPos=wrap.scrollLeft;
    });
    window.addEventListener('mouseup',()=>{
      if(!isDragging) return;
      isDragging=false;
      wrap.style.cursor='grab';
      resumeAfter(1200);
    });
    wrap.addEventListener('mouseenter',()=>{if(!isDragging){isPaused=true;clearTimeout(resumeTimer);}});
    wrap.addEventListener('mouseleave',()=>{if(!isDragging){resumeAfter(400);}});
  }

  if(IS_MOBILE){
    wrap.addEventListener('touchstart',e=>{
      const t=e.changedTouches[0];
      isDragging=true;isPaused=true;
      dragStartX=t.clientX;dragStartScroll=wrap.scrollLeft;
      clearTimeout(resumeTimer);
    },{passive:true});
    wrap.addEventListener('touchmove',e=>{
      if(!isDragging) return;
      const t=e.changedTouches[0];
      wrap.scrollLeft=dragStartScroll+(dragStartX-t.clientX);
      scrollPos=wrap.scrollLeft;
    },{passive:true});
    wrap.addEventListener('touchend',()=>{
      isDragging=false;
      resumeAfter(1200);
    },{passive:true});
  }
})();

/* ============================================================
   BURGER MENU
   ============================================================ */
(function(){
  const btn=document.getElementById('burger-btn');
  const menu=document.getElementById('mobile-menu');
  const closeBtn=document.getElementById('mobile-menu-close');
  const links=menu?menu.querySelectorAll('.mm-link'):[];
  if(!btn||!menu) return;
  let isOpen=false;
  function openMenu(){
    isOpen=true;btn.classList.add('is-open');menu.classList.add('is-open');
    menu.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    gsap.to(links,{opacity:1,y:0,duration:.5,stagger:.07,delay:.25,ease:'power3.out'});
  }
  function closeMenu(){
    isOpen=false;btn.classList.remove('is-open');menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden','true');document.body.style.overflow='';
    gsap.set(links,{opacity:0,y:30});
  }
  btn.addEventListener('click',()=>isOpen?closeMenu():openMenu());
  if(closeBtn) closeBtn.addEventListener('click',closeMenu);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen) closeMenu();});
  links.forEach(l=>{
    l.addEventListener('click',()=>{
      if(l.id==='mm-project'){closeMenu();openPanel();}
      else closeMenu();
    });
  });
  gsap.set(links,{opacity:0,y:30});
})();

/* ============================================================
   PROJECT PANEL
   ============================================================ */
function openPanel(){
  const panel=document.getElementById('proj-panel');
  const backdrop=document.getElementById('panel-backdrop');
  if(!panel) return;
  panel.classList.add('is-open');
  backdrop.classList.add('is-vis');
  document.body.style.overflow='hidden';
  gsap.fromTo('.proj-panel-inner',{y:40,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'});
}
function closePanel(){
  const panel=document.getElementById('proj-panel');
  const backdrop=document.getElementById('panel-backdrop');
  if(!panel) return;
  panel.classList.remove('is-open');
  backdrop.classList.remove('is-vis');
  document.body.style.overflow='';
  resetPanel();
}
function resetPanel(){
  const steps=[document.getElementById('step-1'),document.getElementById('step-2'),document.getElementById('step-3')];
  steps.forEach((s,i)=>{if(s)s.classList.toggle('is-active',i===0);});
  const title=document.getElementById('panel-title');
  if(title) title.textContent='What are you building?';
  document.querySelectorAll('.panel-opt').forEach(b=>b.classList.remove('is-sel'));
}
(function initPanel(){
  const trigger=document.getElementById('panel-trigger');
  const closeBtn=document.getElementById('panel-close');
  const backdrop=document.getElementById('panel-backdrop');
  if(trigger) trigger.addEventListener('click',openPanel);
  const badge=document.getElementById('currently-badge');
  if(badge) badge.addEventListener('click',openPanel);
  if(closeBtn) closeBtn.addEventListener('click',closePanel);
  if(backdrop) backdrop.addEventListener('click',closePanel);

  const steps={1:document.getElementById('step-1'),2:document.getElementById('step-2'),3:document.getElementById('step-3')};
  const title=document.getElementById('panel-title');
  const titles=['What are you building?','When do you need it?','Let\'s make it happen.'];
  let cur=1;
  let sel={type:'',timeline:''};

  function goTo(n){
    if(steps[cur]) steps[cur].classList.remove('is-active');
    cur=n;
    if(steps[cur]) steps[cur].classList.add('is-active');
    if(title) title.textContent=titles[n-1];
    gsap.fromTo(steps[cur],{opacity:0,y:20},{opacity:1,y:0,duration:.35,ease:'power2.out'});
  }

  document.querySelectorAll('.panel-opt').forEach(btn=>{
    btn.addEventListener('click',function(){
      const siblings=this.closest('.panel-options').querySelectorAll('.panel-opt');
      siblings.forEach(s=>s.classList.remove('is-sel'));
      this.classList.add('is-sel');
      if(cur===1){
        sel.type=this.dataset.val;
        setTimeout(()=>goTo(2),320);
      } else if(cur===2){
        sel.timeline=this.dataset.val;
        const emailBtn=document.getElementById('panel-email');
        if(emailBtn){
          const subject=`Project Inquiry — ${sel.type}`;
          const body=`Hi Ashish,%0A%0AI'm interested in ${sel.type}. Timeline: ${sel.timeline}.%0A%0A`;
          emailBtn.href=`https://mail.google.com/mail/?view=cm&fs=1&to=ashishram3103@gmail.com&su=${encodeURIComponent(subject)}&body=${body}`;
        }
        setTimeout(()=>goTo(3),320);
      }
    });
  });

  const s2back=document.getElementById('step2-back');
  const s3back=document.getElementById('step3-back');
  if(s2back) s2back.addEventListener('click',()=>goTo(1));
  if(s3back) s3back.addEventListener('click',()=>goTo(2));
})();

/* ============================================================
   EASTER EGG — TYPE "ASHISH"
   ============================================================ */
(function(){
  const TARGET='ASHISH';
  let typed='';
  let timer;
  const overlay=document.getElementById('egg-overlay');
  const closeBtn=document.getElementById('egg-close');
  const eggText=document.getElementById('egg-text');
  if(!overlay) return;

  document.addEventListener('keydown',e=>{
    if(overlay.classList.contains('is-active')){
      if(e.key==='Escape') closeEgg();
      return;
    }
    if(e.key.length===1&&/[a-zA-Z]/.test(e.key)){
      typed+=(e.key).toUpperCase();
      clearTimeout(timer);
      timer=setTimeout(()=>typed='',1800);
      if(typed.includes(TARGET)){typed='';triggerEgg();}
    }
  });

  if(closeBtn) closeBtn.addEventListener('click',closeEgg);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeEgg();});

  function triggerEgg(){
    overlay.classList.add('is-active');
    document.body.style.overflow='hidden';
    gsap.to(eggText,{scale:1,duration:1,ease:'back.out(1.4)',delay:.1});
    gsap.to('.egg-sub',{opacity:1,y:0,duration:.7,ease:'power3.out',delay:.5});
    const colors=['#F9D100','#EE3A5A','#45B649','#2B5EB8'];
    for(let i=0;i<28;i++){
      const p=document.createElement('div');
      p.className='egg-particle';
      const size=Math.random()*22+8;
      Object.assign(p.style,{
        width:size+'px',height:size+'px',
        background:colors[Math.floor(Math.random()*colors.length)],
        left:Math.random()*100+'%',top:Math.random()*100+'%',
        opacity:'0'
      });
      overlay.appendChild(p);
      gsap.fromTo(p,
        {scale:0,opacity:1,x:0,y:0},
        {scale:Math.random()*3+1,opacity:0,
         x:(Math.random()-0.5)*400,y:(Math.random()-0.5)*400,
         duration:Math.random()*1.4+0.8,ease:'power2.out',onComplete:()=>p.remove()}
      );
    }
  }
  function closeEgg(){
    gsap.to([eggText,'.egg-sub'],{scale:0,opacity:0,duration:.4,ease:'power2.in',
      onComplete:()=>{
        overlay.classList.remove('is-active');
        document.body.style.overflow='';
        gsap.set(eggText,{scale:0});
        gsap.set('.egg-sub',{opacity:0,y:20});
      }
    });
  }
})();

/* ============================================================
   HERO SVG — cursor-to-code scroll draw
   ============================================================ */
(function(){
  if(IS_MOBILE) return;
  const dashLine=document.getElementById('svg-dash-line');
  const codeL=document.getElementById('svg-code-l');
  const codeSlash=document.getElementById('svg-code-slash');
  const codeR=document.getElementById('svg-code-r');
  const labelDesign=document.getElementById('svg-label-design');
  const labelDev=document.getElementById('svg-label-dev');
  const clickDot=document.getElementById('svg-click-dot');

  if(clickDot){
    gsap.to(clickDot,{scale:1.8,opacity:0,duration:1,ease:'power2.out',repeat:-1,transformOrigin:'center'});
  }
  if(labelDesign){
    gsap.fromTo(labelDesign,{opacity:0},{opacity:1,duration:.8,delay:1.6,ease:'power2.out'});
  }

  function sLen(el,fb){try{return el.getTotalLength();}catch(e){return fb;}}

  const scrollEls=[
    {el:dashLine,len:sLen(dashLine,180)},
    {el:codeL,len:sLen(codeL,55)},
    {el:codeSlash,len:sLen(codeSlash,62)},
    {el:codeR,len:sLen(codeR,55)},
  ];
  scrollEls.forEach(({el,len})=>{
    if(!el) return;
    el.style.strokeDasharray=len;el.style.strokeDashoffset=len;
  });
  if(labelDev) labelDev.setAttribute('opacity','0');

  const tl=gsap.timeline({
    scrollTrigger:{trigger:'#hero-section',start:'top top',end:'36% top',scrub:0.55}
  });
  tl.to(dashLine,{strokeDashoffset:0,ease:'none'},0)
    .to(codeL,{strokeDashoffset:0,ease:'none'},0.4)
    .to(codeSlash,{strokeDashoffset:0,ease:'none'},0.55)
    .to(codeR,{strokeDashoffset:0,ease:'none'},0.65)
    .to([labelDev],{attr:{opacity:1},ease:'none'},0.8);

  const termWrap=document.getElementById('hero-icon-terminal');
  const termBox=document.getElementById('term-box');
  const termBar=document.getElementById('term-bar');
  const termArrow=document.getElementById('term-arrow');
  const termCursor=document.getElementById('term-cursor');
  if(termWrap){
    [termBox,termBar,termArrow,termCursor].forEach(el=>{
      if(!el) return;
      const l=sLen(el,120);el.style.strokeDasharray=l;el.style.strokeDashoffset=l;
    });
    gsap.timeline({
      scrollTrigger:{trigger:'#hero-section',start:'top top',end:'18% top',scrub:0.4,
        onEnter:()=>gsap.set(termWrap,{opacity:1})}
    })
    .to(termBox,{strokeDashoffset:0,ease:'none'},0)
    .to(termBar,{strokeDashoffset:0,ease:'none'},0.2)
    .to(termArrow,{strokeDashoffset:0,ease:'none'},0.45)
    .to(termCursor,{strokeDashoffset:0,ease:'none'},0.6)
    .to(termCursor,{opacity:0,duration:0.1,repeat:-1,yoyo:true,ease:'none'},0.7);
  }
})();

/* ============================================================
   STUDIO RECEIPT — rows reveal
   ============================================================ */
(function(){
  const receipt=document.getElementById('studio-receipt');
  if(!receipt) return;
  const rows=receipt.querySelectorAll('.receipt-row');
  gsap.set(rows,{opacity:0,y:12});
  ScrollTrigger.create({
    trigger:receipt,start:'top 86%',
    onEnter:()=>gsap.to(rows,{opacity:1,y:0,stagger:.16,duration:.55,ease:'expo.out',overwrite:'auto'}),
    onEnterBack:()=>gsap.to(rows,{opacity:1,y:0,stagger:.1,duration:.4,ease:'expo.out',overwrite:'auto'})
  });
})();

/* ============================================================
   HERO FAKE-3D BUILD LAB — idle demo + mouse parallax + scroll payoff
   ============================================================ */
(function(){
  if(IS_MOBILE) return;   // mobile uses the dedicated #hero-buildm element instead
  const lab=document.getElementById('hero-build-lab');
  const obj=document.getElementById('hero-website-object');
  if(!lab || !obj) return;
  const layers=lab.querySelectorAll('.hero-site-layer');
  const bp=lab.querySelectorAll('.hero-bp-line,.hero-bp-node,.hero-bp-tag');
  let idleTimer=null;
  gsap.set(bp,{opacity:.42});
  gsap.set(layers,{willChange:'transform'});

  function idleDemo(){
    gsap.to(bp,{opacity:1,stagger:.035,duration:.45,ease:'power2.out'});
    gsap.to(layers[0],{x:-6,y:-8,z:34,rotationX:1,rotationY:-2,duration:.65,ease:'expo.out'});
    gsap.to(layers[1],{x:20,y:18,z:-10,rotationZ:-2,duration:.65,ease:'expo.out'});
    gsap.to(layers[2],{x:42,y:38,z:-60,rotationZ:2,duration:.65,ease:'expo.out'});
    setTimeout(()=>{
      if(!lab.matches(':hover')){
        gsap.to(layers,{x:0,y:0,z:0,rotationX:0,rotationY:0,rotationZ:0,duration:.9,ease:'elastic.out(1,.55)'});
        gsap.to(bp,{opacity:.42,duration:.6,ease:'power2.out'});
      }
    },1300);
  }
  function armIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(idleDemo,2400);}
  armIdle();

  // Mouse parallax is desktop-only; on touch the lab runs the idle-demo loop + scroll payoff.
  if(!IS_MOBILE){
    let labRect=lab.getBoundingClientRect();
    window.addEventListener('resize',()=>{labRect=lab.getBoundingClientRect();},{passive:true});
    lab.addEventListener('mousemove',e=>{
      clearTimeout(idleTimer);
      const px=(e.clientX-labRect.left)/labRect.width-.5;
      const py=(e.clientY-labRect.top)/labRect.height-.5;
      gsap.to(obj,{rotationY:px*18,rotationX:-py*14,x:px*14,y:py*10,duration:.35,ease:'power3.out',overwrite:'auto'});
      gsap.to(bp,{x:px*20,y:py*16,opacity:.9,duration:.45,ease:'power3.out',overwrite:'auto'});
    });
    lab.addEventListener('mouseleave',()=>{
      gsap.to(obj,{rotationY:0,rotationX:0,x:0,y:0,duration:.75,ease:'elastic.out(1,.55)',overwrite:'auto'});
      gsap.to(bp,{x:0,y:0,opacity:.42,duration:.65,ease:'expo.out',overwrite:'auto'});
      armIdle();
    });
  }

  gsap.timeline({
    scrollTrigger:{trigger:'#hero-section',start:'top top',end:'38% top',scrub:.6}
  })
  .to(layers[0],{x:-10,y:-12,z:42,rotationY:-4,ease:'none'},0)
  .to(layers[1],{x:28,y:22,z:-12,rotationZ:-3,ease:'none'},0)
  .to(layers[2],{x:58,y:46,z:-70,rotationZ:3,ease:'none'},0)
  .to(bp,{opacity:1,ease:'none'},0)
  .to('.hero-lab-instruction',{opacity:.2,x:16,ease:'none'},.15);
})();

/* ============================================================
   HERO MOBILE BUILD ELEMENT (#hero-buildm) — scroll-scrubbed
   A brutalist 3-layer deck fans apart in 3D while the front browser window assembles
   itself (dots → content lines wipe → media fills → </>), tied to scroll. Mobile only;
   the desktop build-lab above is untouched.
   ============================================================ */
(function(){
  if(!IS_MOBILE) return;
  const el=document.getElementById('hero-buildm');
  if(!el || !window.gsap || !window.ScrollTrigger) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // CSS shows static assembled state

  const back=el.querySelector('.hbm-back');
  const mid=el.querySelector('.hbm-mid');
  const front=el.querySelector('.hbm-front');
  const dots=el.querySelectorAll('.hbm-bar span');
  const lines=el.querySelectorAll('.hbm-line');
  const media=el.querySelector('.hbm-media');
  const code=el.querySelector('.hbm-code');
  const tags=el.querySelectorAll('.hbm-tag,.hbm-tag-front');
  const cap=el.querySelector('.hbm-cap');

  // Initial state (matches CSS): deck stacked flush, window empty.
  gsap.set([back,mid],{x:0,y:0,z:0,rotationY:0});
  gsap.set(front,{z:0,rotationX:0});

  const tl=gsap.timeline({
    scrollTrigger:{trigger:'#hero-section',start:'top top',end:'46% top',scrub:0.5}
  });

  // 1) Deck fans apart in 3D + front lifts/tilts toward the viewer.
  tl.to(back,{x:30,y:34,z:-66,rotationY:6,ease:'none'},0)
    .to(mid,{x:16,y:18,z:-32,rotationY:4,ease:'none'},0)
    .to(front,{z:36,rotationX:7,ease:'none'},0)
    .to(tags,{opacity:0.75,ease:'none',stagger:0.04},0.05)
    // 2) Window assembles top-to-bottom along the same scroll beat.
    .to(dots,{scale:1,ease:'back.out(2)',stagger:0.05},0.12)
    .to(lines,{scaleX:1,ease:'none',stagger:0.12},0.22)
    .to(media,{scale:1,opacity:1,ease:'none'},0.66)
    .to(code,{scale:1,opacity:1,ease:'back.out(2)'},0.8)
    // 3) Caption fades as the build completes.
    .to(cap,{opacity:0.25,ease:'none'},0.85);
})();

/* ============================================================
   REVEAL SLAB — extrude × liquid × spotlight (IO-gated; idle off-screen)
   Desktop: pointer aims the light + 3D tilt; idle >2.5s → gentle auto-orbit.
   Touch:   auto-orbit + sway by default; touch aims the light, gyro tilts if available.
   Scroll:  --fill via ScrollTrigger scrub (drains on scroll-up).
   Reduced-motion / no-gsap: bailed early — CSS shows the static assembled state.
   ============================================================ */
(function(){
  const slab=document.getElementById('reveal-slab');
  const stage=document.getElementById('rs-stage');
  if(!slab || !stage) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(document.body.classList.contains('no-gsap')) return;

  const isTouch = window.matchMedia('(hover:none)').matches
    || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // Current + target values, lerped each frame for smooth motion.
  let mx=50,my=42,tmx=50,tmy=42;     // spotlight centre (%)
  let ex=0,ey=0,tex=0,tey=0;         // tilt / extrusion vector [-1..1]
  let lastPointer=-99999;            // ms of last pointer/touch activity
  let gyroActive=false;
  let visible=false, raf=null, t=0;

  // Liquid fill: a rippling wave path (#rs-liquid-wave) clips the gold .rs-fill text.
  // curFill (0..1) is the level set by scroll; fillW/H are cached so the per-frame wave
  // rebuild does no layout reads (re-measured on resize / on becoming visible).
  const fillEl=slab.querySelector('.rs-fill');
  const wavePath=document.getElementById('rs-liquid-wave');
  let curFill=0, fillW=0, fillH=0;

  const lerp=(a,b,n)=>a+(b-a)*n;
  const clamp=(v,lo,hi)=>v<lo?lo:(v>hi?hi:v);

  function setVars(){
    slab.style.setProperty('--mx', mx.toFixed(2)+'%');
    slab.style.setProperty('--my', my.toFixed(2)+'%');
    slab.style.setProperty('--ex', ex.toFixed(3));
    slab.style.setProperty('--ey', ey.toFixed(3));
  }

  function measureFill(){ if(fillEl){ fillW=fillEl.offsetWidth; fillH=fillEl.offsetHeight; } }
  function updateLiquid(){
    if(!wavePath || !fillW || !fillH) return;
    const surface=(1-curFill)*fillH;
    const amp=Math.min(9, fillH*0.035) * ((curFill>0 && curFill<1) ? 1 : 0.5);
    const k=2*Math.PI/(fillW*0.6), N=10;
    let d='M0 '+(surface+Math.sin(t*2)*amp).toFixed(1);
    for(let i=1;i<=N;i++){
      const x=fillW*i/N;
      d+=' L'+x.toFixed(1)+' '+(surface+Math.sin(k*x+t*2)*amp).toFixed(1);
    }
    d+=' L'+fillW+' '+fillH+' L0 '+fillH+' Z';
    wavePath.setAttribute('d', d);
  }
  window.addEventListener('resize', measureFill, {passive:true});

  if(!isTouch){
    slab.addEventListener('pointermove', e=>{
      if(!visible) return;
      const r=slab.getBoundingClientRect();
      if(!r.width||!r.height) return;
      const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
      tmx=clamp(px*100,0,100); tmy=clamp(py*100,0,100);
      tex=clamp((px-0.5)*2,-1,1); tey=clamp((py-0.5)*2,-1,1);
      lastPointer=performance.now();
    }, {passive:true});
  } else {
    slab.addEventListener('touchmove', e=>{
      const tch=e.touches&&e.touches[0]; if(!tch||!visible) return;
      const r=slab.getBoundingClientRect();
      if(!r.width||!r.height) return;
      tmx=clamp((tch.clientX-r.left)/r.width*100,0,100);
      tmy=clamp((tch.clientY-r.top)/r.height*100,0,100);
      lastPointer=performance.now();
    }, {passive:true});
    // Gyroscope tilt where exposed (no permission prompt forced; auto-sway covers it if absent).
    if(window.DeviceOrientationEvent){
      window.addEventListener('deviceorientation', e=>{
        if(e.gamma==null || e.beta==null) return;
        gyroActive=true;
        if(!visible) return;
        tex=clamp(e.gamma/30,-1,1);
        tey=clamp((e.beta-45)/30,-1,1);
      }, {passive:true});
    }
  }

  function frame(){
    if(!visible){ raf=null; return; }
    t+=0.016;
    const idle = performance.now()-lastPointer > 2500;
    if(idle){
      // Wide Lissajous orbit so the light sweeps the whole field; livelier sway for the tilt.
      tmx=50+Math.sin(t*0.9)*40;
      tmy=50+Math.cos(t*1.2)*32;
      if(!gyroActive){
        tex=Math.sin(t*0.8)*(isTouch?0.6:0.5);
        tey=Math.cos(t*0.6)*(isTouch?0.5:0.4);
      }
    }
    mx=lerp(mx,tmx,0.08); my=lerp(my,tmy,0.08);
    ex=lerp(ex,tex,0.07); ey=lerp(ey,tey,0.07);
    setVars();
    updateLiquid();   // rippling liquid surface (uses cached size + curFill)
    raf=requestAnimationFrame(frame);
  }

  // Tactile press + light ripple — user research showed people try to click/tap this,
  // so reward it. Pure transform on the stage (springs back via CSS) + one ripple element.
  function press(on){ stage.style.transform = on ? 'scale(0.95)' : 'scale(1)'; }
  function ripple(x,y){
    const r=slab.getBoundingClientRect();
    const d=document.createElement('span');
    d.className='rs-ripple';
    d.style.left=(x-r.left)+'px';
    d.style.top=(y-r.top)+'px';
    slab.appendChild(d);
    d.addEventListener('animationend',()=>d.remove(),{once:true});
  }
  slab.addEventListener('pointerdown', e=>{ press(true); ripple(e.clientX,e.clientY); }, {passive:true});
  window.addEventListener('pointerup', ()=>press(false), {passive:true});

  // Fill level — monotonic with viewport position: rises as the band scrolls up into view,
  // full by the time its top is ~25% down, clamped so it HOLDS full when scrolled past and
  // only DRAINS on reverse scroll (no centre back-and-forth). vh-relative = responsive.
  if(window.ScrollTrigger){
    ScrollTrigger.create({
      trigger:slab, start:'top bottom', end:'bottom top',
      onUpdate:()=>{
        const r=slab.getBoundingClientRect(), vh=window.innerHeight||1;
        // fill=0 when slab enters bottom of viewport; fill=1 when slab centre reaches viewport centre
        const centreOffset=vh/2 - (r.top + r.height/2);
        curFill=clamp((centreOffset + r.height/2) / r.height, 0, 1);
      }
    });
  }

  // IO master switch — the rAF only runs while the band is on screen.
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(en=>{
        visible=en.isIntersecting;
        if(visible && !raf){ measureFill(); updateLiquid(); raf=requestAnimationFrame(frame); }
        else if(!visible && raf){ cancelAnimationFrame(raf); raf=null; }
      });
    }, {threshold:0});
    io.observe(slab);
  } else {
    visible=true; measureFill(); raf=requestAnimationFrame(frame);
  }
})();

/* ============================================================
   TESTIMONIAL — 3D GLASS CAROUSEL
   One frosted card front, the rest fanned behind in 3D depth. Auto-advances,
   pauses on hover/touch, dots to jump. Circular offset = seamless loop.
   ============================================================ */
(function(){
  const carousel=document.getElementById('testi-carousel');
  const dotsWrap=document.getElementById('testi-dots');
  if(!carousel) return;
  const cards=Array.from(carousel.querySelectorAll('.testi-card-container'));
  const N=cards.length;
  if(N < 2) return;

  const AUTOPLAY_MS=4000;             // time each card stays front (tunable)
  const RESUME_AFTER_IDLE_MS=4000;    // after manual interaction, wait then resume
  const isMobile=()=>window.matchMedia('(max-width:599px)').matches;
  const MAX_VISIBILITY=()=>isMobile()?1:2; // how many cards each side stay visible
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let active=0, inView=false, paused=false, timer=null, resumeTimer=null;

  // Mobile-only: hold the auto-loop until the Experience→Testimonials sweeping arc has
  // landed on card 1 (the connector fires 'proof-handoff-done'). On desktop the connector
  // is a separate scroll effect and autoplay should start on-view as it always has, so the
  // gate is OPEN by default there. Fallbacks ensure mobile never gets stuck.
  const arcGateActive=window.matchMedia('(max-width:700px)').matches
    && !reduceMotion && !document.body.classList.contains('no-gsap');
  let handoffReady = !arcGateActive || carousel.dataset.handoffReady==='1';
  if(arcGateActive && !handoffReady){
    carousel.addEventListener('proof-handoff-done',()=>{ handoffReady=true; startAuto(); }, {once:true});
    setTimeout(()=>{ if(!handoffReady){ handoffReady=true; startAuto(); } }, 9000);
  }

  // Build dots
  const dots=[];
  if(dotsWrap){
    for(let i=0;i<N;i++){
      const d=document.createElement('button');
      d.className='testi-dot'+(i===0?' is-active':'');
      d.type='button';
      d.setAttribute('role','tab');
      d.setAttribute('aria-label','Testimonial '+(i+1)+' of '+N);
      d.addEventListener('click',()=>{ setActive(i); bumpPause(); });
      dotsWrap.appendChild(d);
      dots.push(d);
    }
  }

  function update(){
    const max=MAX_VISIBILITY();
    cards.forEach((card,i)=>{
      // Circular shortest-path offset so 6→0 rotates forward, not all the way back.
      let raw=i-active;
      if(raw> N/2) raw-=N;
      else if(raw< -N/2) raw+=N;
      const abs=Math.abs(raw);
      card.style.setProperty('--offset', raw);
      card.style.setProperty('--abs-offset', abs);
      card.style.setProperty('--direction', Math.sign(raw));
      card.style.opacity = abs>max ? '0' : '1';
      card.style.display = abs>max ? 'none' : 'block';
      card.style.pointerEvents = raw===0 ? 'auto' : 'none';
      card.style.zIndex = String(N - abs);
      if(raw===0) card.setAttribute('data-active','');
      else card.removeAttribute('data-active');
    });
    dots.forEach((d,i)=>d.classList.toggle('is-active', i===active));
  }

  function setActive(i){ active=((i%N)+N)%N; update(); }
  function next(){ setActive(active+1); }

  function startAuto(){
    if(reduceMotion || paused || !inView || timer || !handoffReady) return;
    timer=setInterval(()=>{ if(!paused && inView) next(); }, AUTOPLAY_MS);
  }
  function stopAuto(){ if(timer){ clearInterval(timer); timer=null; } }

  function bumpPause(){
    // Manual interaction: pause, then resume after idle.
    paused=true; stopAuto();
    if(resumeTimer) clearTimeout(resumeTimer);
    resumeTimer=setTimeout(()=>{ paused=false; startAuto(); }, RESUME_AFTER_IDLE_MS);
  }

  // Manual arrows
  const prevBtn=document.querySelector('.testi-prev');
  const nextBtn=document.querySelector('.testi-next');
  if(prevBtn) prevBtn.addEventListener('click',()=>{ setActive(active-1); bumpPause(); });
  if(nextBtn) nextBtn.addEventListener('click',()=>{ setActive(active+1); bumpPause(); });

  // Pointer devices: pause while hovering so users can read (arrows/dots still work).
  carousel.addEventListener('mouseenter',()=>{ paused=true; stopAuto(); });
  carousel.addEventListener('mouseleave',()=>{ paused=false; startAuto(); });

  // Touch devices (no arrows): swipe left/right to move between cards; auto-rotate continues.
  let swipeX=null, swipeY=null, swiping=false;
  carousel.addEventListener('touchstart',e=>{
    const t=e.changedTouches[0];
    swipeX=t.clientX; swipeY=t.clientY; swiping=true;
    paused=true; stopAuto();                       // hold auto while the finger is down
  }, {passive:true});
  carousel.addEventListener('touchend',e=>{
    if(!swiping) return;
    swiping=false;
    const t=e.changedTouches[0];
    const dx=t.clientX-swipeX, dy=t.clientY-swipeY;
    // Horizontal swipe past threshold (and not a vertical scroll) → change card.
    if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)){
      setActive(active + (dx>0 ? 1 : -1));          // swipe right → next, left → prev
    }
    bumpPause();                                    // brief pause, then auto-rotate resumes
  }, {passive:true});

  // In-view gating via IntersectionObserver — fires immediately with the current
  // state, so autoplay starts even when the section is already visible on load
  // (the previous ScrollTrigger onEnter only fired on a fresh crossing → stuck).
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        inView=e.isIntersecting;
        if(inView) startAuto(); else stopAuto();
        // Pause the heavy conic-gradient glow sweep while testimonials are off-screen so
        // it stops repainting in the background (it was a constant cost the whole time you
        // were past it). Resumes seamlessly on re-entry. Zero visual change.
        carousel.classList.toggle('sweep-paused', !inView);
      });
    }, {threshold:0.25});
    io.observe(carousel);
  } else {
    inView=true; startAuto();
  }

  window.addEventListener('resize',()=>{ update(); }, {passive:true});
  update();
})();

/* ============================================================
   EXPERIENCE TO TESTIMONIALS CONNECTOR
   One restrained SVG path lives in the shared proof-flow wrapper, so the route
   measures cleanly across both sections instead of bleeding backward from one.
   ============================================================ */
(function(){
  const flow=document.querySelector('.proof-flow');
  const exp=document.getElementById('exp-section');
  const testi=document.getElementById('testimonials-section');
  const svg=document.getElementById('proof-connector');
  const path=document.getElementById('proof-connector-path');
  const cometPath=document.getElementById('proof-connector-comet');
  const tipPath=document.getElementById('proof-connector-tip');
  const l1=document.getElementById('exp-line-1');
  const l2=document.getElementById('exp-line-2');
  if(!flow || !exp || !testi || !svg || !path || !l1 || !l2 || !window.gsap || !window.ScrollTrigger) return;
  const handoffCard=testi.querySelector('.testi-card-container');

  let ctrl=null;
  let resizeRaf=null;
  let isCometRoute=false;          // true while the ≤700px comet route is active
  const COMET_LEN=48, TIP_LEN=14;  // bright head + white-hot tip lengths (px)
  const f=n=>Number.isFinite(n) ? n.toFixed(1) : '0.0';
  const clamp01=n=>Math.max(0,Math.min(1,n));
  // Mobile: skip applyDraw when progress hasn't moved enough to produce a visible change.
  // Comet head moves ~len px per unit; at typical path lengths (400–600px) a 0.004 step
  // = 1.6–2.4px movement — sub-pixel, invisible. Halves style-write frequency on mobile.
  const DRAW_EPS = IS_MOBILE ? 0.004 : 0;
  let lastDrawProgress = -1;

  function applyDraw(progress){
    if(DRAW_EPS && Math.abs(progress - lastDrawProgress) < DRAW_EPS && progress > 0 && progress < 0.999) return;
    lastDrawProgress = progress;
    const len=parseFloat(path.dataset.len)||0;
    const draw=clamp01(progress/0.92);
    const handoff=clamp01((progress-0.88)/0.12);
    if(len) path.style.strokeDashoffset=(len*(1-draw)).toFixed(1);
    if(isCometRoute){
      const landedNow=handoff>=0.999;
      // Faint track follows behind; a short bright head + white tip ride the draw front.
      // The comet stays FULLY bright + sharp right up to the card edge, then hard-cuts the
      // instant the card ring takes over — a clean baton-pass at one point, not a cross-fade,
      // so it reads as ONE comet passing from the path into the ring.
      path.style.opacity=landedNow ? '0' : '0.18';
      if(len){
        const head=clamp01(progress/0.97)*len;         // comet head distance (reaches the very end)
        const vis=landedNow ? '0' : '1';
        cometPath.style.strokeDasharray=`${COMET_LEN} ${len}`;
        cometPath.style.strokeDashoffset=(COMET_LEN-head).toFixed(1);
        cometPath.style.opacity=vis;
        tipPath.style.strokeDasharray=`${TIP_LEN} ${len}`;
        tipPath.style.strokeDashoffset=(TIP_LEN-head).toFixed(1);
        tipPath.style.opacity=vis;
      }
    } else {
      path.style.opacity=(0.95*(1-handoff)).toFixed(3);
    }
    flow.style.setProperty('--proof-card-arc', handoff.toFixed(3));
    flow.classList.toggle('is-proof-handoff', handoff>0);
    const landed=handoff>=0.999;
    if(isCometRoute){
      // Mobile: NO in-flight card ring during the comet's approach — only the SVG comet shows
      // (mobile-arc-pending keeps the ring hidden). At the landing instant the comet hard-cuts
      // and the card's from-top ring takes over at the same point → one comet, not two.
      if(handoffCard) handoffCard.classList.remove('is-connector-handoff');
      flow.classList.toggle('mobile-arc-pending', !landed);
      flow.classList.toggle('mobile-arc-landed', landed);
    } else {
      if(handoffCard) handoffCard.classList.toggle('is-connector-handoff', handoff>0);
    }
    // Mobile-only: signal the carousel once the sweeping arc has fully landed on card 1
    // so its auto-loop can begin (held until then). Desktop autoplay is unaffected.
    if(landed){
      const car=document.getElementById('testi-carousel');
      if(car && !car.dataset.handoffReady){
        car.dataset.handoffReady='1';
        car.dispatchEvent(new CustomEvent('proof-handoff-done'));
      }
    }
  }

  function cornerPath(x,y,mergeY,cX,endY){
    const dir=cX>=x ? 1 : -1;
    const dx=Math.abs(cX-x);
    const dy=Math.abs(mergeY-y);
    const r=Math.max(0,Math.min(12,dx/2,dy/2));
    if(r < 1){
      return `M ${f(x)} ${f(y)} V ${f(mergeY)} H ${f(cX)} V ${f(endY)}`;
    }
    return `M ${f(x)} ${f(y)} V ${f(mergeY-r)} `+
      `Q ${f(x)} ${f(mergeY)} ${f(x+dir*r)} ${f(mergeY)} `+
      `H ${f(cX-dir*r)} Q ${f(cX)} ${f(mergeY)} ${f(cX)} ${f(mergeY+r)} `+
      `V ${f(endY)}`;
  }

  function joinPath(x,y,mergeY,cX){
    const dir=cX>=x ? 1 : -1;
    const dx=Math.abs(cX-x);
    const dy=Math.abs(mergeY-y);
    const r=Math.max(0,Math.min(12,dx/2,dy/2));
    if(r < 1){
      return `M ${f(x)} ${f(y)} V ${f(mergeY)} H ${f(cX)}`;
    }
    return `M ${f(x)} ${f(y)} V ${f(mergeY-r)} `+
      `Q ${f(x)} ${f(mergeY)} ${f(x+dir*r)} ${f(mergeY)} H ${f(cX)}`;
  }

  function build(){
    const fr=flow.getBoundingClientRect();
    const stage=testi.querySelector('.testi-stage') || testi.querySelector('.testi-carousel');
    const card=testi.querySelector('.testi-carousel') || stage;
    const foot=exp.querySelector('.exp-footnote');
    if(!fr.width || !fr.height || !stage || !card) return;

    const cardRect=card.getBoundingClientRect();
    const footRect=foot ? foot.getBoundingClientRect() : null;
    const g1=l1.parentElement.getBoundingClientRect();
    const g2=l2.parentElement.getBoundingClientRect();
    const r1=l1.getBoundingClientRect();
    const r2=l2.getBoundingClientRect();
    const w=Math.max(1,Math.round(fr.width));
    const h=Math.max(1,Math.round(fr.height));

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.height=h+'px';

    // ── MOBILE (≤700px): a comet sweep (faint track + bright glowing head + white tip,
    //    mirroring the card's .testi-glow ring) runs from the Experience line, DOWN THE
    //    RIGHT LINING of the title (never crossing the heading text), then curves into the
    //    first card's top edge and cross-fades into that card's own ring. Desktop route below
    //    is unchanged.
    if(window.matchMedia('(max-width:700px)').matches){
      isCometRoute=true;
      const title=testi.querySelector('.testi-board-head h2');
      const tRect=title ? title.getBoundingClientRect() : null;
      const lineX=(r1.left-fr.left)+r1.width/2;        // Experience line origin (left side on mobile)
      const lineY=g1.bottom-fr.top;
      const tTop=tRect ? (tRect.top-fr.top) : lineY+60;
      const cTop=(cardRect.top-fr.top)-2;
      const cX=(cardRect.left-fr.left)+cardRect.width/2;
      // Right lining: just past the title's right edge, clamped inside the section.
      const rightX=Math.min(tRect ? (tRect.right-fr.left)+6 : w-14, w-12);
      const turnY=Math.max(lineY+24, tTop-26);         // cross above the title, never through it
      // Stay on the right margin past the title AND the lede/body copy; only curve into the
      // card near its top so the route never crosses any text.
      const curveY=Math.max(turnY+40, cTop-64);
      const r=10;
      const dirX=rightX>=lineX ? 1 : -1;

      // line down → rounded turn across the empty band ABOVE the title → straight down the
      // right lining (past the title + copy) → smooth curve into the first card's top-centre.
      const d=
        `M ${f(lineX)} ${f(lineY)} V ${f(turnY-r)} `+
        `Q ${f(lineX)} ${f(turnY)} ${f(lineX+dirX*r)} ${f(turnY)} `+
        `H ${f(rightX-dirX*r)} `+
        `Q ${f(rightX)} ${f(turnY)} ${f(rightX)} ${f(turnY+r)} `+
        `V ${f(curveY)} `+
        `C ${f(rightX)} ${f((curveY+cTop)/2)} ${f(cX)} ${f((curveY+cTop)/2)} ${f(cX)} ${f(cTop)}`;
      path.setAttribute('d',d);
      cometPath.setAttribute('d',d);
      tipPath.setAttribute('d',d);

      let mlen=0;
      try{ const m=path.getTotalLength(); if(m>1) mlen=m; }catch(e){}
      path.dataset.len=mlen;
      path.style.strokeDasharray=mlen?mlen:'none';
      path.style.opacity='0.18';                       // faint track; the comet head is the bright part
      flow.classList.add('mobile-arc-pending');        // suppress card sweep until arc lands
      if(ctrl) applyDraw(ctrl.progress);
      return;
    }

    // Desktop route: ensure the mobile comet overlay + pending flag are cleared.
    isCometRoute=false;
    cometPath.setAttribute('d','');
    tipPath.setAttribute('d','');
    path.style.opacity='';
    flow.classList.remove('mobile-arc-pending','mobile-arc-landed');

    const xL=(r1.left-fr.left)+r1.width/2;
    const xR=(r2.left-fr.left)+r2.width/2;
    const yL=g1.bottom-fr.top;
    const yR=g2.bottom-fr.top;
    const footBottom=footRect ? footRect.bottom-fr.top : Math.max(yL,yR);
    const mergeY=Math.max(yL,yR,footBottom+36);
    const cX=(cardRect.left-fr.left)+cardRect.width/2;
    const endY=Math.max(mergeY+90,(cardRect.top-fr.top)-4);
    const isStacked=window.matchMedia('(max-width:900px)').matches || Math.abs(xL-xR)<40;

    const d=isStacked
      ? cornerPath(xR,yR,mergeY,cX,endY)
      : `${cornerPath(xL,yL,mergeY,cX,endY)} ${joinPath(xR,yR,mergeY,cX)}`;

    path.setAttribute('d',d);

    let len=0;
    try{
      const measured=path.getTotalLength();
      if(measured>1) len=measured;
    }catch(e){}
    path.dataset.len=len;
    path.style.strokeDasharray=len?len:'none';
    if(ctrl) applyDraw(ctrl.progress);
  }

  function queueBuild(){
    if(resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf=requestAnimationFrame(()=>{
      resizeRaf=null;
      build();
      if(ctrl) applyDraw(ctrl.progress);
    });
  }

  function init(){
    build();
    const stage=testi.querySelector('.testi-stage') || testi;
    ctrl=ScrollTrigger.create({
      trigger:exp,
      start:'bottom 96%',
      endTrigger:stage,
      end:'top 44%',
      invalidateOnRefresh:true,
      onUpdate:self=>applyDraw(self.progress),
      onRefresh:self=>{ build(); applyDraw(self.progress); }
    });
    applyDraw(ctrl.progress);
  }

  window.addEventListener('resize',queueBuild,{passive:true});
  requestAnimationFrame(()=>setTimeout(init,80));
})();

/* ============================================================
   CAPABILITY SECTION — GSAP ScrollTrigger pin
   One card visible at a time. Cards crossfade on scroll steps.
   No z-axis, no perspective conflicts, works everywhere.
   ============================================================ */
(function(){
  const section = document.getElementById('capability-section');
  const pinWrap = document.getElementById('cap-pin-wrap');
  if(!section || !pinWrap) return;

  // Full pinned 3D world runs at virtually all widths (user wants max parity on
  // mobile). Only flatten on very tiny/old screens (<360px) as a safety fallback.
  const isMobile = window.matchMedia('(max-width:359px)').matches;
  // Touch devices: scroll velocity is jerky, so velocity-driven effects (tilt, fov,
  // star-stretch) flicker. Detect touch to neutralize them (depth is unaffected).
  const isTouch = window.matchMedia('(hover:none)').matches
    || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const cards = Array.from(section.querySelectorAll('.cap-card'));
  const N = cards.length;
  if(!N) return;

  /* GSAP will set initial state via applyDepth(0,0) */
  cards.forEach((c,i)=>{ if(i===0) c.classList.add('is-active'); });

  const stage = section.querySelector('.cap-cards-stage');
  const prog  = document.getElementById('cap-prog');
  const bar   = document.getElementById('cap-bar');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const Z_GAP = 1200;
  let sectionVisible = false; // gates all demo RAF work when section is off-screen
  const startDemoLoops = [];
  const stopDemoLoops = [];
  const scrollDemoUpdaters = [];

  function startCapabilityDemos(){startDemoLoops.forEach(fn=>fn());}
  function stopCapabilityDemos(){stopDemoLoops.forEach(fn=>fn());}
  function updateScrollDemos(cameraZ){scrollDemoUpdaters.forEach(fn=>fn(cameraZ));}

  if(isMobile){
    /* Mobile: just show all cards stacked, no pinning */
    cards.forEach(c=>{
      c.style.opacity='1';
      c.style.transform='none';
      c.classList.add('is-active');
    });
    initDemos();
    updateScrollDemos(Z_GAP);
    return;
  }

  // Touch: lock pinWrap height to a stable pixel value at load time.
  // CSS `height:100vh` recomputes live when Chrome's address bar shows/hides (adds ~56px),
  // which resizes the pin container mid-scroll → the 3D stage shifts → visible flicker.
  // Inline pixel value overrides the CSS 100vh and never changes during scroll.
  if(isTouch){
    pinWrap.style.height = window.innerHeight + 'px';
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { pinWrap.style.height = window.innerHeight + 'px'; }, 350);
    }, { passive: true });
  }

  /* Desktop: ~1.15VH per card — gives each card a brief dwell window via easeHold.
     Use screen.height on touch so address-bar show/hide (which changes window.innerHeight
     but not screen.height) doesn't trigger a section reheight → pin recalc → flicker. */
  function setSectionHeight(){
    const h = isTouch ? screen.height : window.innerHeight;
    section.style.height = Math.round(N * h * 1.15) + 'px';
  }
  setSectionHeight();
  // On touch: only re-measure on real orientation change, not address-bar-triggered resize.
  // On desktop: keep refreshInit so pin recalculates correctly on browser resize.
  if(isTouch){
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { setSectionHeight(); ScrollTrigger.refresh(); }, 350);
    }, { passive: true });
  } else {
    ScrollTrigger.addEventListener('refreshInit', setSectionHeight);
  }

  /* GSAP pin the inner wrap. pinType:'fixed' = compositor-driven, no JS lag. */
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    pin: pinWrap,
    pinSpacing: false,
    anticipatePin: 1,
    pinType: 'fixed',
    invalidateOnRefresh: !isTouch,
  });

  /* ── Reference-faithful camera world ──
     Two-element architecture (mirrors hyper-scroll-brutal-preview.html):
       stage (.cap-cards-stage) → perspective:Xpx only, NEVER transformed
       world (.cap-world)       → transform-style:preserve-3d + rotateX/Y
     Items live in world and use translate3d(x,y,z).
     This is the only correct way: applying perspective and rotateX to the SAME
     element causes perspective to evaluate in the rotated local frame → world flip. */
  // Desktop offsets cards 10% right of center to leave room for the big words flying
  // in from the left. On touch/narrow screens there's no such room — centre the cards.
  const FOCUS_X     = isTouch ? 0 : Math.round(window.innerWidth * 0.10);
  const TOTAL_DEPTH = (N - 1) * Z_GAP;
  const items       = [];

  // Create world container — perspective stays on stage, transforms go here
  const world = document.createElement('div');
  world.className = 'cap-world';
  stage.appendChild(world);

  // Wrap each card in a world-item (mirrors reference .item wrapping .card)
  cards.forEach((card, i) => {
    const item = document.createElement('div');
    item.className = 'cap-world-item';
    world.appendChild(item);
    item.appendChild(card);
    items.push({ el:item, type:'card', card, x:FOCUS_X, y:0, baseZ:-i * Z_GAP });
  });

  // Big outline words — sit at mid-point between each pair of cards.
  // They fly toward the camera during transitions, giving the "text in face" feeling.
  const BIG_TEXTS = [
    { text:'BUILD',  rot:-2 },
    { text:'MOTION', rot: 2 },
    { text:'DEPTH',  rot:-1 }
  ];
  BIG_TEXTS.forEach((b, i) => {
    if(i >= N - 1) return;
    const el = document.createElement('div');
    el.className = 'cap-world-text';
    el.textContent = b.text;
    world.appendChild(el);
    items.push({
      el, type:'text',
      slot:i,
      x:(i % 2 ? -60 : 60), y:0,
      rot:b.rot,
      baseZ:-(i + 0.5) * Z_GAP
    });
  });

  // Stars — kept intentionally light; too many 3D layers cost frames during scroll.
  const STAR_COUNT = isTouch ? 6 : (window.innerWidth > 1280 ? 36 : 20);
  for(let i = 0; i < STAR_COUNT; i++){
    const s = document.createElement('span');
    s.className = 'cap-star';
    world.appendChild(s);
    items.push({
      el:s, type:'star',
      x:(Math.random() - 0.5) * 2600,
      y:(Math.random() - 0.5) * 1600,
      baseZ:-Math.random() * (TOTAL_DEPTH + Z_GAP * 1.5)
    });
  }

  // Section-local pointer state
  const mouse = { x:0, y:0, tx:0, ty:0 };
  let smoothVel      = 0;
  let targetProgress = 0;
  let smoothProgress = 0;
  let lastVel        = 0;
  let animRaf        = null;
  let activeCard     = cards[0] || null;
  let lastPct        = -1;
  let lastFov        = 1000;
  // Touch: render synchronously at the exact scroll progress (like the gear's onUpdate)
  // — NO lerp, NO separate RAF. The lerp+RAF desyncs from the compositor-driven fixed
  // pin every frame, which is the vibration. Desktop keeps the lerp loop for butter+tilt.
  function startWorldLoop(){
    if(isTouch){ render(targetProgress, 0); return; }
    if(sectionVisible && !animRaf) animRaf=requestAnimationFrame(animLoop);
  }

  let pinRect = pinWrap.getBoundingClientRect();
  ScrollTrigger.addEventListener('refresh',()=>{ pinRect = pinWrap.getBoundingClientRect(); });
  pinWrap.addEventListener('mousemove', e=>{
    mouse.tx = (e.clientX - pinRect.left) / pinRect.width  * 2 - 1;
    mouse.ty = (e.clientY - pinRect.top)  / pinRect.height * 2 - 1;
    startWorldLoop();
  }, { passive:true });
  pinWrap.addEventListener('mouseleave', ()=>{ mouse.tx = 0; mouse.ty = 0; startWorldLoop(); });

  // Unified RAF: lerps scroll progress (Lenis-style butter) + mouse tilt
  function animLoop(){
    // Mouse tilt — desktop only; touch has no pointer so rx/ry are always 0.
    // Skip the style write entirely on touch to avoid per-frame composite invalidation.
    if(!isTouch){
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      const velTilt = smoothVel * 5;
      const rx = clamp(mouse.y * -5 - velTilt, -8, 8);
      const ry = clamp(mouse.x *  5,           -8, 8);
      world.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
    // Lerp scroll progress — matches Lenis lerp:0.1 feel
    smoothProgress += (targetProgress - smoothProgress) * 0.1;
    render(smoothProgress, lastVel);
    if(Math.abs(targetProgress-smoothProgress) < 0.0005 &&
       Math.abs(mouse.tx-mouse.x) < 0.001 &&
       Math.abs(mouse.ty-mouse.y) < 0.001 &&
       Math.abs(smoothVel) < 0.001){
      animRaf = null;
      return;
    }
    animRaf = requestAnimationFrame(animLoop);
  }

  // Soft-dwell camera: at each card center the camera slows down but never freezes,
  // letting the user actually feel each focal card before sliding onward.
  // HOLD = portion of each segment spent in the slow "dwell" zone.
  // DWELL_SLOPE = how much the camera still moves during dwell (0 = frozen, 1 = linear).
  const HOLD = 0.22, DWELL_SLOPE = 0.18;
  const _holdEdge = HOLD * DWELL_SLOPE; // value at end of leading dwell / start of trailing dwell mirror
  const FIRST_AWAKE_END_Z = 520;
  const FIRST_CARD_HOLD_Z = 820;
  const FIRST_CARD_EXIT_Z = 1000;
  const FIRST_NEXT_REVEAL_Z = 1040;
  function easeHold(t){
    if(t <= HOLD)      return t * DWELL_SLOPE;
    if(t >= 1 - HOLD)  return 1 - (1 - t) * DWELL_SLOPE;
    const lt = (t - HOLD) / (1 - 2 * HOLD);
    const sm = lt * lt * (3 - 2 * lt);
    return _holdEdge + (1 - 2 * _holdEdge) * sm;
  }
  function cameraPos(progress){
    const segs = N - 1;
    if(!segs) return 0;
    const sp  = clamp(progress, 0, 1) * segs;
    const idx = Math.min(Math.floor(sp), segs - 1);
    return (idx + easeHold(sp - idx)) * Z_GAP;
  }

  function render(progress, velocity){
    // Normalize ScrollTrigger velocity (px/sec) to reference-style [-1, 1].
    // Touch: force 0 — jerky touch-scroll velocity otherwise pulses the perspective
    // (fov), world tilt and star-stretch every frame, which reads as flicker/vibration.
    const vNorm = isTouch ? 0 : clamp((velocity || 0) / 2500, -1, 1);
    smoothVel  += (vNorm - smoothVel) * 0.1;

    const cameraZ = cameraPos(progress);
    updateScrollDemos(cameraZ);

    // Dynamic perspective on STAGE (desktop only).
    // Touch: lock to constant 1000px — velocity-driven fov change causes visible flicker
    // on mobile GPUs. fov range on desktop [600, 1000].
    const fov   = isTouch ? 1000 : (1000 - Math.min(Math.abs(smoothVel) * 400, 400));
    const MAX_Z = fov - 300;
    if(!isTouch && Math.abs(fov - lastFov) > 1){
      lastFov = fov;
      stage.style.perspective = fov + 'px';
    }

    let bestAbs = Infinity, bestItem = null;
    const stretch = Math.max(1, Math.min(1 + Math.abs(smoothVel) * 5, 8));
    const stretchQ = (stretch * 100) | 0;

    for(let k = 0; k < items.length; k++){
      const it   = items[k];
      const relZ = it.baseZ + cameraZ;
      const safeZ = Math.min(relZ, MAX_Z);

      // Alpha per type
      let alpha;
      const firstTransitionItem =
        (it.type === 'card' && it.card !== cards[0]) || (it.type === 'text' && it.slot === 0);
      if(it.type === 'card'){
        // Tight exit: card never lingers past camera plane
        if(it.card === cards[0] && relZ >= 0){
          if(relZ > FIRST_CARD_EXIT_Z) alpha = 0;
          else if(relZ > FIRST_CARD_HOLD_Z) alpha = 1 - (relZ - FIRST_CARD_HOLD_Z) / (FIRST_CARD_EXIT_Z - FIRST_CARD_HOLD_Z);
          else alpha = 1;
        } else if(relZ >  250 || relZ < -1800) alpha = 0;
        else if(relZ < -200)            alpha = (relZ + 1800) / 1600;
        else if(relZ >   50)            alpha = 1 - (relZ - 50) / 200;
        else                            alpha = 1;
      } else if(it.type === 'text'){
        // Wide range — text appears as tiny point far back, grows, flies through
        if(relZ >  350 || relZ < -3000) alpha = 0;
        else if(relZ < -400)            alpha = (relZ + 3000) / 2600 * 0.88;
        else if(relZ >  100)            alpha = (1 - (relZ - 100) / 250) * 0.88;
        else                            alpha = 0.88;
      } else { // star
        if(relZ >  500 || relZ < -2800) alpha = 0;
        else if(relZ < -300)            alpha = (relZ + 2800) / 2500 * 0.6;
        else if(relZ >  150)            alpha = (1 - (relZ - 150) / 350) * 0.6;
        else                            alpha = 0.6;
      }
      if(firstTransitionItem){
        alpha *= clamp((cameraZ - FIRST_NEXT_REVEAL_Z) / 180, 0, 1);
      }
      if(alpha < 0) alpha = 0;

      // Quantize alpha to 2 decimals → skip identical writes (huge paint savings on stars)
      const aQ = (alpha * 100) | 0;
      if(aQ !== it._aQ){
        it._aQ = aQ;
        it.el.style.opacity = aQ === 0 ? '0' : (aQ / 100);
      }

      // Hidden — skip transform write (original behavior also skipped best-card tracking)
      if(aQ === 0) continue;

      const sz = safeZ | 0; // int-quantize z so identical adjacent values short-circuit
      let tx;
      if(it.type === 'star'){
        // Stretch quantized so it doesn't invalidate every frame from tiny velocity jitter
        if(stretchQ !== it._sQ || sz !== it._sz){
          it._sQ = stretchQ; it._sz = sz;
          tx = `translate3d(${it.x}px,${it.y}px,${sz}px) scale3d(1,1,${(stretchQ/100).toFixed(2)})`;
        }
      } else if(it.type === 'text'){
        // Yellow fill ramps as the text crosses the focal plane
        const fillAmt = clamp(1 - Math.abs(relZ + 80) / 440, 0, 1);
        const fQ = (fillAmt * 100) | 0;
        if(fQ !== it._fQ){
          it._fQ = fQ;
          const f = fQ / 100;
          it.el.style.color = `rgba(249,209,0,${(f * 0.95).toFixed(3)})`;
          it.el.style.setProperty('-webkit-text-stroke-color', `rgba(249,209,0,${(0.28 + f * 0.42).toFixed(3)})`);
          it.el.style.setProperty('--glow', (f * 0.28).toFixed(3));
        }
        if(sz !== it._sz){
          it._sz = sz;
          tx = `translate(-50%,-50%) translate3d(${it.x}px,${it.y}px,${sz}px) rotateZ(${it.rot}deg)`;
        }
      } else {
        if(sz !== it._sz){
          it._sz = sz;
          tx = `translate3d(${it.x}px,${it.y}px,${sz}px)`;
        }
        const a = Math.abs(relZ);
        if(a < bestAbs){ bestAbs = a; bestItem = it; }
      }
      if(tx) it.el.style.transform = tx;
    }

    // Active card: closest to camera — toggle is-active on the card, not the item
    if(bestItem && activeCard !== bestItem.card){
      if(activeCard) activeCard.classList.remove('is-active');
      bestItem.card.classList.add('is-active');
      activeCard = bestItem.card;
    }

    const pct = Math.round(progress * 100);
    if(pct !== lastPct){
      lastPct = pct;
      if(prog) prog.textContent = String(pct).padStart(3, '0');
      if(bar)  bar.style.transform = `scaleX(${pct/100})`;
    }
  }

  // Release the ~40 GPU layers (world + items + cards) while the section is OFF-screen so they
  // stop burdening the compositor for the rest of the page (this is the "accumulated weight" that
  // makes scrolling back up heavier than the first trip down). Restored before the scrub renders.
  // will-change toggling never affects rendered pixels — zero visual change.
  function setWorldLayers(on){
    const v = on ? '' : 'auto';   // '' = fall back to CSS will-change (promoted); 'auto' = release
    world.style.willChange = v;
    for(let i=0;i<items.length;i++) items[i].el.style.willChange = v;
    for(let i=0;i<cards.length;i++) cards[i].style.willChange = v;
  }

  function resetWorld(){
    sectionVisible = false;
    pinWrap.classList.remove('is-live');
    stopCapabilityDemos();
    cancelAnimationFrame(animRaf); animRaf = null;
    mouse.x = mouse.y = mouse.tx = mouse.ty = 0;
    smoothVel = 0;
    smoothProgress = targetProgress;
    world.style.transform   = 'rotateX(0deg) rotateY(0deg)';
    stage.style.perspective = '1000px';
    setWorldLayers(false);   // off-screen → drop the layers
  }
  function activateWorld(){
    setWorldLayers(true);    // re-promote before rendering the 3D scrub
    sectionVisible = true;
    pinWrap.classList.add('is-live');
    startWorldLoop();
    startCapabilityDemos();
  }

  const camST = ScrollTrigger.create({
    trigger: section,
    start:   'top top',
    end:     'bottom bottom',
    invalidateOnRefresh: true,
    onUpdate:    self => { targetProgress = self.progress; lastVel = self.getVelocity(); if(isTouch) smoothProgress = self.progress; startWorldLoop(); },
    onEnter:     activateWorld,
    onEnterBack: activateWorld,
    onLeave:     resetWorld,
    onLeaveBack: resetWorld,
    onRefresh:   self => {
      targetProgress = self.progress || 0;
      smoothProgress = targetProgress;
      lastVel = 0;
      render(targetProgress, 0);
      if(targetProgress > 0 && targetProgress < 1){
        activateWorld();
      }else{
        resetWorld();
      }
    },
  });

  // Init at actual scroll position — prevents wrong-card flash on mid-section refresh
  const initP = camST.progress || 0;
  targetProgress = initP;
  smoothProgress = initP;
  if(initP > 0 && initP < 1){ activateWorld(); }
  render(initP, 0);

  initDemos();
  if(sectionVisible) startCapabilityDemos();

  /* ── DEMOS ── */
  function initDemos(){

    /* Demo 1 - Website Awakens */
    (function(){
      const demo = document.getElementById('cap-awake');
      if(!demo) return;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const smooth=t=>t*t*(3-2*t);
      const phase=(p,a,b)=>smooth(clamp((p-a)/(b-a),0,1));
      let lastQ=-1;

      function setVar(name,value){demo.style.setProperty(name,value);}
      function renderAwake(cameraZ){
        const p = (reduceMotion.matches || isMobile) ? 1 : clamp(cameraZ / FIRST_AWAKE_END_Z, 0, 1);
        const q = Math.round(p * 1000);
        if(q === lastQ) return;
        lastQ = q;

        const structure = phase(p,.02,.30);
        const content   = phase(p,.18,.58);
        const light     = phase(p,.35,.82);
        const live      = phase(p,.68,1);
        const depth     = phase(p,.12,.76);
        const scan      = (0.08 + light * .34) * (1 - live * .7);

        setVar('--awake-dim',(0.78 - light * .64).toFixed(3));
        setVar('--awake-grid',(0.12 + structure * .32).toFixed(3));
        setVar('--awake-glow',(light * .72).toFixed(3));
        setVar('--awake-glow-scale',(.72 + light * .42).toFixed(3));
        setVar('--awake-y',`${(18 * (1 - structure)).toFixed(1)}px`);
        setVar('--awake-scale',(.94 + structure * .06).toFixed(3));
        setVar('--awake-blur',`${(4 * (1 - structure)).toFixed(2)}px`);
        setVar('--awake-sat',(.55 + light * .45).toFixed(3));
        setVar('--awake-shadow',`${(6 + depth * 18).toFixed(1)}px`);
        setVar('--awake-sleep-o',(1 - phase(p,.04,.34)).toFixed(3));
        setVar('--awake-sleep-scale',(1 - content * .14).toFixed(3));
        setVar('--awake-hero-o',content.toFixed(3));
        setVar('--awake-hero-y',`${(18 * (1 - content)).toFixed(1)}px`);
        setVar('--awake-panel-o',content.toFixed(3));
        setVar('--awake-panel-y',`${(22 * (1 - content)).toFixed(1)}px`);
        setVar('--awake-color-o',light.toFixed(3));
        setVar('--awake-cta-o',live.toFixed(3));
        setVar('--awake-cta-y',`${(14 * (1 - live)).toFixed(1)}px`);
        setVar('--awake-live-o',live.toFixed(3));
        setVar('--awake-live-scale',(.78 + live * .22).toFixed(3));
        setVar('--awake-scan-o',scan.toFixed(3));
        setVar('--awake-scan-x',`${(-115 + p * 230).toFixed(1)}%`);
        setVar('--awake-spark-o',Math.min(.9, structure * .7 + live * .2).toFixed(3));
        setVar('--awake-spark-y',`${(20 * (1 - structure)).toFixed(1)}px`);
      }

      scrollDemoUpdaters.push(renderAwake);
      renderAwake((reduceMotion.matches || isMobile) ? Z_GAP : cameraPos(targetProgress || 0));
      if(reduceMotion.addEventListener){
        reduceMotion.addEventListener('change',()=>{
          lastQ=-1;
          renderAwake((reduceMotion.matches || isMobile) ? Z_GAP : cameraPos(targetProgress || 0));
        });
      }
    })();

    /* Demo 2 — Magnetic dots */
    (function(){
      const field = document.getElementById('cap-magnetic');
      if(!field) return;
      const COLS=6, ROWS=4, PULL=42;
      const dots=[];
      let mx=-9999, my=-9999, fieldW=300, fieldH=150, maxDist=340, hasPointer=false, isRepel=false, raf=null, resizeObserver=null;
      let start=()=>{}, stop=()=>{};

      function measureField(){
        fieldW=field.clientWidth||field.offsetWidth||300;
        fieldH=field.clientHeight||field.offsetHeight||150;
        maxDist=Math.max(1, Math.hypot(fieldW, fieldH));
        for(let i=0;i<dots.length;i++){
          const d=dots[i];
          d.bx=(d.col+0.5)*(fieldW/COLS);
          d.by=(d.row+0.5)*(fieldH/ROWS);
          d.x=d.bx; d.y=d.by; d.tx=d.bx; d.ty=d.by;
          d.el.style.left=d.bx+'px';
          d.el.style.top=d.by+'px';
          d.el.style.transform='translate(-50%,-50%)';
        }
      }

      function setPointer(e){
        const r = field.getBoundingClientRect();
        if(!r.width || !r.height){
          const wasPointer=hasPointer;
          hasPointer=false;mx=-9999;my=-9999;
          if(wasPointer) start();
          return false;
        }
        const px=e.clientX-r.left;
        const py=e.clientY-r.top;
        if(px < 0 || px > r.width || py < 0 || py > r.height){
          const wasPointer=hasPointer;
          hasPointer=false;mx=-9999;my=-9999;
          if(wasPointer) start();
          return false;
        }
        hasPointer=true;
        mx = px * (fieldW / r.width);
        my = py * (fieldH / r.height);
        start();
        return true;
      }

      document.addEventListener('pointermove', setPointer, {passive:true});
      document.addEventListener('pointerdown', e=>{ if(setPointer(e)) isRepel=!isRepel; }, {passive:true});

      setTimeout(()=>{
        measureField();
        for(let row=0;row<ROWS;row++){
          for(let col=0;col<COLS;col++){
            const d=document.createElement('div');
            d.className='cap-mag-dot';
            const bx=(col+0.5)*(fieldW/COLS), by=(row+0.5)*(fieldH/ROWS);
            d.style.left=bx+'px'; d.style.top=by+'px';
            field.appendChild(d);
            dots.push({el:d, row, col, bx, by, x:bx, y:by, tx:bx, ty:by});
          }
        }
        measureField();
        if('ResizeObserver' in window){
          resizeObserver = new ResizeObserver(measureField);
          resizeObserver.observe(field);
        }
        ScrollTrigger.addEventListener('refreshInit', measureField);

        function tick(){
          let keepRunning=hasPointer;
          for(let i=0;i<dots.length;i++){
            const d = dots[i];
            if(hasPointer){
              const dx  = mx - d.bx, dy = my - d.by;
              const dist = Math.max(1, Math.hypot(dx, dy));
              const falloff = 1 - Math.min(dist / (maxDist * 1.08), 1);
              const strength = 0.16 + Math.pow(falloff, 1.35) * 0.84;
              const dir = isRepel ? -1 : 1;
              d.tx = d.bx + (dx/dist) * strength * PULL * dir;
              d.ty = d.by + (dy/dist) * strength * PULL * dir;
            } else {
              d.tx = d.bx; d.ty = d.by;
            }
            d.x += (d.tx - d.x) * 0.18;
            d.y += (d.ty - d.y) * 0.18;
            d.el.style.transform = `translate(-50%,-50%) translate(${d.x-d.bx}px,${d.y-d.by}px)`;
            if(Math.abs(d.x-d.tx) > 0.08 || Math.abs(d.y-d.ty) > 0.08) keepRunning=true;
          }
          if(keepRunning) raf=requestAnimationFrame(tick);
          else raf=null;
        }
        start=()=>{if(!raf) raf=requestAnimationFrame(tick);};
        stop=()=>{
          hasPointer=false;mx=-9999;my=-9999;
          if(raf){cancelAnimationFrame(raf);raf=null;}
        };
        startDemoLoops.push(start);
        stopDemoLoops.push(stop);
        if(sectionVisible) start();
      },80);
    })();

    /* Demo 3 — 3D tilt */
    (function(){
      const wrap=document.getElementById('cap-tilt');
      const stack=document.getElementById('cap-tilt-stack');
      if(!wrap||!stack) return;
      let rx=0,ry=0,trx=0,try_=0,at=0,isAuto=true,raf=null;
      let wrapRect=wrap.getBoundingClientRect();
      ScrollTrigger.addEventListener('refresh',()=>{ wrapRect=wrap.getBoundingClientRect(); });
      wrap.addEventListener('mousemove',e=>{
        isAuto=false;
        trx=-((e.clientY-wrapRect.top)/wrapRect.height-0.5)*34;
        try_= ((e.clientX-wrapRect.left)/wrapRect.width-0.5)*34;
      });
      wrap.addEventListener('mouseleave',()=>{isAuto=true;});
      // Touch: mirror the mouse behaviour with the first touch point. Passive so the
      // user's vertical page scroll through the pinned section keeps working.
      wrap.addEventListener('touchmove',e=>{
        if(!e.touches[0]) return;
        isAuto=false;
        const t=e.touches[0];
        trx=-((t.clientY-wrapRect.top)/wrapRect.height-0.5)*34;
        try_= ((t.clientX-wrapRect.left)/wrapRect.width-0.5)*34;
      },{passive:true});
      wrap.addEventListener('touchend',()=>{ setTimeout(()=>{isAuto=true;},1200); },{passive:true});
      function tick(){
        if(!sectionVisible){raf=null;return;}
        at+=0.013;
        if(isAuto){trx=Math.sin(at)*22;try_=Math.cos(at*0.7)*28;}
        rx+=(trx-rx)*0.1; ry+=(try_-ry)*0.1;
        stack.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;
        raf=requestAnimationFrame(tick);
      }
      const start=()=>{if(!raf) raf=requestAnimationFrame(tick);};
      const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=null;}};
      startDemoLoops.push(start);
      stopDemoLoops.push(stop);
    })();

    /* Demo 4 — Warp stars */
    (function(){
      const wrap=document.getElementById('cap-warp');
      if(!wrap) return;
      setTimeout(()=>{
        const r=wrap.getBoundingClientRect();
        const w=r.width||300,h=r.height||150;
        const stars=[];
        let raf=null;
        for(let i=0;i<28;i++){
          const s=document.createElement('div');
          s.className='cap-warp-star';
          const sx=Math.random()*w,sy=Math.random()*h;
          s.style.left=sx+'px'; s.style.top=sy+'px';
          s.style.opacity=(0.3+Math.random()*0.7).toFixed(2);
          wrap.appendChild(s);
          stars.push({el:s,baseX:sx,x:sx,vx:0.5+Math.random()*1.8,w});
        }
        let lastY=window.pageYOffset,vel=0,lastT=performance.now();
        function tick(now){
          if(!sectionVisible){raf=null;return;}
          const dt=Math.max(1,now-lastT);lastT=now;
          const sy=window.pageYOffset;
          vel+=(Math.abs(sy-lastY)/dt-vel)*0.18;lastY=sy;
          const stretch=Math.min(1+vel*4,10);
          stars.forEach(s=>{
            s.x-=s.vx*(1+vel*4);
            if(s.x<-10) s.x=s.w+10;
            s.el.style.transform=`translateX(${s.x-s.baseX}px) scaleX(${stretch})`;
          });
          raf=requestAnimationFrame(tick);
        }
        const start=()=>{if(!raf) raf=requestAnimationFrame(tick);};
        const stop=()=>{if(raf){cancelAnimationFrame(raf);raf=null;}};
        startDemoLoops.push(start);
        stopDemoLoops.push(stop);
        if(sectionVisible) start();
      },80);
    })();
  }
})();

/* ============================================================
   WORK SLIDER — mobile-only auto-rotating 2-up of work cards.
   4 pages × 2 cards, 4s per page. Pauses on user touch/swipe, resumes after
   ~7s idle. Skips auto-advance if prefers-reduced-motion. "View all 8"
   toggles `.is-expanded` on the grid which reverts to the stacked 1-col layout.
   Desktop (>=600px): the IIFE inits but never starts the loop; the grid stays
   as the original 2-col layout via the existing CSS.
   ============================================================ */
(function(){
  const grid = document.getElementById('work-grid');
  const ctrls = document.getElementById('work-slider-ctrls');
  if(!grid || !ctrls) return;

  const timer = ctrls.querySelector('.work-slider-timer');
  const viewAllBtn = ctrls.querySelector('#work-slider-viewall');
  if(!timer || !viewAllBtn) return;

  const PAGE_DURATION_MS = 7000;
  const RESUME_AFTER_IDLE_MS = 7000;

  const mqMobile = window.matchMedia('(max-width:599px)');
  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobileSlider = () => mqMobile.matches && !grid.classList.contains('is-expanded');
  const canAuto = () => !grid.classList.contains('is-expanded') && !mqReduced.matches;

  const dotsMobile = Array.from(document.getElementById('work-slider-dots-mobile').querySelectorAll('.work-slider-dot'));
  const dotsDesktop = Array.from(document.getElementById('work-slider-dots-desktop').querySelectorAll('.work-slider-dot'));
  const getDots = () => mqMobile.matches ? dotsMobile : dotsDesktop;
  const getPageCount = () => mqMobile.matches ? 5 : 3;

  let currentPage = 0;
  let isPaused = false;
  let inView = false;
  let pauseTimer = null;
  let advanceRaf = null;
  let advanceStart = 0;
  let scrollSyncTimer = null;

  const pageWidth = () => grid.clientWidth;

  function setActiveDot(idx){
    if(idx === currentPage) return;
    currentPage = idx;
    getDots().forEach((d,i)=>d.classList.toggle('is-active', i===idx));
  }

  function goToPage(idx, smooth){
    grid.scrollTo({left: idx * pageWidth(), behavior: smooth ? 'smooth' : 'auto'});
    setActiveDot(idx);
  }

  function stopAutoLoop(){
    if(advanceRaf){ cancelAnimationFrame(advanceRaf); advanceRaf = null; }
    timer.style.transform = 'scaleX(0)';
  }

  function tickAuto(now){
    if(!canAuto() || isPaused || !inView){ advanceRaf = null; timer.style.transform='scaleX(0)'; return; }
    const elapsed = now - advanceStart;
    const progress = Math.min(elapsed / PAGE_DURATION_MS, 1);
    timer.style.transform = `scaleX(${progress.toFixed(3)})`;
    if(progress >= 1){
      goToPage((currentPage + 1) % getPageCount(), true);
      advanceStart = now;
    }
    advanceRaf = requestAnimationFrame(tickAuto);
  }

  function startAutoLoop(){
    if(!canAuto() || isPaused || !inView || advanceRaf) return;
    advanceStart = performance.now();
    advanceRaf = requestAnimationFrame(tickAuto);
  }

  function pauseFor(idleMs){
    isPaused = true;
    stopAutoLoop();
    if(pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(()=>{ isPaused = false; startAutoLoop(); }, idleMs);
  }

  // User-initiated swipe / manual scroll → keep dot in sync + pause auto-advance.
  grid.addEventListener('scroll', ()=>{
    if(scrollSyncTimer) clearTimeout(scrollSyncTimer);
    scrollSyncTimer = setTimeout(()=>{
      const w = pageWidth();
      if(w > 0){
        const idx = Math.max(0, Math.min(getPageCount() - 1, Math.round(grid.scrollLeft / w)));
        setActiveDot(idx);
      }
    }, 90);
  }, {passive:true});
  grid.addEventListener('touchstart', ()=>{ if(canAuto()) pauseFor(RESUME_AFTER_IDLE_MS); }, {passive:true});

  // Dot taps: jump + pause.
  [...dotsMobile, ...dotsDesktop].forEach((d,_i)=>{
    const i = parseInt(d.dataset.page, 10);
    d.addEventListener('click', ()=>{
      goToPage(i, true);
      if(canAuto()) pauseFor(RESUME_AFTER_IDLE_MS);
    });
  });

  // Arrow buttons (desktop).
  const prevBtn = document.getElementById('work-slider-prev');
  const nextBtn = document.getElementById('work-slider-next');
  function syncArrows(){
    if(prevBtn) prevBtn.disabled = currentPage === 0;
    if(nextBtn) nextBtn.disabled = currentPage === getPageCount() - 1;
  }
  if(prevBtn) prevBtn.addEventListener('click', ()=>{
    goToPage(Math.max(0, currentPage - 1), true);
    if(canAuto()) pauseFor(RESUME_AFTER_IDLE_MS);
    syncArrows();
  });
  if(nextBtn) nextBtn.addEventListener('click', ()=>{
    goToPage(Math.min(getPageCount() - 1, currentPage + 1), true);
    if(canAuto()) pauseFor(RESUME_AFTER_IDLE_MS);
    syncArrows();
  });
  const _origSetActiveDot = setActiveDot;
  setActiveDot = function(idx){ _origSetActiveDot(idx); syncArrows(); };
  syncArrows();

  // View all toggle: expand → stacked list, collapse → slider.
  function setExpanded(expanded){
    grid.classList.toggle('is-expanded', expanded);
    viewAllBtn.innerHTML = expanded ? 'Show slider ↑' : 'View all 9 ↓';
    if(pauseTimer){ clearTimeout(pauseTimer); pauseTimer = null; }
    isPaused = false;
    if(expanded){
      stopAutoLoop();
      refreshScrollSystems(80);
    } else {
      // Reset to page 0 cleanly when collapsing back to the slider.
      stopAutoLoop();
      currentPage = -1; // force setActiveDot to update
      setActiveDot(0);
      goToPage(0, false);
      requestAnimationFrame(()=>{
        const anchor = grid.closest('.work-slider-shell') || document.getElementById('work-section') || grid;
        const y = anchor.getBoundingClientRect().top + window.pageYOffset - 88;
        window.scrollTo({top:Math.max(0, y), behavior:'auto'});
        refreshScrollSystems(0);
        setTimeout(()=>{
          refreshScrollSystems(0);
          startAutoLoop();
        }, 120);
      });
    }
  }
  viewAllBtn.addEventListener('click', ()=>{
    setExpanded(!grid.classList.contains('is-expanded'));
  });

  // Section visibility — only burn frames while the section is on screen.
  if(window.ScrollTrigger){
    ScrollTrigger.create({
      trigger: grid,
      start: 'top 95%',
      end: 'bottom 5%',
      onEnter: ()=>{ inView = true; startAutoLoop(); },
      onEnterBack: ()=>{ inView = true; startAutoLoop(); },
      onLeave: ()=>{ inView = false; stopAutoLoop(); },
      onLeaveBack: ()=>{ inView = false; stopAutoLoop(); },
    });
  } else {
    inView = true;
  }

  // Cross-breakpoint resize: clean up state when switching to/from mobile.
  mqMobile.addEventListener?.('change', e=>{
    if(!e.matches){
      // Now desktop — drop is-expanded so the original 2-col CSS applies cleanly.
      grid.classList.remove('is-expanded');
      viewAllBtn.innerHTML = 'View all 8 ↓';
      stopAutoLoop();
    } else if(inView){
      startAutoLoop();
    }
  });

  // Init dot to whatever the scroll position is on load (in case of restored scroll).
  setActiveDot(0);
})();

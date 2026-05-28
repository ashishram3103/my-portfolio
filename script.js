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

const IS_MOBILE = window.innerWidth < 900;
const ENABLE_POINTER_TRAILS = true;
let RESET_SCROLL_ON_LOAD = !window.location.hash;

try{
  const nav = performance.getEntriesByType('navigation')[0];
  RESET_SCROLL_ON_LOAD = RESET_SCROLL_ON_LOAD || (nav && nav.type === 'reload');
}catch(e){}

if('scrollRestoration' in window.history){
  window.history.scrollRestoration = 'manual';
}

if(window.ScrollTrigger && ScrollTrigger.clearScrollMemory){
  ScrollTrigger.clearScrollMemory('manual');
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
  if(e.persisted && RESET_SCROLL_ON_LOAD) hardResetScroll();
  refreshScrollSystems(0);
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
  document.querySelectorAll('a:not(.wcard):not(.wcard-cta-link),button,.svc-row,.exp-item,.skill-tag,.cnt-btn-email,.cnt-btn-phone,.currently-badge,.testi-note').forEach(el=>{
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
  if(IS_MOBILE || !ENABLE_POINTER_TRAILS) return;
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
  if(IS_MOBILE || !ENABLE_POINTER_TRAILS) return;
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
  if(IS_MOBILE && window.innerWidth < 600) return;
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
   HERO MAGNETIC + LIGHT STREAK TRAILS
   (hero shapes removed from HTML, but trail spawn still works in hero)
   ============================================================ */
(function(){
  if(IS_MOBILE || !ENABLE_POINTER_TRAILS) return;
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
  const isMobile=window.matchMedia('(max-width:900px)').matches;
  const path=document.getElementById('vid-conn-path');
  const allVideos=document.querySelectorAll('#vid-section video');

  allVideos.forEach(v=>{
    v.muted=true;v.playsInline=true;v.loop=true;
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
  });

  const safePlay=v=>{try{const p=v.play();if(p&&p.catch) p.catch(()=>{});}catch(e){}};

  if(isMobile){
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
  gsap.set([mbWrap,swWrap,rpWrap],{opacity:0});
  let uxW=1,uxH=1,lastUxProgress=-1;
  function measureUx(){
    uxW=layer.clientWidth||stage.clientWidth||1;
    uxH=layer.clientHeight||stage.clientHeight||1;
  }
  measureUx();

  const clamp01=gsap.utils.clamp(0,1);
  const range=(p,a,b)=>clamp01((p-a)/(b-a));
  const pulseAt=(p,c,w)=>Math.max(0,1-Math.abs(p-c)/w);
  const gearPts=[
    {p:.10,x:50,y:9},{p:.28,x:50,y:24},{p:.46,x:82,y:41},
    {p:.62,x:22,y:62},{p:.78,x:66,y:84},{p:.94,x:54,y:97}
  ];
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
      mbGla.setAttribute('x1',+(16+(1-mg)*-20).toFixed(1));
      mbGla.setAttribute('y1',+(55+(1-mg)*8).toFixed(1));
      mbGlb.setAttribute('x2',+(149+(1-mg)*22).toFixed(1));
      mbGlb.setAttribute('y2',+(76+(1-mg)*-10).toFixed(1));
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
      swSel.setAttribute('height',+sH.toFixed(1));
      swSel.setAttribute('rx',+sRx.toFixed(1));
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

/* ============================================================
   ABOUT — bio reveal with reverse, meta + photo
   ============================================================ */
gsap.utils.toArray('.about-bio-block p').forEach((p,i)=>{
  gsap.to(p,{clipPath:'inset(0 0% 0 0)',opacity:1,duration:1,delay:i*.12,ease:'power3.out',
    scrollTrigger:{trigger:'.about-bio-block',start:'top 88%',toggleActions:'play none none reverse'}});
});
gsap.fromTo('.about-meta-card',{opacity:0,x:45},{opacity:1,x:0,duration:.9,ease:'power3.out',
  scrollTrigger:{trigger:'.about-meta-card',start:'top 88%',toggleActions:'play none none reverse'}});
gsap.fromTo('.about-photo-wrap',{opacity:0,scale:.94},{opacity:1,scale:1,duration:.9,ease:'power3.out',
  scrollTrigger:{trigger:'.about-photo-wrap',start:'top 88%',toggleActions:'play none none reverse'}});

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
  if(IS_MOBILE) return;
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
   TESTIMONIAL — SEAMLESS GSAP TRANSFORM LOOP
   No DOM mutation. No hover pause. Pure infinite slot-swap.
   Paused outside section, reset properly on re-entry.
   ============================================================ */
(function(){
  const board=document.getElementById('testi-board');
  if(!board) return;
  const notes=Array.from(board.querySelectorAll('.testi-note'));
  if(notes.length < 3) return;
  const noteRots=notes.map(n=>parseFloat(getComputedStyle(n).getPropertyValue('--rot'))||0);

  /* Carousel runs only when the grid is multi-column (>=600px). Below that the
     section is a single stacked column where the slot-shuffle makes no sense. */
  const canRun=()=>window.matchMedia('(min-width:600px)').matches;
  let inView=false;
  let positions=[];        /* original DOM-order coordinates */
  let slotIndex=[];        /* current slot occupied by each note (mod-wrapped) */
  let active=false;
  let raf=null;
  let lastT=0;
  let resizeTimer=null;

  /* Speed: cycle one full slot in ~6 seconds */
  const SLOT_DURATION_MS=6000;

  function measure(){
    positions=notes.map(n=>{
      /* Read DOM-order resting position — clear any transform first */
      const prev=n.style.transform;
      n.style.transform='';
      const r=n.getBoundingClientRect();
      n.style.transform=prev;
      return {left:r.left,top:r.top};
    });
    slotIndex=notes.map((_,i)=>i);
  }

  function applyPositions(progress){
    /* progress = 0..1 within current cycle. Each note moves from its current slot
       to the NEXT slot. When progress hits 1, slotIndex shifts forward by 1. */
    const N=notes.length;
    notes.forEach((note,i)=>{
      const fromSlot=slotIndex[i];
      const toSlot=(fromSlot+1)%N;
      const from=positions[fromSlot];
      const to=positions[toSlot];
      const x=(to.left-from.left)*progress + (from.left-positions[i].left);
      const y=(to.top-from.top)*progress + (from.top-positions[i].top);
      note.style.transform=`translate(${x}px,${y}px) rotate(${noteRots[i]}deg)`;
    });
  }

  function tick(t){
    if(!active){raf=null;return;}
    if(!lastT) lastT=t;
    const dt=t-lastT;
    const progress=(dt%SLOT_DURATION_MS)/SLOT_DURATION_MS;
    /* When we cross a full cycle, advance slotIndex */
    if(dt>=SLOT_DURATION_MS){
      lastT=t;
      const N=notes.length;
      slotIndex=slotIndex.map(s=>(s+1)%N);
      applyPositions(0);
    } else {
      applyPositions(progress);
    }
    raf=requestAnimationFrame(tick);
  }

  function startLoop(){
    if(active || !inView || !canRun()) return;
    measure();
    active=true;lastT=0;
    raf=requestAnimationFrame(tick);
  }
  function stopLoop(){
    active=false;
    if(raf){cancelAnimationFrame(raf);raf=null;}
    /* Reset to resting position. Below 600px clear the inline transform so the
       stacked-column CSS (transform:none) applies instead of a forced tilt. */
    notes.forEach((n,i)=>{
      n.style.transform = canRun() ? `rotate(${noteRots[i]}deg)` : '';
    });
  }

  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      stopLoop();
      startLoop();
    },250);
  },{passive:true});

  ScrollTrigger.create({
    trigger:board,start:'top 90%',end:'bottom 10%',
    onEnter:()=>{inView=true;startLoop();},
    onEnterBack:()=>{inView=true;startLoop();},
    onLeave:()=>{inView=false;stopLoop();},
    onLeaveBack:()=>{inView=false;stopLoop();}
  });
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

  if(isMobile){
    /* Mobile: just show all cards stacked, no pinning */
    cards.forEach(c=>{
      c.style.opacity='1';
      c.style.transform='none';
      c.classList.add('is-active');
    });
    initDemos();
    return;
  }

  /* Desktop: ~1.15VH per card — gives each card a brief dwell window via easeHold */
  function setSectionHeight(){
    section.style.height = Math.round(N * window.innerHeight * 1.15) + 'px';
  }
  setSectionHeight();
  ScrollTrigger.addEventListener('refreshInit', setSectionHeight);

  /* GSAP pin the inner wrap — pinType:'fixed' avoids the sub-pixel snap of the
     default transform-based pin; the opacity fade on .cap-pin-wrap (toggled via
     'is-live' class from camST onEnter/onLeave) masks any residual layout shift. */
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    pin: pinWrap,
    pinSpacing: false,
    // 'fixed' is crisp on desktop but jumps on touch when the mobile address bar
    // shows/hides. 'transform' pins by moving the element and is immune to that.
    pinType: window.matchMedia('(min-width:901px)').matches ? 'fixed' : 'transform',
    anticipatePin: 1,
    invalidateOnRefresh: true,
  });

  /* ── Reference-faithful camera world ──
     Two-element architecture (mirrors hyper-scroll-brutal-preview.html):
       stage (.cap-cards-stage) → perspective:Xpx only, NEVER transformed
       world (.cap-world)       → transform-style:preserve-3d + rotateX/Y
     Items live in world and use translate3d(x,y,z).
     This is the only correct way: applying perspective and rotateX to the SAME
     element causes perspective to evaluate in the rotated local frame → world flip. */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const Z_GAP       = 1200;
  const FOCUS_X     = Math.round(window.innerWidth * 0.10);
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
      x:(i % 2 ? -60 : 60), y:0,
      rot:b.rot,
      baseZ:-(i + 0.5) * Z_GAP
    });
  });

  // Stars — kept intentionally light; too many 3D layers cost frames during scroll.
  const STAR_COUNT = window.innerWidth > 1280 ? 36 : 20;
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
  let sectionVisible = false; // gates all demo RAF work when section is off-screen
  let activeCard     = cards[0] || null;
  let lastPct        = -1;
  let lastFov        = 1000;
  const startDemoLoops = [];
  const stopDemoLoops = [];

  function startCapabilityDemos(){startDemoLoops.forEach(fn=>fn());}
  function stopCapabilityDemos(){stopDemoLoops.forEach(fn=>fn());}
  function startWorldLoop(){if(sectionVisible && !animRaf) animRaf=requestAnimationFrame(animLoop);}

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
    // Mouse tilt
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    // Touch: drop the velocity term — jerky touch-scroll velocity makes it vibrate.
    const velTilt = isTouch ? 0 : smoothVel * 5;
    const rx = clamp(mouse.y * -5 - velTilt, -8, 8);
    const ry = clamp(mouse.x *  5,           -8, 8);
    world.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
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

    // Dynamic perspective on STAGE — mirrors reference viewport.style.perspective
    // fov range [600, 1000]; never low enough for cards to approach the plane
    const fov    = 1000 - Math.min(Math.abs(smoothVel) * 400, 400);
    const MAX_Z  = fov - 300; // safety cap so translateZ can't cross the plane
    if(Math.abs(fov - lastFov) > 1){
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
      if(it.type === 'card'){
        // Tight exit: card never lingers past camera plane
        if(relZ >  250 || relZ < -1800) alpha = 0;
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
  }
  function activateWorld(){
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
    onUpdate:    self => { targetProgress = self.progress; lastVel = self.getVelocity(); startWorldLoop(); },
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

    /* Demo 1 — Scramble */
    (function(){
      const el = document.getElementById('cap-scramble');
      if(!el) return;
      const WORDS = ['MOTION','SCROLL','DEPTH','BUILD','SYSTEM'];
      const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*!';
      let wi = 0, loopId=null, scrambleId=null;
      function scramble(target){
        let f=0; const max=16;
        clearInterval(scrambleId);
        scrambleId=setInterval(()=>{
          if(f>=max){el.textContent=target;clearInterval(scrambleId);scrambleId=null;return;}
          el.textContent=target.split('').map((ch,i)=>
            i<f*target.length/max?ch:CHARS[Math.floor(Math.random()*CHARS.length)]
          ).join('');
          f++;
        },36);
      }
      function start(){
        if(loopId) return;
        scramble(WORDS[wi]);
        loopId=setInterval(()=>{ wi=(wi+1)%WORDS.length; scramble(WORDS[wi]); },2400);
      }
      function stop(){
        clearInterval(loopId);loopId=null;
        clearInterval(scrambleId);scrambleId=null;
        el.textContent=WORDS[wi];
      }
      el.textContent=WORDS[0];
      startDemoLoops.push(start);
      stopDemoLoops.push(stop);
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

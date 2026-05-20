'use strict';

/* ============================================================
   v12 — CLEAN JS. All 10 A fixes applied. No patches on patches.
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ignoreMobileResize:true,limitCallbacks:true,fastScrollEnd:true,preventOverlaps:true});
gsap.defaults({ease:'expo.out',duration:0.9});
gsap.ticker.lagSmoothing(500, 33);

const IS_MOBILE = window.innerWidth < 900;

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
  });
  gsap.ticker.add(()=>{rx+=(mx-rx)*.18;ry+=(my-ry)*.18;gsap.set(ring,{x:rx,y:ry});});

  function setState(state, text){
    document.body.classList.remove('cur-hover','cur-text','cur-image','cur-drag','cur-work','cur-hidden');
    if(state) document.body.classList.add('cur-'+state);
    if(text != null) label.textContent = text;
  }

  document.querySelectorAll('a,button,.svc-row,.exp-item,.skill-tag,.cnt-btn-email,.cnt-btn-phone,.currently-badge,.testi-note').forEach(el=>{
    el.addEventListener('mouseenter',()=>setState('hover'));
    el.addEventListener('mouseleave',()=>setState(null));
  });
  document.querySelectorAll('#work-section .wcard,#work-section .wcard-cta,#work-section .wcard-cta-link').forEach(el=>{
    el.addEventListener('mouseenter',()=>setState('work','LOOK'));
    el.addEventListener('mouseleave',()=>setState(null));
  });
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
  let trailActive=false, trailTimer=null;
  document.addEventListener('mousemove',e=>{
    if(trailActive) return;
    trailActive=true;
    const blob=document.createElement('div');
    blob.className='ink-blob';
    const sectionColor=(window.__trailColor && window.__trailColor()) || '#F9D100';
    blob.style.setProperty('--ink-color', sectionColor);
    blob.style.left=e.clientX+'px';
    blob.style.top=e.clientY+'px';
    const size=10+Math.random()*8;
    blob.style.width=size+'px';
    blob.style.height=size+'px';
    blob.style.opacity=0.45+Math.random()*0.20;
    document.body.appendChild(blob);
    gsap.fromTo(blob,
      {scale:1},
      {scale:0.2,opacity:0,duration:0.8,ease:'expo.out',onComplete:()=>blob.remove()}
    );
    clearTimeout(trailTimer);
    trailTimer=setTimeout(()=>{trailActive=false;},38);
  });
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
    document.body.classList.remove('is-loading');
    playHeroIntro();
    /* Single refresh — only inside loader done() */
    setTimeout(()=>{if(window.ScrollTrigger)ScrollTrigger.refresh();},450);
  };
  if(!loader){done();return;}
  const tl=gsap.timeline({defaults:{ease:'power3.out'},onComplete:()=>{loader.remove();done();}});
  tl.to('.loader-title',{y:-14,opacity:0,duration:.45})
    .to('.loader-kicker,.loader-meta,.loader-mark,.loader-signature',{opacity:0,y:-12,duration:.35},'<')
    .to('#site-loader',{clipPath:'inset(0 0 100% 0)',duration:.8,ease:'power4.inOut'},'-=.1');
}

window.addEventListener('load',()=>setTimeout(finishSiteLoader,650));

/* Emergency fallback — only if loader fails after 3s */
setTimeout(()=>{
  if(document.body.classList.contains('is-loading')){
    document.body.classList.remove('is-loading');
    const loader=document.getElementById('site-loader');
    if(loader) loader.remove();
    playHeroIntro();
    setTimeout(()=>{if(window.ScrollTrigger)ScrollTrigger.refresh();},400);
  }
},3000);

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
    if(!IS_MOBILE){
      gsap.to('#word-section',{backgroundColor:'rgba(249,209,0,.06)',duration:.15,yoyo:true,repeat:1,ease:'none'});
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
    setTimeout(()=>{
      inner.classList.remove('touch-active');
      const ws=document.getElementById('word-section');
      if(ws) ws.style.backgroundColor='';
    },320);
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
  const isMobile=window.matchMedia('(max-width:900px)').matches;
  const path=document.getElementById('vid-conn-path');
  const allVideos=document.querySelectorAll('#vid-section video');

  allVideos.forEach(v=>{
    v.muted=true;v.playsInline=true;v.loop=true;
    v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
  });

  const safePlay=v=>{try{const p=v.play();if(p&&p.catch) p.catch(()=>{});}catch(e){}};

  if(isMobile){
    allVideos.forEach((v,i)=>{
      if(i===0){v.preload='auto';safePlay(v);}
      else{v.pause();v.removeAttribute('src');v.querySelectorAll('source').forEach(s=>s.removeAttribute('src'));v.load();}
    });
    return;
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
   REEL AMBIENT SVGs — single consolidated, paused outside section
   ============================================================ */
(function(){
  const reel=document.getElementById('vid-section');
  if(!reel) return;
  const stage=document.querySelector('#vid-section .vid-flow-stage') || reel;
  if(!stage || stage.querySelector('.reel-ambient-svg')) return;

  const ambient=document.createElement('div');
  ambient.className='reel-ambient-svg';
  ambient.innerHTML=`
    <svg class="reel-amb-1" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="30" stroke="#0D0D0D" stroke-width="1.5" fill="none" stroke-dasharray="3 4"/>
      <circle cx="40" cy="40" r="6" fill="#F9D100"/>
    </svg>
    <svg class="reel-amb-2" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M 10 50 Q 30 10, 50 50 T 90 50" stroke="#2B5EB8" stroke-width="2" fill="none"/>
    </svg>
    <svg class="reel-amb-3" viewBox="0 0 60 60" aria-hidden="true">
      <rect x="8" y="8" width="44" height="44" stroke="#0D0D0D" stroke-width="2" fill="none" transform="rotate(12 30 30)"/>
      <rect x="14" y="14" width="32" height="32" stroke="#F9D100" stroke-width="1.5" fill="none" transform="rotate(-6 30 30)"/>
    </svg>
    <span class="reel-amb-label reel-amb-l1">01 / Sequence</span>
    <span class="reel-amb-label reel-amb-l2">UX → System → Ship</span>
    <span class="reel-amb-label reel-amb-l3">motion with purpose</span>
  `;
  stage.appendChild(ambient);

  const ambientEls=ambient.querySelectorAll('svg, .reel-amb-label');
  gsap.set(ambientEls,{opacity:0,y:18,scale:.96});

  /* Single consolidated float timeline — paused by default */
  const floatTl=gsap.timeline({paused:true});
  floatTl
    .to('.reel-amb-1',{rotation:360,duration:30,ease:'linear',repeat:-1},0)
    .to('.reel-amb-2',{y:-20,duration:4,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.reel-amb-3',{rotation:-15,duration:6,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.reel-amb-l1',{x:-18,y:12,duration:5,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.reel-amb-l2',{x:22,y:-10,duration:5.6,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.reel-amb-l3',{x:-16,y:-14,duration:4.8,yoyo:true,repeat:-1,ease:'sine.inOut'},0);

  ScrollTrigger.create({
    trigger:stage,start:'top 90%',end:'bottom 10%',
    onEnter:()=>{gsap.to(ambientEls,{opacity:1,y:0,scale:1,stagger:.07,duration:.7,ease:'expo.out'});floatTl.play();},
    onEnterBack:()=>{gsap.to(ambientEls,{opacity:1,y:0,scale:1,stagger:.05,duration:.55,ease:'expo.out'});floatTl.play();},
    onLeave:()=>floatTl.pause(),
    onLeaveBack:()=>{floatTl.pause();gsap.to(ambientEls,{opacity:0,y:18,scale:.96,stagger:.03,duration:.42,ease:'power2.out'});}
  });
})();

/* ============================================================
   BUILD UX CHIPS — section-scoped, paused outside
   ============================================================ */
(function(){
  if(IS_MOBILE) return;
  const stage=document.querySelector('#vid-section .vid-flow-stage');
  if(!stage || stage.querySelector('.ux-build-layer')) return;
  const layer=document.createElement('div');
  layer.className='ux-build-layer';
  layer.innerHTML=`
    <span class="ux-chip c1">prototype</span>
    <span class="ux-chip c2">system</span>
    <span class="ux-chip c3">logic</span>
    <span class="ux-chip c4">ship</span>
    <span class="ux-node n1"></span><span class="ux-node n2"></span><span class="ux-node n3"></span>
  `;
  stage.appendChild(layer);
  const cues=layer.querySelectorAll('.ux-chip,.ux-node');
  gsap.set(cues,{opacity:0,scale:.82,y:26,rotation:(i)=>[-7,5,-5,6,0,0,0][i]||0});

  const pulse=gsap.timeline({paused:true})
    .to('.ux-chip.c1',{x:42,y:28,duration:4.5,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.ux-chip.c2',{x:-52,y:32,duration:5.1,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.ux-chip.c3',{x:58,y:-34,duration:4.8,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.ux-chip.c4',{x:-64,y:-28,duration:5.3,yoyo:true,repeat:-1,ease:'sine.inOut'},0)
    .to('.ux-node',{scale:1.42,opacity:.92,stagger:.18,duration:1.1,repeat:-1,yoyo:true,ease:'sine.inOut'},0);

  ScrollTrigger.create({
    trigger:stage,start:'top 82%',end:'bottom 18%',
    onEnter:()=>{gsap.to(cues,{opacity:1,scale:1,y:0,rotation:0,stagger:.08,duration:.72,ease:'back.out(1.45)'});pulse.play();},
    onEnterBack:()=>{gsap.to(cues,{opacity:1,scale:1,y:0,rotation:0,stagger:.05,duration:.55,ease:'back.out(1.3)'});pulse.play();},
    onLeave:()=>pulse.pause(),
    onLeaveBack:()=>{pulse.pause();gsap.to(cues,{opacity:0,scale:.82,y:26,stagger:.03,duration:.42,ease:'power2.out'});}
  });
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

  function halfWidth(){return track.scrollWidth/2;}

  function tick(){
    if(sectionActive && !isPaused){
      scrollPos+=speed;
      const hw=halfWidth();
      if(scrollPos>=hw){scrollPos-=hw;wrap.scrollLeft=scrollPos;}
      else{wrap.scrollLeft=scrollPos;}
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  ScrollTrigger.create({
    trigger:wrap,start:'top bottom',end:'bottom top',
    onEnter:()=>{sectionActive=true;},
    onEnterBack:()=>{sectionActive=true;},
    onLeave:()=>{sectionActive=false;},
    onLeaveBack:()=>{sectionActive=false;}
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
      resumeTimer=setTimeout(()=>{isPaused=false;},1200);
    });
    wrap.addEventListener('mouseenter',()=>{if(!isDragging){isPaused=true;clearTimeout(resumeTimer);}});
    wrap.addEventListener('mouseleave',()=>{if(!isDragging){resumeTimer=setTimeout(()=>{isPaused=false;},400);}});
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
      resumeTimer=setTimeout(()=>{isPaused=false;},1200);
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

  lab.addEventListener('mousemove',e=>{
    clearTimeout(idleTimer);
    const r=lab.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width-.5;
    const py=(e.clientY-r.top)/r.height-.5;
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
  if(!board || IS_MOBILE) return;
  const notes=Array.from(board.querySelectorAll('.testi-note'));
  if(notes.length < 3) return;

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
      const rot=parseFloat(getComputedStyle(note).getPropertyValue('--rot'))||0;
      note.style.transform=`translate(${x}px,${y}px) rotate(${rot}deg)`;
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
    if(active) return;
    measure();
    active=true;lastT=0;
    raf=requestAnimationFrame(tick);
  }
  function stopLoop(){
    active=false;
    if(raf){cancelAnimationFrame(raf);raf=null;}
    /* Reset to resting position */
    notes.forEach(n=>{
      const rot=parseFloat(getComputedStyle(n).getPropertyValue('--rot'))||0;
      n.style.transform=`rotate(${rot}deg)`;
    });
  }

  window.addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      const wasActive=active;
      stopLoop();
      if(wasActive) startLoop();
    },250);
  },{passive:true});

  ScrollTrigger.create({
    trigger:board,start:'top 90%',end:'bottom 10%',
    onEnter:startLoop,onEnterBack:startLoop,
    onLeave:stopLoop,onLeaveBack:stopLoop
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

  const isMobile = window.matchMedia('(max-width:900px)').matches;
  const cards = Array.from(section.querySelectorAll('.cap-card'));
  const N = cards.length;
  if(!N) return;

  /* Start all hidden except first */
  cards.forEach((c,i)=>{
    c.style.opacity = i===0 ? '1' : '0';
    c.style.transform = i===0 ? 'translateY(0px) scale(1)' : 'translateY(40px) scale(0.96)';
    if(i===0) c.classList.add('is-active');
  });

  const prog = document.getElementById('cap-prog');
  const bar  = document.getElementById('cap-bar');

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

  /* Desktop: set section height to give scroll room for all cards */
  const VH = window.innerHeight;
  section.style.height = (N * VH * 1.2) + 'px';

  /* GSAP pin the inner wrap */
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    pin: pinWrap,
    pinSpacing: false,
    anticipatePin: 1,
  });

  /* Crossfade cards based on scroll progress through section */
  let currentIdx = 0;

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: self=>{
      const rawIdx = self.progress * N;
      const idx = Math.min(Math.floor(rawIdx), N-1);

      if(idx !== currentIdx){
        /* Fade out current */
        gsap.to(cards[currentIdx], {
          opacity: 0,
          y: -40,
          scale: 1.04,
          duration: 0.45,
          ease: 'power2.in',
          onComplete:()=>{ cards[currentIdx].classList.remove('is-active'); }
        });
        /* Fade in new */
        gsap.fromTo(cards[idx],
          {opacity:0, y:40, scale:0.96},
          {opacity:1, y:0, scale:1, duration:0.55, ease:'power3.out',
           onStart:()=>{ cards[idx].classList.add('is-active'); }}
        );
        currentIdx = idx;
      }

      /* Progress readouts */
      const pct = Math.round(self.progress * 100);
      if(prog) prog.textContent = String(pct).padStart(3,'0');
      if(bar)  bar.style.width = pct + '%';
    }
  });

  initDemos();

  /* ── DEMOS ── */
  function initDemos(){

    /* Demo 1 — Scramble */
    (function(){
      const el = document.getElementById('cap-scramble');
      if(!el) return;
      const WORDS = ['MOTION','SCROLL','DEPTH','BUILD','SYSTEM'];
      const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*!';
      let wi = 0;
      function scramble(target){
        let f=0; const max=16;
        const id=setInterval(()=>{
          if(f>=max){el.textContent=target;clearInterval(id);return;}
          el.textContent=target.split('').map((ch,i)=>
            i<f*target.length/max?ch:CHARS[Math.floor(Math.random()*CHARS.length)]
          ).join('');
          f++;
        },36);
      }
      scramble(WORDS[0]);
      setInterval(()=>{ wi=(wi+1)%WORDS.length; scramble(WORDS[wi]); },2000);
    })();

    /* Demo 2 — Magnetic dots */
    (function(){
      const field = document.getElementById('cap-magnetic');
      if(!field) return;
      const COLS=6, ROWS=4;
      const dots=[];
      setTimeout(()=>{
        const r=field.getBoundingClientRect();
        const w=r.width||300, h=r.height||150;
        for(let row=0;row<ROWS;row++){
          for(let col=0;col<COLS;col++){
            const d=document.createElement('div');
            d.className='cap-mag-dot';
            const bx=(col+0.5)*(w/COLS), by=(row+0.5)*(h/ROWS);
            d.style.left=bx+'px'; d.style.top=by+'px';
            field.appendChild(d);
            dots.push({el:d,bx,by,x:bx,y:by,tx:bx,ty:by});
          }
        }
        let mx=-9999,my=-9999;
        field.addEventListener('mousemove',e=>{
          const r2=field.getBoundingClientRect();
          mx=e.clientX-r2.left; my=e.clientY-r2.top;
        });
        field.addEventListener('mouseleave',()=>{mx=-9999;my=-9999;});
        (function tick(){
          dots.forEach(d=>{
            const dx=mx-d.bx,dy=my-d.by,dist=Math.hypot(dx,dy);
            if(dist<90&&dist>0){const f=(90-dist)/90;d.tx=d.bx+(dx/dist)*f*26;d.ty=d.by+(dy/dist)*f*26;}
            else{d.tx=d.bx;d.ty=d.by;}
            d.x+=(d.tx-d.x)*0.16; d.y+=(d.ty-d.y)*0.16;
            d.el.style.transform=`translate(${d.x-d.bx}px,${d.y-d.by}px)`;
          });
          requestAnimationFrame(tick);
        })();
      },80);
    })();

    /* Demo 3 — 3D tilt */
    (function(){
      const wrap=document.getElementById('cap-tilt');
      const stack=document.getElementById('cap-tilt-stack');
      if(!wrap||!stack) return;
      let rx=0,ry=0,trx=0,try_=0,at=0,isAuto=true;
      wrap.addEventListener('mousemove',e=>{
        isAuto=false;
        const r=wrap.getBoundingClientRect();
        trx=-((e.clientY-r.top)/r.height-0.5)*34;
        try_= ((e.clientX-r.left)/r.width-0.5)*34;
      });
      wrap.addEventListener('mouseleave',()=>{isAuto=true;});
      (function tick(){
        at+=0.013;
        if(isAuto){trx=Math.sin(at)*22;try_=Math.cos(at*0.7)*28;}
        rx+=(trx-rx)*0.1; ry+=(try_-ry)*0.1;
        stack.style.transform=`rotateX(${rx}deg) rotateY(${ry}deg)`;
        requestAnimationFrame(tick);
      })();
    })();

    /* Demo 4 — Warp stars */
    (function(){
      const wrap=document.getElementById('cap-warp');
      if(!wrap) return;
      setTimeout(()=>{
        const r=wrap.getBoundingClientRect();
        const w=r.width||300,h=r.height||150;
        const stars=[];
        for(let i=0;i<28;i++){
          const s=document.createElement('div');
          s.className='cap-warp-star';
          const sx=Math.random()*w,sy=Math.random()*h;
          s.style.left=sx+'px'; s.style.top=sy+'px';
          s.style.opacity=(0.3+Math.random()*0.7).toFixed(2);
          wrap.appendChild(s);
          stars.push({el:s,x:sx,vx:0.5+Math.random()*1.8,w});
        }
        let lastY=window.pageYOffset,vel=0,lastT=performance.now();
        (function tick(now){
          const dt=Math.max(1,now-lastT);lastT=now;
          const sy=window.pageYOffset;
          vel+=(Math.abs(sy-lastY)/dt-vel)*0.18;lastY=sy;
          const stretch=Math.min(1+vel*4,10);
          stars.forEach(s=>{
            s.x-=s.vx*(1+vel*4);
            if(s.x<-10) s.x=s.w+10;
            s.el.style.left=s.x+'px';
            s.el.style.transform=`scaleX(${stretch})`;
          });
          requestAnimationFrame(tick);
        })(performance.now());
      },80);
    })();
  }
})();

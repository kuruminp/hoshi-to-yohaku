(async () => {
  'use strict';
  // Only works.json is edited when adding books. The self-contained offline
  // preview can supply window.STORY_DATA to avoid file:// fetch restrictions.
  let payload = window.STORY_DATA;
  if (!payload) {
    try {
      const response = await fetch('./works.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      payload = await response.json();
    } catch (error) {
      console.error('Could not load works.json', error);
      document.getElementById('quiz-content').textContent = '作品データを読み込めませんでした．works.jsonを確認してください．';
      return;
    }
  }
  if (!payload || !Array.isArray(payload.works) || payload.works.length === 0) {
    document.getElementById('quiz-content').textContent = '作品データが空です．作品データを確認してください．';
    return;
  }
  const works = payload.works;
  const $ = (s) => document.querySelector(s);
  const signs = [
    ['牡羊座','牡羊座','♈'],['牡牛座','牡牛座','♉'],['双子座','双子座','♊'],['蟹座','蟹座','♋'],
    ['獅子座','獅子座','♌'],['乙女座','乙女座','♍'],['天秤座','天秤座','♎'],['蠍座','蠍座','♏'],
    ['射手座','射手座','♐'],['山羊座','山羊座','♑'],['水瓶座','水瓶座','♒'],['魚座','魚座','♓']
  ];
  const moodOptions = [
    ['癒やし','気持ちをやわらげたい','☾'],
    ['わくわく','新しい世界に飛び込みたい','✧'],
    ['爽快','すっきりしたい','✦'],
    ['感動','心を揺さぶられたい','♡'],
    ['じっくり','余韻を味わいたい','❋'],
    ['緊張感','ハラハラしたい','⚝']
  ];
  const groups = [
    ['恋愛','恋愛・ときめき','♡'],['ファンタジー','異世界・冒険','✦'],
    ['人間ドラマ','人生・歴史・文学','❋'],['謎解き・ホラー','ミステリー・ホラー','☷'],
    ['SF・ゲーム','SF・ゲーム','☄'],['おまかせ','予想外の世界に出会いたい','✧']
  ];
  const lengths = [
    ['短編','少しの時間で読みたい','☕'],
    ['連載・中長編','じっくり没頭したい','☾'],
    ['どちらでも','長さはおまかせ','✧']
  ];
  const motifs = [
    ['令嬢','令嬢・宮廷','♕'],['転生','転生・やり直し','✧'],
    ['魔法','魔法・ファンタジー','✦'],['謎解き','謎・推理','⌕'],
    ['家族','家族・人間関係','♡'],['戦国','歴史・戦略','⚑'],
    ['ゲーム','ゲーム・SF','☄'],['おまかせ','直感に任せる','✺']
  ];
  const steps = [
    {key:'sign',question:'あなたの星座は？',desc:'ここから，今日の読書時間を始めましょう．',options:signs,columns:'sign-grid'},
    {key:'mood',question:'今日は，どんな気分ですか？',desc:'読み終えたときに感じたい気持ちを選んでください．',options:moodOptions},
    {key:'group',question:'どんな世界に入りたい？',desc:'普段は選ばないジャンルを選ぶのも，ひとつの楽しみです．',options:groups},
    {key:'length',question:'どのくらい読みたい？',desc:'今夜の時間に似合う長さを選んでください．',options:lengths},
    {key:'motif',question:'気になる物語の要素は？',desc:'最後は直感で．今のあなたに惹かれる言葉を．',options:motifs}
  ];
  const state = {step:0, answers:{sign:'',mood:'',group:'',length:'',motif:''},reroll:0,results:[]};
  const palettes = {
    '恋愛':['#865d6f','#283a56','♡'],
    'ファンタジー':['#2b5b65','#182f4f','✦'],
    '人間ドラマ':['#807051','#313850','❋'],
    '謎解き・ホラー':['#634a65','#18263f','☽'],
    'SF・ゲーム':['#355874','#152e38','☄']
  };
  const safeText = value => String(value ?? '');
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = safeText(text);
    return node;
  }
  function optionsForStep(stepIndex) {
    return steps[stepIndex].options;
  }
  function drawStep() {
    const step = steps[state.step];
    const area = $('#quiz-content');
    area.replaceChildren();
    const q = el('h3','quiz-question',step.question);
    const desc = el('p','quiz-desc',step.desc);
    const choices = el('div','option-grid' + (step.columns ? ' '+step.columns : ''));
    for (const [key,label,icon] of optionsForStep(state.step).map(opt => opt.length===2?[...opt,'✧']:opt)) {
      const btn=el('button','choice');
      btn.type='button'; btn.setAttribute('aria-pressed',state.answers[step.key]===key?'true':'false');
      btn.dataset.value=key;
      btn.appendChild(el('span','choice-icon',icon));
      btn.appendChild(el('span','',label));
      btn.addEventListener('click',()=>{
        state.answers[step.key]=key;
        for (const sibling of choices.querySelectorAll('button')) sibling.setAttribute('aria-pressed',String(sibling===btn));
        $('#next-question').disabled=false;
        $('#quiz-status').textContent='選択しました';
      });
      choices.appendChild(btn);
    }
    area.append(q,desc,choices);
    const index=state.step+1;
    $('#step-label').textContent=`STEP ${String(index).padStart(2,'0')} / 05`;
    $('.side-number').innerHTML=`${String(index).padStart(2,'0')} <span>/ 05</span>`;
    $('.progress-fill').style.width=`${index*20}%`;
    $('#prev-question').disabled=(state.step===0);
    $('#next-question').textContent=state.step===steps.length-1?'3冊を選ぶ　✧':'次へ　→';
    $('#next-question').disabled=!state.answers[step.key];
    $('#quiz-status').textContent=state.answers[step.key]?'選択しました':'選択してください';
  }
  $('#prev-question').addEventListener('click',()=>{if(state.step>0){state.step--;drawStep();}});
  $('#next-question').addEventListener('click',()=>{
    if(!state.answers[steps[state.step].key])return;
    if(state.step<steps.length-1){state.step++;drawStep();}
    else {state.reroll=0;showResults();}
  });
  const hash = s => {
    let h = 2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  };
  function localDateString(){
    const d = new Date();
    // Japan is the target audience and day boundary matches local-JST schedule.
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  // Relevance is computed from the reader's choices. Reroll does not alter
  // these weights: instead it moves through a seeded, author-safe deck.
  function score(work) {
    const a = state.answers;
    const seed = `${localDateString()}|${a.sign}|${a.mood}|${a.group}|${a.length}|${a.motif}|${work.id}`;
    let sum = hash(seed)%1600/100; // A little daily, zodiac-dependent variety.
    if(a.group==='おまかせ')sum+=14;
    else if(work.group===a.group)sum+=34;
    if(work.moods.includes(a.mood))sum+=31;
    else if(a.mood==='感動' && work.moods.includes('余韻'))sum+=17;
    else if(a.mood==='わくわく' && work.moods.includes('冒険'))sum+=17;
    else if(a.mood==='爽快' && work.moods.includes('わくわく'))sum+=13;
    else if(a.mood==='癒やし' && work.moods.includes('ときめき'))sum+=14;
    if(a.length==='どちらでも')sum+=10;
    else if(work.length===a.length)sum+=19;
    else if(a.length==='連載・中長編' && work.length==='連載')sum+=19;
    if(a.motif==='おまかせ')sum+=7;
    else if(work.tags.includes(a.motif))sum+=19;
    else if(a.motif==='謎解き'&&work.genre==='推理')sum+=18;
    else if(a.motif==='ゲーム'&&work.group==='SF・ゲーム')sum+=8;
    sum+=(hash(`${a.sign}|${work.id}`)%800)/100;
    return sum;
  }
  function related(a,b) {
    return a.author===b.author || Boolean(a.sameStoryGroup && a.sameStoryGroup===b.sameStoryGroup);
  }
  let deckCacheKey='';
  let deckCache=[];
  // Sort by preference, then shuffle within small relevance bands. A book
  // appears only once in the deck, so advancing by 3 replaces ALL 3 results.
  // This is deterministic for a given day and answers, preserving share URLs.
  function buildDeck() {
    const a=state.answers;
    const key=`${localDateString()}|${a.sign}|${a.mood}|${a.group}|${a.length}|${a.motif}`;
    if(key===deckCacheKey)return deckCache;
    const ranked=works.map(w=>({work:w,fit:score(w)}))
      .sort((x,y)=>y.fit-x.fit || x.work.id.localeCompare(y.work.id));
    const deck=[];
    // First several rerolls prefer high-matching stories; later turns explore
    // other genres. Each band is deterministically shuffled for variation.
    for(let i=0;i<ranked.length;i+=20){
      const band=ranked.slice(i,i+20)
        .sort((x,y)=>hash(key+'|deck|'+x.work.id)-hash(key+'|deck|'+y.work.id));
      deck.push(...band.map(x=>x.work));
    }
    // Keep the same author and the short/serial versions of the same work
    // separated by >=3 positions, including across the cyclic boundary.
    const clashAt=(idx)=>{
      const n=deck.length;
      return [-5,-4,-3,-2,-1,1,2,3,4,5].some(delta=>{
        const other=deck[(idx+delta+n)%n];
        const sameTitle=deck[idx].title===other.title || Boolean(deck[idx].sameStoryGroup && deck[idx].sameStoryGroup===other.sameStoryGroup);
        return sameTitle || (Math.abs(delta)<=2 && related(deck[idx],other));
      });
    };
    for(let pass=0;pass<3;pass++){
      let any=false;
      for(let i=0;i<deck.length;i++){
        if(!clashAt(i))continue;
        any=true;
        for(let j=0;j<deck.length;j++){
          if(i===j)continue;
          [deck[i],deck[j]]=[deck[j],deck[i]];
          if(!clashAt(i) && !clashAt(j))break;
          [deck[i],deck[j]]=[deck[j],deck[i]];
        }
      }
      if(!any)break;
    }
    deckCacheKey=key;
    deckCache=deck;
    return deck;
  }
  function selectBooks() {
    const deck=buildDeck();
    const start=((state.reroll*3)%deck.length+deck.length)%deck.length;
    return [0,1,2].map(offset=>deck[(start+offset)%deck.length]);
  }
  // Each recommendation has a work-specific editorial note.
  // The title and manually reviewed metadata are the starting points; no
  // generic "mood + tag" sentence is repeated across different books.
  function reasonFor(work){
    if (typeof work.pitch==='string' && work.pitch.trim()) return work.pitch;
    const motif=(work.tags||[]).find(Boolean)||work.genre;
    return `「${work.title}」が気になるなら．${motif}をテーマにした読書時間をどうぞ．`;
  }
  function cover(work,index,big){
    const palette=palettes[work.group]||palettes['ファンタジー'];
    const box=el('div',big?'result-visual':'shelf-art');
    box.style.setProperty('--a',palette[0]);box.style.setProperty('--b',palette[1]);
    box.append(el('span',big?'cover-sigil':'',palette[2]));
    if(big)box.append(el('span','cover-num',`STORY ${String(index+1).padStart(2,'0')}`));
    box.setAttribute('aria-hidden','true');
    return box;
  }
  function bookLink(work,linkClass,label){
    const a=el('a',linkClass,label);a.href=work.url;a.target='_blank';a.rel='noopener noreferrer';
    a.setAttribute('aria-label',`${work.title} を小説家になろうで読む（新しいタブ）`);return a;
  }
  // Ranking positions remain in the hand-edited dataset, but are deliberately
  // hidden in public cards until each source has been audited independently.
  function rankText(work){return work.length;}
  function card(work,i){
    const box=el('article','result-card');
    box.append(cover(work,i,true));
    const info=el('div','card-kicker');info.append(el('span','',work.genre));
    const rank=el('strong','',rankText(work));
    info.append(rank);box.append(info);
    box.append(el('h3','',work.title));box.append(el('p','book-author',work.author));
    box.append(el('p','book-reason',reasonFor(work)));
    const tags=el('div','book-tags');for(const tag of work.tags.slice(0,3))tags.append(el('span','tag','#'+tag));
    box.append(tags);box.append(bookLink(work,'card-link','小説を読む　↗'));
    return box;
  }
  function resultUrl(){
    const u = new URL(window.location.href);
    ['sign','mood','group','length','motif'].forEach(key=>u.searchParams.set(key,state.answers[key]));
    u.searchParams.set('turn',String(state.reroll));u.hash='results';return u.toString();
  }
  function showResults(scroll=true){
    state.results=selectBooks();
    const area=$('#results-grid');area.replaceChildren(...state.results.map(card));
    const {sign,mood}=state.answers;
    $('#results-intro').textContent=`${sign}の今日に似合う，${mood}の気分へ寄り添う物語です．`;
    $('#results').hidden=false;
    try{history.replaceState(null,'',resultUrl());}catch(e){}
    if(scroll)$('#results').scrollIntoView({behavior:'smooth',block:'start'});
  }
  $('#shuffle').addEventListener('click',()=>{state.reroll++;showResults(false);$('#results').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#restart').addEventListener('click',()=>{state.step=0;state.reroll=0;$('#results').hidden=true;drawStep();$('#reading').scrollIntoView({behavior:'smooth'});});
  $('#share').addEventListener('click',async()=>{
    const titles=state.results.map((w,i)=>`${i+1}. ${w.title}`).join('\n');
    const message=`今日の私におすすめの3つの物語 ✦\n${titles}\n\n${resultUrl()}`;
    if(navigator.share){try{await navigator.share({title:'星と余白｜今夜の3冊',text:message,url:resultUrl()});return;}catch(e){if(e.name==='AbortError')return;}}
    try{await navigator.clipboard.writeText(message);toast('診断結果をコピーしました．');}
    catch(e){window.prompt('診断結果をコピーしてください',message);}
  });
  let toastId=0;
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');const id=++toastId;setTimeout(()=>{if(id===toastId)t.classList.remove('show')},2800);}
  // Browse/search is performed entirely in the user's browser on a hand-edited static list.
  const genreFilter=$('#genre-filter');
  [...new Set(works.map(w=>w.genre))].sort((a,b)=>a.localeCompare(b,'ja')).forEach(g=>{
    const op=el('option','',g);op.value=g;genreFilter.append(op);
  });
  let shown=12;
  const normalized=s=>safeText(s).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  function drawShelf(){
    const q=normalized($('#search-input').value);const genre=genreFilter.value;
    const list=works.filter(w=>(genre==='all'||w.genre===genre)&&(!q||normalized(`${w.title} ${w.author} ${w.tags.join(' ')} ${w.id}`).includes(q)));
    $('#shelf-info').textContent=`${list.length} 作品`;
    $('#shelf-count').textContent=`${works.length} STORIES`;
    const grid=$('#shelf-grid');grid.replaceChildren();
    if(!list.length)grid.append(el('div','empty','該当する作品がありません．別の言葉で探してみてください．'));
    for(let i=0;i<Math.min(list.length,shown);i++){
      const w=list[i],item=el('article','shelf-item');item.append(cover(w,i,false));
      const data=el('div','shelf-data');data.append(el('h3','',w.title));
      data.append(el('p','',`${w.author}　｜　${w.genre}`));
      data.append(el('div','micro-tags',w.tags.slice(0,3).map(t=>'#'+t).join('　')));
      item.append(data,bookLink(w,'shelf-arrow','↗'));grid.append(item);
    }
    $('#show-more').hidden=list.length<=shown;
  }
  $('#search-input').addEventListener('input',()=>{shown=12;drawShelf();});
  genreFilter.addEventListener('change',()=>{shown=12;drawShelf();});
  $('#show-more').addEventListener('click',()=>{shown+=12;drawShelf();});
  drawStep();drawShelf();
  // Shared result links open a reproducible diagnosis without storing any user data.
  try {
    const q=new URLSearchParams(location.search);
    if(steps.every(s=>s.options.some(o=>o[0]===q.get(s.key)))){
      steps.forEach(s=>{state.answers[s.key]=q.get(s.key)});
      const nr=Number(q.get('turn'));
      state.reroll=Number.isInteger(nr)&&nr>=0&&nr<10000?nr:0;
      state.step=4;drawStep();showResults(false);
    }
  }catch(e){/* regular home page remains usable */}
})();

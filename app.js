/* Poképaper: client-only editor. No user data leaves the browser. */
const $=id=>document.getElementById(id);
const state={pokemon:null,form:0,shiny:false,view:'front',gender:'default',style:'auto',game:'auto',background:'adaptive',animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,texture:true,shadow:true,label:true,size:100,format:'desktop',width:1920,height:1080,solid:'#efdcb5',posX:.5,posY:null,moveMode:false,exportType:'png'};
const canvas=$('wallpaper'),ctx=canvas.getContext('2d');
const presets=[
 {id:'adaptive',name:'Adaptive',colors:['#f1c59d','#fff0d2']},
 {id:'meadow',name:'Meadow',colors:['#d5e8d3','#abc488']},
 {id:'dusk',name:'Dusk',colors:['#e4b1a1','#89788e']},
 {id:'ocean',name:'Ocean',colors:['#c7e6e7','#72a8b7']},
 {id:'midnight',name:'Midnight',colors:['#303e4e','#556879']},
 {id:'solid',name:'Solid color',colors:['#efdcb5','#efdcb5']}
];
const formats={desktop:[{w:1920,h:1080,label:'1920 × 1080 · Full HD'},{w:2560,h:1440,label:'2560 × 1440 · QHD'},{w:3840,h:2160,label:'3840 × 2160 · 4K'}],phone:[{w:1080,h:1920,label:'1080 × 1920 · Full HD'},{w:1440,h:2560,label:'1440 × 2560 · QHD'},{w:1290,h:2796,label:'1290 × 2796 · Tall phone'}],square:[{w:1080,h:1080,label:'1080 × 1080 · Square'},{w:2048,h:2048,label:'2048 × 2048 · High res'}]};
let pokemon=[],catalog=null,raf=0,lastDraw=0,noticeTimer,adaptive=['#efbf95','#fff0d5'];
let exportJob=null,drag=null,layers=[],selectedLayerId=null,nextLayerId=1,addingPokemon=false,lastDeleted=null;
const spriteKeys=['pokemon','form','shiny','view','gender','style','game','animate','shadow','size','posX','posY'];
const spriteDefaults=Object.fromEntries(spriteKeys.map(key=>[key,state[key]]));
function activeLayer(){return layers.find(layer=>layer.id===selectedLayerId)||null}
for(const key of spriteKeys)Object.defineProperty(state,key,{get:()=>activeLayer()?.settings[key]??spriteDefaults[key],set:value=>{if(activeLayer())activeLayer().settings[key]=value}});
function makeLayer(settings={}){
 return {id:nextLayerId++,settings:{...spriteDefaults,...settings},runtime:{sprite:null,frozen:null,ready:false,failed:false,token:0,decoder:null,frame:null,index:0,count:1,nextAt:0,decoding:false,animated:false,bytes:null,mime:null,animationTask:Promise.resolve(),color:null,source:''}};
}
function sceneReady(){return layers.every(layer=>layer.runtime.ready)}
function animatedLayers(){return layers.filter(layer=>layer.settings.animate&&layer.runtime.animated)}
const failedAutoSources=new Set();
function icons(){window.lucide?.createIcons()}
function tell(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),3200)}
function activeForm(layer=activeLayer()){return layer?.settings.pokemon?.forms[layer.settings.form]}
function availableGames(layer=activeLayer()){
 const f=activeForm(layer);
 return (catalog?.gameSources||[]).filter(game=>f?.games?.[game.id]?.front_default);
}
function assetCandidates(layer=activeLayer()){
 const f=activeForm(layer);if(!f)return[];const s=layer.settings;
 const games=availableGames(layer).filter(game=>s.game==='auto'||s.game===game.id).map(game=>({style:'game',key:game.id,name:game.name,set:f.games[game.id]}));
 const art={style:'art',key:'art',set:f.art||{}};
 const pixel={style:'pixel',key:'pixel',set:{...f.classic,...Object.fromEntries(Object.entries(f.pixel||{}).filter(([k,v])=>typeof v==='string'&&v))}};
 if(s.style==='game'||(s.style==='auto'&&s.game!=='auto'))return games;
 if(s.style==='art')return[art];
 if(s.style==='pixel')return[pixel];
 return [...games,art,pixel];
}
function resolvedAsset(layer=activeLayer()){
 const s=layer?.settings||spriteDefaults,candidates=assetCandidates(layer).filter(c=>c.set.front_default);
 const auto=(s.style==='auto'||s.style==='game')&&s.game==='auto';
 return candidates.find(c=>!auto||!failedAutoSources.has(c.set.front_default))||{style:s.style==='auto'?'game':s.style,key:'',set:{}};
}
function assetStyle(layer=activeLayer()){return resolvedAsset(layer).style}
function assetSet(layer=activeLayer()){return resolvedAsset(layer).set}
function keyFor(shiny=state.shiny,view=state.view,gender=state.gender){return view+'_'+(shiny?'shiny':'default')+(gender==='female'?'_female':'')}
function lookup(shiny=state.shiny,view=state.view,gender=state.gender){
 const set=assetSet();const key=keyFor(shiny,view,gender).replace('_default_female','_female');
 return set[key]||null;
}
function getSource(layer=activeLayer()){
 const f=activeForm(layer);if(!f)return null;const s=layer.settings,key=keyFor(s.shiny,s.view,s.gender).replace('_default_female','_female');
 if(assetStyle(layer)==='pixel'){const set=f.pixel.animated||{};if(set[key])return set[key]}
 const url=assetSet(layer)[key];
 if(resolvedAsset(layer).key==='sword-shield'&&f.id===6&&!s.shiny&&s.view==='front'&&s.gender==='default')return 'assets/test.webp';
 return url;
}
function searchKey(value){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/♀/g,'f').replace(/♂/g,'m').replace(/[^a-z0-9]/g,'')}
function filteredPokemon(){
 const query=searchKey($('search').value);
 const type=$('type-filter').value;
 const generation=$('generation-filter').value;
 return pokemon.filter(p=>(!query||searchKey(p.name).includes(query)||searchKey(p.slug).includes(query)||String(p.id).padStart(3,'0').includes(query))&&(type==='all'||p.types.includes(type))&&(generation==='all'||p.generation===Number(generation)));
}
function renderPicker(){
 const filtered=filteredPokemon();
 $('pokemon-grid').innerHTML=filtered.length?filtered.map(p=>`<button class="pokemon-card ${p.id===state.pokemon?.id?'selected':''}" data-id="${p.id}" data-testid="pokemon-${p.id}" aria-label="${p.name}, number ${p.id}" aria-pressed="${p.id===state.pokemon?.id}"><span class="dex-number">${String(p.id).padStart(3,'0')}</span><img src="assets/${p.id}.png" alt="" width="57" height="57" loading="lazy"><span class="pokemon-card-name">${p.name}</span></button>`).join(''):`<div class="empty-message">No partners found.<br>Try a name, number, or another type.<button id="clear-search" data-testid="button-clear-search">Reset your Pokédex</button></div>`;
 $('result-count').textContent=filtered.length+' Pokémon';
 $('pokemon-grid').querySelectorAll('img').forEach(img=>img.onerror=()=>{img.style.opacity='.25';img.removeAttribute('src')});
 $('clear-search')?.addEventListener('click',()=>{$('search').value='';$('type-filter').value='all';$('generation-filter').value='all';renderPicker()});
}
function updateDetails(){
 const p=state.pokemon,f=activeForm();
 document.querySelector('.pokemon-details').hidden=!p;
 if(!p){animationControls();syncPosition();renderLayers();return}
 $('pokemon-name').textContent=p.name;
 $('dex-id').textContent='NO. '+String(p.id).padStart(3,'0')+' · GEN '+(catalog.generations.find(g=>g.id===p.generation)?.name||p.generation)+' · '+p.region.toUpperCase();
 $('selected-icon').src='assets/'+p.id+'.png';
 $('type-badges').innerHTML=f.types.map(t=>`<span class="type-badge ${t}">${t}</span>`).join('');
 $('form-select').innerHTML=p.forms.map((f,i)=>`<option value="${i}">${f.name}</option>`).join('');
 $('form-select').value=String(state.form);
 $('form-caption').textContent=f.name;
 $('form-caption').hidden=f.name==='Standard';
 $('form-select').title=f.name;
 updateAvailability();
 $('shadow').checked=state.shadow;$('sprite-size').value=state.size;$('size-value').value=state.size+'%';
 animationControls();syncPosition();renderLayers();
}
function updateAvailability(){
 const games=availableGames();
 if(state.game!=='auto'&&!games.some(game=>game.id===state.game))state.game='auto';
 $('game-source').innerHTML='<option value="auto">Auto · available game</option>'+games.map(game=>`<option value="${game.id}">${game.name}</option>`).join('');
 $('game-source').value=state.game;
 $('game-source-row').hidden=!['auto','game'].includes(state.style);
 $('game-source').disabled=games.length===0;
 const style=assetStyle();
 if(style==='art'){state.view='front';state.gender='default'}
 const set=assetSet();
 const available=(view,gender,shiny)=>!!set[keyFor(shiny,view,gender).replace('_default_female','_female')];
 if(!available(state.view,state.gender,state.shiny)&&available('front','default',state.shiny)){state.view='front';state.gender='default'}
 if(!available(state.view,state.gender,state.shiny)&&available('front','default',false)){state.shiny=false;state.view='front';state.gender='default'}
 $('normal').disabled=!available(state.view,state.gender,false);
 $('shiny').disabled=!available(state.view,state.gender,true);
 $('normal').classList.toggle('active',!state.shiny);$('normal').setAttribute('aria-pressed',String(!state.shiny));
 $('shiny').classList.toggle('active',state.shiny);$('shiny').setAttribute('aria-pressed',String(state.shiny));
 [...$('view-select').options].forEach(o=>o.disabled=!available(o.value,state.gender,state.shiny));
 $('view-select').value=state.view;$('view-select').disabled=style==='art'||!available('back',state.gender,state.shiny);
 $('gender-select').value=state.gender;
 $('gender-select').options[1].disabled=!available(state.view,'female',state.shiny);
 $('gender-select').disabled=!available(state.view,'female',state.shiny);
 $('style-select').value=state.style;
 const pixelAnimated=style==='pixel'&&!!activeForm().pixel.animated?.[keyFor().replace('_default_female','_female')];
 const source=resolvedAsset();
 const gameCredit=source.key==='sword-shield'?'Sword & Shield · game-model renders by FallenDeity / PokéAPI':source.key==='home'?'Pokémon HOME · archived render / PokéAPI':source.name+' · archived game-model render / PokéAPI';
 let credit=style==='game'?gameCredit:style==='pixel'?activeForm().pixelCredit+' / PokéAPI · '+(pixelAnimated?'animated':'still image'):'Official Pokémon artwork / PokéAPI · still image';
 if(state.style==='auto'&&state.game==='auto')credit='Auto · '+credit;
 if(!lookup()){credit='No '+(style==='game'?'game-render':style==='pixel'?'pixel':'artwork')+' asset for this form. Choose Auto or another asset style.'}
 $('asset-credit').textContent=credit;$('asset-credit').classList.toggle('warning',!lookup());
}
function choosePokemon(id){
 if(exportJob)return;
 if(addingPokemon||!activeLayer()){
  const slot=layers.length,positions=[[.5,.4],[.75,.4],[.25,.4],[.5,.62],[.2,.62],[.8,.62]];
  const layer=makeLayer({pokemon:pokemon.find(p=>p.id===id)||pokemon[5],size:slot?70:100,posX:positions[slot%positions.length][0],posY:slot?positions[slot%positions.length][1]:null});
  layers.push(layer);selectedLayerId=layer.id;addingPokemon=false;
 }
 state.pokemon=pokemon.find(p=>p.id===id)||pokemon[5];state.form=0;state.gender='default';state.view='front';
 renderPicker();updateDetails();loadSprite();
}
function selectLayer(id){
 if(exportJob)return;const layer=layers.find(l=>l.id===id);if(!layer)return;
 selectedLayerId=id;addingPokemon=false;renderPicker();updateDetails();draw();
}
function renderLayers(){
 $('sprite-count').textContent=layers.length+' sprite'+(layers.length===1?'':'s');
 $('sprite-list').innerHTML=layers.length?layers.map((layer,index)=>{
  const s=layer.settings,f=activeForm(layer),selected=layer.id===selectedLayerId;
  return `<button class="sprite-chip" data-layer-id="${layer.id}" data-testid="select-layer-${layer.id}" aria-pressed="${selected}" aria-label="Select sprite ${index+1}: ${s.pokemon.name}, ${f.name}" ${exportJob?'disabled':''}><img src="assets/${s.pokemon.id}.png" alt=""><span>${index+1}. ${s.pokemon.name}<small>${f.name}${s.shiny?' · Shiny':''}</small></span></button>`;
 }).join(''):'<p class="empty-canvas-note">Your canvas is clear. Choose a Pokémon to start again.</p>';
 $('add-pokemon').textContent=addingPokemon?'Cancel adding':'＋ Add Pokémon';
 $('add-pokemon').setAttribute('aria-pressed',String(addingPokemon));
 $('sprite-hint').textContent=addingPokemon?'Choose a Pokémon in the Pokédex to add.':layers.length?'The picker edits your selected sprite.':'Add a Pokémon, or export just your background.';
 $('undo-delete').hidden=!lastDeleted;
 const index=layers.findIndex(l=>l.id===selectedLayerId);
 $('duplicate-pokemon').disabled=!!exportJob||index<0;
 $('delete-pokemon').disabled=!!exportJob||index<0;
 $('layer-backward').disabled=!!exportJob||index<=0;
 $('layer-forward').disabled=!!exportJob||index<0||index===layers.length-1;
 $('add-pokemon').disabled=!!exportJob||!pokemon.length;
 $('undo-delete').disabled=!!exportJob;
 $('shadow').disabled=!activeLayer()||!!exportJob;$('sprite-size').disabled=!activeLayer()||!!exportJob;
 icons();updateSceneControls();
}
function duplicateLayer(){
 if(!activeLayer()||exportJob)return;const s=activeLayer().settings;
 const layer=makeLayer({...s,posX:s.posX>.88?s.posX-.07:s.posX+.07,posY:Math.min(.95,positionY()+.06)});
 layers.push(layer);selectedLayerId=layer.id;addingPokemon=false;
 renderPicker();updateDetails();loadSprite();
}
function deleteLayer(){
 if(!activeLayer()||exportJob)return;const index=layers.findIndex(l=>l.id===selectedLayerId),layer=layers[index];
 lastDeleted={id:layer.id,index,settings:{...layer.settings}};disposeAnimation(layer);layer.runtime.token++;
 layers.splice(index,1);selectedLayerId=layers[Math.min(index,layers.length-1)]?.id??null;drag=null;
 if(!layers.length)setMoveMode(false);
 renderPicker();updateDetails();refreshPalette();draw();
}
function undoDelete(){
 if(!lastDeleted||exportJob)return;const layer=makeLayer(lastDeleted.settings);layer.id=lastDeleted.id;
 layers.splice(Math.min(lastDeleted.index,layers.length),0,layer);selectedLayerId=layer.id;lastDeleted=null;
 updateDetails();renderPicker();loadSprite();
}
function reorderLayer(delta){
 if(exportJob)return;const index=layers.findIndex(l=>l.id===selectedLayerId),to=index+delta;
 if(index<0||to<0||to>=layers.length)return;
 [layers[index],layers[to]]=[layers[to],layers[index]];renderLayers();draw();
}
function updateSceneControls(){
 if(exportJob)return;
 $('download').disabled=!sceneReady();$('move-mode').disabled=!activeLayer()?.runtime.ready;
 $('canvas-loading').hidden=!layers.some(l=>!l.runtime.ready&&!l.runtime.failed);
 updateExportInfo(false);
}
function selectShiny(value){state.shiny=value;updateAvailability();loadSprite()}
function mix(a,b,t){return a.map((v,i)=>Math.round(v*(1-t)+b[i]*t))}
function rgbHex(a){return '#'+a.map(v=>v.toString(16).padStart(2,'0')).join('')}
function extractPalette(image,layer){
 try{
 const c=document.createElement('canvas');c.width=64;c.height=64;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0,64,64);
 const data=g.getImageData(0,0,64,64).data,bins=new Map();
 for(let i=0;i<data.length;i+=4){
 const rgb=[data[i],data[i+1],data[i+2]],max=Math.max(...rgb),min=Math.min(...rgb);
 if(data[i+3]<200||max<55||min>225||max-min<25)continue;
 const key=rgb.map(v=>Math.round(v/32)*32).join(',');
 const old=bins.get(key)||{n:0,sum:[0,0,0]};old.n++;rgb.forEach((v,j)=>old.sum[j]+=v);bins.set(key,old);
 }
 const best=[...bins.values()].sort((a,b)=>b.n-a.n)[0];
 layer.runtime.color=best?best.sum.map(v=>Math.round(v/best.n)):[160,155,140];
 refreshPalette();
 }catch(e){layer.runtime.color=[160,155,140];refreshPalette()}
}
function refreshPalette(){
 const colors=layers.filter(l=>l.runtime.ready&&l.runtime.color).map(l=>l.runtime.color);
 const primary=colors.length?[0,1,2].map(i=>Math.round(colors.reduce((sum,c)=>sum+c[i],0)/colors.length)):[160,155,140];
 const warm=[255,247,224];
 adaptive=[rgbHex(mix(primary,warm,.55)),rgbHex(mix(primary,warm,.91))];
 const palette=[.24,.5,.75,.93].map(t=>rgbHex(mix(primary,warm,t)));
 document.querySelectorAll('#mini-colors b').forEach((el,i)=>el.style.background=palette[i]);
 document.querySelector('.swatch-adaptive').style.background=`linear-gradient(145deg,${adaptive[0]},${adaptive[1]})`;
}
function animationControls(){
 const available=!!activeLayer()?.runtime.animated;
 $('animate').disabled=!!exportJob||!available;
 $('animate').checked=state.animate&&available;
 $('pause').disabled=!!exportJob||!available;
 $('pause').innerHTML=`<i data-lucide="${state.animate&&available?'pause':'play'}"></i>`;
 $('pause').setAttribute('aria-label',!available?'Animation unavailable for this asset':state.animate?'Pause sprite animation':'Play sprite animation');
 $('pause').title=!available?'Still image':state.animate?'Pause animation':'Play animation';
 icons();
 updateExportInfo(false);
}
function disposeAnimation(layer){
 const r=layer.runtime;r.frame?.close();r.frame=null;
 try{r.decoder?.close()}catch(e){}
 r.decoder=null;r.bytes=null;r.mime=null;r.index=0;r.count=1;r.decoding=false;r.nextAt=0;r.animated=false;
}
async function decodeNextFrame(layer,token=layer.runtime.token){
 const r=layer.runtime;
 if(!r.decoder||r.decoding||!r.animated)return;
 r.decoding=true;
 try{
  const frame=await r.decoder.decode({frameIndex:r.index,completeFramesOnly:true});
  if(token!==r.token||!layers.includes(layer)){frame.image.close();return}
  r.frame?.close();r.frame=frame.image;
  r.index=(r.index+1)%r.count;
  r.nextAt=performance.now()+Math.max(20,(frame.image.duration||41667)/1000);
  draw();
 }catch(e){if(token===r.token){r.animated=false;if(layer===activeLayer())animationControls()}}
 finally{if(token===r.token)r.decoding=false}
}
async function prepareAnimation(layer,source,token){
 const r=layer.runtime;
 const update=()=>{if(layer===activeLayer())animationControls();updateExportInfo(false)};
 if(!/\.(webp|gif)(\?|$)/i.test(source)){update();return}
 if(typeof ImageDecoder==='undefined'){
  if(layer===activeLayer())$('asset-credit').textContent+=' · This browser supports still previews only';update();return;
 }
 try{
  const response=await fetch(source);if(!response.ok)return;
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(token!==r.token||!layers.includes(layer))return;
  const d=new ImageDecoder({data:bytes,type:/\.gif/i.test(source)?'image/gif':'image/webp'});
  await d.tracks.ready;
  if(token!==r.token||!layers.includes(layer)){d.close();return}
  r.decoder=d;r.bytes=bytes;r.mime=/\.gif/i.test(source)?'image/gif':'image/webp';r.count=d.tracks.selectedTrack.frameCount;r.animated=r.count>1;
  update();
  if(r.animated){await decodeNextFrame(layer,token);schedule()}
 }catch(e){if(token===r.token){r.animated=false;update();if(layer===activeLayer())$('asset-credit').textContent+=' · Still preview; animation could not be decoded'}}
}
async function loadSprite(layer=activeLayer()){
 if(!layer)return;const r=layer.runtime,s=layer.settings,token=++r.token;r.ready=false;r.failed=false;r.sprite=null;r.frozen=null;
 disposeAnimation(layer);r.animationTask=Promise.resolve();
 updateSceneControls();if(layer===activeLayer())animationControls();
 const source=getSource(layer);r.source=source||'';
 const sourcePrimary=assetSet(layer).front_default;
 renderLayers();
 if(!source){r.failed=true;updateSceneControls();draw();return}
 const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
 image.onload=()=>{
 if(token!==r.token||!layers.includes(layer))return;
 r.sprite=image;r.frozen=document.createElement('canvas');r.frozen.width=image.naturalWidth;r.frozen.height=image.naturalHeight;
 try{r.frozen.getContext('2d').drawImage(image,0,0)}catch(e){r.frozen=null}
 r.ready=true;extractPalette(image,layer);updateSceneControls();
 updateExportInfo();$('export-note').classList.remove('error');
 draw();r.animationTask=prepareAnimation(layer,source,token);
 };
 image.onerror=()=>{
  if(token!==r.token||!layers.includes(layer))return;
  if(['auto','game'].includes(s.style)&&s.game==='auto'){
   failedAutoSources.add(sourcePrimary);
   if(getSource(layer)&&getSource(layer)!==source){if(layer===activeLayer())updateAvailability();loadSprite(layer);return}
  }
  r.failed=true;updateSceneControls();
  if(layer===activeLayer()){$('asset-credit').textContent='This archived asset could not load. Try another form or asset style.';$('asset-credit').classList.add('warning')}
  tell(s.pokemon.name+' could not load. Change its source or delete this sprite to export.');draw();
 };
 image.src=source;
 draw();
}
function rand(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)}
function pixelStar(g,x,y,s,color){g.fillStyle=color;g.fillRect(x-s/2,y-2*s,s,s*4);g.fillRect(x-2*s,y-s/2,s*4,s)}
function drawScene(g,w,h){
 const preset=presets.find(p=>p.id===state.background);
 let colors=state.background==='adaptive'?adaptive:state.background==='solid'?[state.solid,state.solid]:preset.colors;
 const gradient=g.createLinearGradient(0,0,w*.2,h);gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);g.fillStyle=gradient;g.fillRect(0,0,w,h);
 const night=state.background==='midnight',unit=Math.max(3,Math.round(Math.min(w,h)/100));
 if(['meadow','dusk','ocean','midnight'].includes(state.background)){
  const schemes={meadow:['#a2bf8b','#8da975','#c0d49d'],dusk:['#c49b9e','#9e8597','#847a91'],ocean:['#97c4cd','#78a8b8','#a0cbd1'],midnight:['#465966','#3d515d','#354b54']};
  const cs=schemes[state.background];
  for(let layer=0;layer<3;layer++){
   g.fillStyle=cs[layer];const step=w/24;
   for(let i=0;i<24;i++){const top=Math.floor((h*(.65+layer*.075)+rand(i+layer*15)*h*.08)/unit)*unit;g.fillRect(Math.floor(i*step),top,Math.ceil(step),h-top)}
  }
  if(state.background==='ocean'){g.fillStyle='#d7ecdf88';for(let i=0;i<17;i++){const x=rand(i+4)*w,y=h*(.73+rand(i+54)*.21);g.fillRect(Math.round(x/unit)*unit,Math.round(y/unit)*unit,unit*(2+Math.round(rand(i+12)*6)),unit)}}
 }
 if(state.texture){
  g.fillStyle=night?'#e3ead906':'#65593e09';
  const grid=Math.max(3,Math.round(w/240));
  for(let x=0;x<w;x+=grid*2)for(let y=0;y<h;y+=grid*2){if(rand(x+y*3)>.35)g.fillRect(x,y,Math.max(1,grid/4),Math.max(1,grid/4))}
 }
 const stars=night?22:7;
 for(let i=0;i<stars;i++){
  const x=w*(.08+rand(i+73)*.84),y=h*(.09+rand(i+196)*.66);
  if(Math.abs(x-w*.5)<w*.15&&Math.abs(y-h*.45)<h*.2)continue;
  if(i%3===0)pixelStar(g,Math.round(x/unit)*unit,Math.round(y/unit)*unit,unit*.7,night?'#fff0c080':'#fff9e7aa');
  else{g.fillStyle=night?'#f5e9b873':'#fffbec9c';g.fillRect(Math.round(x/unit)*unit,Math.round(y/unit)*unit,unit,unit)}
 }
}
function spacedText(g,text,x,y,spacing,align='center'){
 const widths=[...text].map(c=>g.measureText(c).width);const width=widths.reduce((a,b)=>a+b,0)+spacing*(text.length-1);
 let left=align==='center'?x-width/2:x;
 [...text].forEach((c,i)=>{g.fillText(c,left,y);left+=widths[i]+spacing});
}
function spriteBounds(w,h,image,layer=activeLayer()){
 const s=layer.settings;
 const phone=h/w>1.3;
 let sz=Math.min(w*.67,h*.66)*(s.size/100);
 if(phone)sz=w*.95*(s.size/100);
 if(assetStyle(layer)==='pixel')sz*=.8;
 const ratio=(image.displayWidth||image.width)/(image.displayHeight||image.height)||1;
 return {sz,iw:ratio>=1?sz:sz*ratio,ih:ratio>=1?sz/ratio:sz,cx:w*s.posX,cy:h*(s.posY??(phone?.43:.4))};
}
function renderWallpaper(g,w,h,overrides=null){
 g.clearRect(0,0,w,h);drawScene(g,w,h);
 const phone=h/w>1.3,night=state.background==='midnight';
 const ink=night?'#f7edcf':'#575641';
 for(const layer of layers){
 const s=layer.settings,r=layer.runtime;
 const image=overrides?.get(layer.id)||(s.animate?(r.frame||r.sprite):r.frozen);
 if(image&&r.ready){
  const {sz,iw,ih,cx,cy}=spriteBounds(w,h,image,layer);
  g.save();
  if(s.shadow){
   g.fillStyle=night?'#17272b30':'#7a66521c';
   const sy=cy+sz*.34,sw=sz*.35,sh=Math.max(4,h*.012);
   g.fillRect(cx-sw*.44,sy-sh,sw*.88,sh*2);g.fillRect(cx-sw*.5,sy-sh*.5,sw,sh);
  }
  g.imageSmoothingEnabled=assetStyle(layer)!=='pixel';
  g.drawImage(image,cx-iw/2,cy-ih/2,iw,ih);g.restore();
 }else if(r.failed&&layer===activeLayer()){
  g.fillStyle=ink;g.textAlign='center';g.font=`500 ${Math.max(18,w*.035)}px "DM Sans", sans-serif`;
  g.fillText('This form is not in this asset collection.',w*.5,h*.45);
  g.font=`400 ${Math.max(14,w*.022)}px "DM Sans", sans-serif`;g.fillText('Choose another asset style below.',w*.5,h*.51);
 }
 }
 if(state.label&&layers.length){
  const p=layers[0].settings.pokemon;
  g.fillStyle=ink;g.textAlign='left';
  const small=phone?w*.025:w*.013;
  g.font=`500 ${small}px "DM Sans", sans-serif`;
  spacedText(g,'NATIONAL POKÉDEX',w*.055,h*.075,small*.12,'left');
  g.textAlign='right';g.fillText(layers.length===1?'NO. '+String(p.id).padStart(3,'0'):layers.length+' POKÉMON',w*.945,h*.075);
  g.textAlign='left';g.fillStyle=ink;
  const name=layers.length===1?p.name.toUpperCase():'POKÉMON PARTY',size=Math.min(w*(phone?.09:.06),h*.083);
  g.font=`500 ${size}px "Pixelify Sans", monospace`;
  spacedText(g,name,w*.5,h*(phone?.79:.83),size*.12);
  g.globalAlpha=.7;g.font=`500 ${small*1.1}px "DM Sans", sans-serif`;
  const f=activeForm(layers[0]),settings=layers[0].settings;
  const info=layers.length===1?f.types.join(' / ').toUpperCase()+(settings.shiny?'  ·  SHINY':'')+(f.name!=='Standard'?'  ·  '+f.name.toUpperCase():''):layers.slice(0,3).map(l=>l.settings.pokemon.name.toUpperCase()).join(' + ')+(layers.length>3?' + MORE':'');
  const infoWidth=[...info].reduce((sum,c)=>sum+g.measureText(c).width+small*.15,0);
  if(infoWidth>w*.88)g.font=`500 ${small*1.1*w*.88/infoWidth}px "DM Sans", sans-serif`;
  spacedText(g,info,w*.5,h*(phone?.825:.88),small*.15);
  g.globalAlpha=1;
  const bx=w*.5,by=h*.94,s=w*.0018;
  g.fillStyle=night?'#d7d6ba88':'#85847077';g.fillRect(bx-s*6,by,s*3,s*3);g.fillRect(bx-s,by,s*3,s*3);g.fillRect(bx+s*4,by,s*3,s*3);
 }
}
function draw(){
 renderWallpaper(ctx,canvas.width,canvas.height);
 const r=activeLayer()?.runtime;
 if(state.moveMode&&r?.sprite&&r.ready){
  const {iw,ih,cx,cy}=spriteBounds(canvas.width,canvas.height,r.sprite);
  const line=Math.max(2,canvas.width/650);
  ctx.save();ctx.strokeStyle='#ab4539';ctx.lineWidth=line;ctx.setLineDash([line*4,line*3]);
  ctx.strokeRect(cx-iw/2,cy-ih/2,iw,ih);ctx.setLineDash([]);
  ctx.fillStyle='#fff9e7';ctx.fillRect(cx-line*5,cy-line*5,line*10,line*10);
  ctx.strokeRect(cx-line*5,cy-line*5,line*10,line*10);ctx.restore();
 }
}
function positionY(){return state.posY??(state.height/state.width>1.3?.43:.4)}
function syncPosition(){
 $('position-x').value=Math.round(state.posX*100);
 $('position-y').value=Math.round(positionY()*100);
}
function setPosition(x,y){
 state.posX=Math.max(0,Math.min(1,x));state.posY=Math.max(0,Math.min(1,y));
 syncPosition();draw();
}
function setMoveMode(value){
 state.moveMode=value;$('move-mode').setAttribute('aria-pressed',String(value));
 $('move-mode').classList.toggle('active',value);$('position-panel').hidden=!value;$('move-badge').hidden=!value;
 canvas.classList.toggle('movable',value);
 canvas.setAttribute('aria-label',value?'Move Pokémon: drag, or use arrow keys to nudge. Shift moves faster.':'Live Pokémon wallpaper preview');
 syncPosition();draw();
}
function initPositionControls(){
 $('move-mode').addEventListener('click',()=>{setMoveMode(!state.moveMode);if(state.moveMode)canvas.focus({preventScroll:true})});
 $('reset-position').addEventListener('click',()=>{state.posX=.5;state.posY=null;syncPosition();draw()});
 for(const [id,axis] of [['position-x','x'],['position-y','y']]){
  $(id).addEventListener('input',e=>{
   if(e.target.value===''||!Number.isFinite(e.target.valueAsNumber))return;
   const value=Math.max(0,Math.min(100,e.target.valueAsNumber))/100;
   setPosition(axis==='x'?value:state.posX,axis==='y'?value:positionY());
  });
 }
 canvas.addEventListener('pointerdown',e=>{
  if(!state.moveMode||exportJob||e.button!==0)return;
  const bounds=canvas.getBoundingClientRect(),scale=Math.min(bounds.width/canvas.width,bounds.height/canvas.height);
  const x=(e.clientX-bounds.left-(bounds.width-canvas.width*scale)/2)/scale,y=(e.clientY-bounds.top-(bounds.height-canvas.height*scale)/2)/scale;
  const hit=[...layers].reverse().find(layer=>{
   if(!layer.runtime.ready)return false;
   const b=spriteBounds(canvas.width,canvas.height,layer.runtime.sprite,layer);
   if(x<b.cx-b.iw/2||x>b.cx+b.iw/2||y<b.cy-b.ih/2||y>b.cy+b.ih/2)return false;
   try{
    const source=layer.runtime.frozen,g=source.getContext('2d');
    return g.getImageData(Math.min(source.width-1,Math.floor((x-b.cx+b.iw/2)/b.iw*source.width)),Math.min(source.height-1,Math.floor((y-b.cy+b.ih/2)/b.ih*source.height)),1,1).data[3]>20;
   }catch{return true}
  });
  if(hit&&hit!==activeLayer())selectLayer(hit.id);
  if(!activeLayer()?.runtime.ready)return;
  e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  const rect=canvas.getBoundingClientRect(),displayScale=Math.min(rect.width/canvas.width,rect.height/canvas.height);
  drag={layerId:selectedLayerId,pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:state.posX,startY:positionY(),rect:{width:canvas.width*displayScale,height:canvas.height*displayScale}};
  canvas.classList.add('dragging');
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer||drag.layerId!==selectedLayerId)return;
  setPosition(drag.startX+(e.clientX-drag.x)/drag.rect.width,drag.startY+(e.clientY-drag.y)/drag.rect.height);
 });
 function endDrag(){drag=null;canvas.classList.remove('dragging')}
 canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
 canvas.addEventListener('keydown',e=>{
  if(!state.moveMode||!activeLayer()||exportJob||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();const step=e.shiftKey?.05:.005;
  setPosition(state.posX+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),positionY()+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));
 });
}
function schedule(){
 if(raf)return;
 const loop=t=>{raf=0;const animated=animatedLayers();if(animated.length&&!exportJob){for(const layer of animated)if(t>=layer.runtime.nextAt&&!layer.runtime.decoding)decodeNextFrame(layer);if(t-lastDraw>1000/24){draw();lastDraw=t}raf=requestAnimationFrame(loop)}};
 if(animatedLayers().length&&!exportJob)raf=requestAnimationFrame(loop);
}
function setAnimation(value){
 state.animate=value;animationControls();
 const r=activeLayer()?.runtime;
 if(!value&&r?.sprite&&r.ready){r.frozen=document.createElement('canvas');r.frozen.width=r.sprite.naturalWidth;r.frozen.height=r.sprite.naturalHeight;r.frozen.getContext('2d').drawImage(r.frame||r.sprite,0,0)}
 updateExportInfo();draw();schedule();
}
function setFormat(format){
 state.format=format;$('resolution').innerHTML=formats[format].map((r,i)=>`<option value="${i}">${r.label}</option>`).join('');
 document.querySelectorAll('[data-format]').forEach(b=>{const active=b.dataset.format===format;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 setResolution(0);
}
function setResolution(index){
 const r=formats[state.format][index];state.width=r.w;state.height=r.h;
 // Live preview is capped for performance. Export uses the full chosen resolution.
 const scale=Math.min(1,1600/r.w,1100/r.h);
 canvas.width=Math.round(r.w*scale);canvas.height=Math.round(r.h*scale);
 $('dimensions').textContent=r.w+' × '+r.h;
 $('ratio-tag').textContent=state.format==='square'?'1:1':state.format==='phone'?(index===2?'9:19.5':'9:16'):'16:9';
 const wrap=document.querySelector('.canvas-wrap');wrap.classList.toggle('phone',state.format==='phone');wrap.classList.toggle('square',state.format==='square');
 syncPosition();draw();
}
function setBackground(id){
 state.background=id;$('background-value').textContent=presets.find(p=>p.id===id).name;
 document.querySelectorAll('[data-bg]').forEach(b=>{const active=b.dataset.bg===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 $('solid-controls').hidden=id!=='solid';draw();
}
function updateExportInfo(note=true){
 const gif=state.exportType==='gif';
 $('gif-quality').hidden=!gif;
 $('download-label').textContent=gif?'Download GIF':'Download wallpaper';
 const animated=animatedLayers().length;
 $('gif-motion-note').textContent=animated>1?'All animated sprites · longest source loop; shorter loops repeat within it. Different loop lengths may reset at the repeat boundary.':animated?'One complete animation loop, with every sprite included.':'No animated sprites: exports a still scene GIF.';
 if(note&&!exportJob)$('export-note').textContent=gif?'GIF · Max quality · Full selected resolution':'PNG format · Full resolution · All yours';
}
function setExportLocked(job,locked){
 if(locked){
  job.controls=[...document.querySelectorAll('button,input,select')].filter(el=>el.id!=='cancel-export').map(el=>[el,el.disabled]);
  for(const [el] of job.controls)el.disabled=true;
 }else{
  for(const [el,disabled] of job.controls||[])el.disabled=disabled;
  animationControls();renderLayers();updateSceneControls();schedule();
 }
}
function cancelledError(){return new DOMException('Export cancelled','AbortError')}
function assertExport(job){if(job.cancelled)throw cancelledError()}
async function waitForExport(task,job){
 assertExport(job);
 let onAbort;
 try{
  return await Promise.race([task,new Promise((_,reject)=>{
   onAbort=()=>reject(cancelledError());
   job.abort.signal.addEventListener('abort',onAbort,{once:true});
  })]);
 }finally{job.abort.signal.removeEventListener('abort',onAbort)}
}
function exportProgress(done,total,label){
 const percent=Math.round(done/total*100);
 $('export-meter').value=percent;$('export-percent').value=percent+'%';
 $('export-progress-label').textContent=label;
}
function saveBlob(blob,extension){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 const name=layers.length===1?activeForm(layers[0]).slug+(layers[0].settings.shiny?'-shiny':''):layers.length?'party-'+layers.length:'background';
 a.href=url;a.download=`pokepaper-${name}-${state.width}x${state.height}.${extension}`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function encodeGif(job){
 $('export-progress').hidden=false;exportProgress(0,1,'Preparing maximum-quality GIF…');
 await waitForExport(Promise.all(layers.map(layer=>layer.runtime.animationTask)),job);assertExport(job);
 const response=await fetch('gif-worker.js',{signal:job.abort.signal});
 if(!response.ok)throw Error('The GIF encoder could not load. Please try again.');
 const workerCode=await response.text();assertExport(job);
 job.workerURL=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'}));
 job.worker=new Worker(job.workerURL);
 let messageId=0;
 const request=(type,fields={},transfer=[])=>new Promise((resolve,reject)=>{
  assertExport(job);const id=++messageId;
  job.rejectPending=reject;
  job.worker.onmessage=({data})=>{if(data.id!==id)return;job.rejectPending=null;data.type==='error'?reject(Error(data.message)):resolve(data)};
  job.worker.onerror=e=>{job.rejectPending=null;reject(Error(e.message||'The GIF encoder stopped. Try a smaller resolution.'))};
  job.worker.postMessage({id,type,...fields},transfer);
 });
 const out=document.createElement('canvas');out.width=state.width;out.height=state.height;
 const g=out.getContext('2d',{willReadFrequently:true});
 let total=1,encodedDuration=0,trackers=[];
 job.exportDecoders=[];
 try{
  for(const layer of animatedLayers()){
   const r=layer.runtime;if(!r.bytes)continue;
   const d=new ImageDecoder({data:r.bytes,type:r.mime});job.exportDecoders.push(d);
   await waitForExport(d.tracks.ready,job);assertExport(job);
   const durations=[];
   for(let index=0;index<d.tracks.selectedTrack.frameCount;index++){
    assertExport(job);const frame=await waitForExport(d.decode({frameIndex:index,completeFramesOnly:true}),job);
    durations.push(Math.max(10,(frame.image.duration||100000)/1000));frame.image.close();
   }
   const first=await waitForExport(d.decode({frameIndex:0,completeFramesOnly:true}),job);
   trackers.push({layer,decoder:d,durations,period:durations.reduce((a,b)=>a+b,0),index:0,next:durations[0],image:first.image});
  }
  const duration=trackers.length?Math.max(...trackers.map(t=>t.period)):100;
  // Merge source frame boundaries instead of resampling to a fixed FPS.
  let time=0,index=0;const events=[0];
  for(const tracker of trackers){let t=0,i=0;while(t<duration-.001){t+=tracker.durations[i++%tracker.durations.length];if(t<duration-.001)events.push(t)}}
  total=trackers.length?new Set(events.map(t=>Math.round(t*1000))).size:1;
  while(time<duration-.001){
    assertExport(job);
    const next=Math.min(duration,...trackers.map(t=>t.next));
    renderWallpaper(g,out.width,out.height,new Map(trackers.map(t=>[t.layer.id,t.image])));
    const rgba=g.getImageData(0,0,out.width,out.height).data;
    const target=Math.round(next/10)*10,delay=target-encodedDuration;
    if(delay>0){
     encodedDuration=target;
     exportProgress(index,total,`Encoding frame ${index+1} of up to ${total}…`);
     await request('frame',{rgba:rgba.buffer,width:out.width,height:out.height,delay},[rgba.buffer]);
     exportProgress(++index,total,`Encoded ${index} scene frames`);
    }
    time=next;
    if(time<duration-.001)for(const tracker of trackers)if(tracker.next<=time+.001){
     assertExport(job);tracker.image.close();tracker.image=null;
     tracker.index=(tracker.index+1)%tracker.durations.length;
     const frame=await waitForExport(tracker.decoder.decode({frameIndex:tracker.index,completeFramesOnly:true}),job);
     tracker.image=frame.image;tracker.next+=tracker.durations[tracker.index];
    }
  }
  assertExport(job);exportProgress(total,total,'Finishing your GIF…');
  const result=await request('finish');assertExport(job);
  return {blob:new Blob([result.bytes],{type:'image/gif'}),frames:index};
 }finally{
  for(const tracker of trackers)tracker.image?.close();
  for(const d of job.exportDecoders)try{d.close()}catch(e){}
  job.exportDecoders=[];out.width=1;out.height=1;
 }
}
async function download(){
 if(!sceneReady()||exportJob)return;
 const job={cancelled:false,abort:new AbortController()};
 exportJob=job;setExportLocked(job,true);$('export-note').classList.remove('error');
 $('export-note').textContent='Putting the last pixels in place…';
 try{
  await waitForExport(document.fonts.ready,job);assertExport(job);
  if(state.exportType==='gif'){
   const {blob,frames}=await encodeGif(job);assertExport(job);saveBlob(blob,'gif');
   $('export-note').textContent=`GIF ready · ${state.width} × ${state.height} · ${frames} frame${frames===1?'':'s'} · Max quality`;
  }else{
   const out=document.createElement('canvas');out.width=state.width;out.height=state.height;
   renderWallpaper(out.getContext('2d'),out.width,out.height);
   const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('Image could not be encoded')),'image/png'));
   assertExport(job);saveBlob(blob,'png');$('export-note').textContent='Your wallpaper is ready. Enjoy your Pokémon!';
  }
 }catch(e){
  if(job.cancelled||e.name==='AbortError'){$('export-note').textContent='Export cancelled. Your design is unchanged.'}
  else{$('export-note').textContent=e.message?.includes('GIF')?e.message:'Couldn’t export this asset. Try another asset style or a smaller resolution.';$('export-note').classList.add('error')}
 }finally{
  job.worker?.terminate();if(job.workerURL)URL.revokeObjectURL(job.workerURL);
  exportJob=null;setExportLocked(job,false);$('export-progress').hidden=true;
 }
}
function cancelExport(){
 const job=exportJob;if(!job)return;job.cancelled=true;job.abort.abort();
 job.worker?.terminate();job.rejectPending?.(cancelledError());
 for(const decoder of job.exportDecoders||[])try{decoder.close()}catch(e){}
}
function openAbout(){$('about-dialog').showModal()}
async function init(){
 icons();$('animate').checked=state.animate;
 initPositionControls();
 $('add-pokemon').addEventListener('click',()=>{addingPokemon=!addingPokemon;renderLayers();$('search').focus();$('search').scrollIntoView({block:'nearest',behavior:'smooth'})});
 $('duplicate-pokemon').addEventListener('click',duplicateLayer);
 $('delete-pokemon').addEventListener('click',deleteLayer);
 $('undo-delete').addEventListener('click',undoDelete);
 $('layer-backward').addEventListener('click',()=>reorderLayer(-1));
 $('layer-forward').addEventListener('click',()=>reorderLayer(1));
 $('sprite-list').addEventListener('click',e=>{const button=e.target.closest('[data-layer-id]');if(button)selectLayer(Number(button.dataset.layerId))});
 $('background-grid').innerHTML=presets.map(p=>`<button class="background-option ${p.id==='adaptive'?'active':''}" data-bg="${p.id}" aria-pressed="${p.id==='adaptive'}" data-testid="background-${p.id}"><span class="swatch swatch-${p.id}"></span>${p.name}</button>`).join('');
 $('background-grid').addEventListener('click',e=>{const b=e.target.closest('[data-bg]');if(b)setBackground(b.dataset.bg)});
 $('pokemon-grid').addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)choosePokemon(Number(b.dataset.id))});
 $('search').addEventListener('input',renderPicker);$('type-filter').addEventListener('change',renderPicker);$('generation-filter').addEventListener('change',renderPicker);
 $('form-select').addEventListener('change',()=>{state.form=Number($('form-select').value);state.view='front';state.gender='default';updateDetails();loadSprite()});
 $('normal').addEventListener('click',()=>selectShiny(false));$('shiny').addEventListener('click',()=>selectShiny(true));
 $('style-select').addEventListener('change',()=>{state.style=$('style-select').value;updateAvailability();loadSprite()});
 $('game-source').addEventListener('change',()=>{state.game=$('game-source').value;updateAvailability();loadSprite()});
 $('view-select').addEventListener('change',()=>{state.view=$('view-select').value;updateAvailability();loadSprite()});
 $('gender-select').addEventListener('change',()=>{state.gender=$('gender-select').value;updateAvailability();loadSprite()});
 $('animate').addEventListener('change',e=>setAnimation(e.target.checked));
 $('pause').addEventListener('click',()=>setAnimation(!state.animate));
 $('texture').addEventListener('change',e=>{state.texture=e.target.checked;draw()});
 $('shadow').addEventListener('change',e=>{state.shadow=e.target.checked;draw()});
 $('show-label').addEventListener('change',e=>{state.label=e.target.checked;draw()});
 $('sprite-size').addEventListener('input',e=>{state.size=Number(e.target.value);$('size-value').value=state.size+'%';draw()});
 $('solid-color').addEventListener('input',e=>{state.solid=e.target.value;draw();document.querySelector('.swatch-solid').style.background=state.solid});
 document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>setFormat(b.dataset.format)));
 $('resolution').addEventListener('change',e=>setResolution(Number(e.target.value)));
 $('export-format').addEventListener('change',e=>{state.exportType=e.target.value;updateExportInfo()});
 $('download').addEventListener('click',download);
 $('cancel-export').addEventListener('click',cancelExport);
 $('randomize').addEventListener('click',()=>{if(!pokemon.length)return;const options=filteredPokemon().filter(p=>p.id!==state.pokemon?.id);if(!options.length){tell('No other Pokémon match your filters. Broaden your search to explore.');return}choosePokemon(options[Math.floor(Math.random()*options.length)].id);$('pokemon-grid').querySelector('.selected')?.scrollIntoView({block:'nearest',behavior:'smooth'})});
 $('fullscreen').addEventListener('click',async()=>{
  if(document.fullscreenElement){await document.exitFullscreen();return}
  try{await document.querySelector('.preview-shell').requestFullscreen()}catch(e){tell('Fullscreen is unavailable in this embedded preview. Open the app in a new tab.')}
 });
 $('about-button').addEventListener('click',openAbout);$('credits-button').addEventListener('click',openAbout);
 $('close-dialog').addEventListener('click',()=>$('about-dialog').close());
 $('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
 document.querySelector('.nav-active').addEventListener('click',()=>document.querySelector('.workspace').scrollIntoView({behavior:'smooth'}));
 document.addEventListener('keydown',e=>{
  if(exportJob)return;
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||(e.target.tagName==='BUTTON'&&e.code==='Space')||$('about-dialog').open||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.key.toLowerCase()==='r'){$('randomize').click()}
  if(e.key==='/'){e.preventDefault();$('search').focus()}
  if(e.code==='Space'){e.preventDefault();setAnimation(!state.animate)}
 });
 setFormat('desktop');setAnimation(state.animate);
 try{
 const responses=await Promise.all([fetch('pokemon.json'),fetch('catalog.json')]);if(responses.some(r=>!r.ok))throw Error('Pokédex unavailable');
 [pokemon,catalog]=await Promise.all(responses.map(r=>r.json()));
 $('total-count').textContent=pokemon.length;
 $('generation-filter').innerHTML='<option value="all">All generations</option>'+catalog.generations.map(g=>`<option value="${g.id}">Gen ${g.name} · ${g.region} (${g.speciesCount})</option>`).join('');
 $('catalog-summary').textContent=`${catalog.speciesCount.toLocaleString()} species across ${catalog.generations.length} generations, with ${catalog.formCount.toLocaleString()} cataloged forms and varieties.`;
 $('catalog-date').textContent=new Date(catalog.updatedAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 const types=[...new Set(pokemon.flatMap(p=>p.types))].sort();
 $('type-filter').innerHTML='<option value="all">All types</option>'+types.map(t=>`<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');
 choosePokemon(6);await document.fonts.ready;draw();
 }catch(e){$('pokemon-grid').innerHTML='<div class="empty-message">The Pokédex could not open. Please reload to try again.</div>';$('canvas-loading').textContent='Could not load the collection.'}
}
init();

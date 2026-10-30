'use strict';
// Canonical dictionary + category ID indexes. View rows are materialized once.
const LIBRARY=window.SIMPLEPROMPT_TAG_LIBRARY;
const TAG_ROWS=new Map(Object.entries(LIBRARY.tags).map(([en,t])=>[en,Object.freeze({en,zh:t.zh,postCount:t.postCount,extra:t.extra,hairGroup:t.hairGroup,category:t.categoryId})]));
const DATA=LIBRARY.categories.map(c=>({id:c.id,title:c.title,desc:c.desc,tags:c.tagIds.map(id=>TAG_ROWS.get(id))}));
const ALL_TAGS=Object.freeze(DATA.flatMap(c=>c.tags));
const $=id=>document.getElementById(id);
const all=()=>ALL_TAGS;
const lookup=new Map(all().map(t=>[t.en,t]));
const config=Object.fromEntries(DATA.map(c=>[c.id,{enabled:c.id!=='artists',min:1,max:c.id==='attire'?3:1}]));
const recommendations=Object.fromEntries(DATA.map(c=>[c.id,c.tags.slice(0,10).map(t=>t.en)]));
let retained=new Set(),randomSelected=new Set(),favorites=[],blacklist=new Set(),draftRetained=null;
let modalCategory=null,modalPage=1,hairTab='color',generationView=false,storageAvailable=true;
const PAGE_SIZE=50,STORAGE_KEY='simpleprompt-artist-test-tags-v1';
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isSelected=en=>retained.has(en)||randomSelected.has(en);
const selected=()=>all().filter(t=>isSelected(t.en)&&!blacklist.has(t.en));
const eligible=c=>c.tags.filter(t=>!blacklist.has(t.en));
function message(s){$('status').textContent=s;}
function validNames(a){return Array.isArray(a)?[...new Set(a.filter(n=>typeof n==='string'&&lookup.has(n)))]:[];}
// State persistence module: migrate the old result-only recommendation lists.
function loadState(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!saved||saved.version!==4)return false;
 blacklist=new Set(validNames(saved.blacklist));favorites=validNames(saved.favorites);retained=new Set(validNames(saved.retained).filter(n=>!blacklist.has(n)));randomSelected=new Set(validNames(saved.randomSelected).filter(n=>!blacklist.has(n)&&!retained.has(n)));
 for(const c of DATA){const cfg=saved.config?.[c.id];if(cfg){const lo=Math.max(0,Math.min(10,Math.trunc(Number(cfg.min)||0))),hi=Math.max(lo,Math.min(10,Math.trunc(Number(cfg.max)||0)));config[c.id]={enabled:cfg.enabled!==false,min:lo,max:hi};}if(Array.isArray(saved.recommendations?.[c.id]))recommendations[c.id]=validNames(saved.recommendations[c.id]).filter(n=>lookup.get(n).category===c.id&&!blacklist.has(n)).slice(0,10);}
 if(saved.recommendationFormat!==2&&saved.generationView){for(const c of DATA)recommendations[c.id]=eligible(c).slice(0,10).map(t=>t.en);}
 generationView=!!saved.generationView;$('seed').value=Number.isFinite(saved.seed)?Math.max(0,Math.min(4294967295,Math.trunc(saved.seed))):824877850;return true;
 }catch{storageAvailable=false;return false;}}
function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:4,recommendationFormat:2,retained:[...retained],randomSelected:[...randomSelected],favorites,blacklist:[...blacklist],config,recommendations,generationView,seed:normalizeSeed()}));storageAvailable=true;}catch{storageAvailable=false;}$('saveStatus').textContent=storageAvailable?'':'浏览器未允许本地保存，本次仍可正常使用';}
function tagButton(t,showCount=false){const mode=retained.has(t.en)?'retained':randomSelected.has(t.en)?'random':'',star=favorites.includes(t.en)?'<span class="favorite-mark" aria-hidden="true">★</span>':'';return `<button type="button" class="tag ${mode}" data-tag="${escapeHTML(t.en)}" aria-pressed="${!!mode}" title="${escapeHTML(t.en)} · ${mode==='retained'?'已保留，点击移除':mode==='random'?'随机选择，点击设为已保留':'点击选择并保留'} · ${window.innerWidth<=720?'长按打开收藏或拉黑菜单':'拖到页面最左侧拉黑、最右侧收藏'}"><span class="zh">${star}${escapeHTML(tagDisplay(t))}${t.extra?'<span class="extra">补充</span>':''}</span><span class="en">${escapeHTML(tagSecondary(t))}</span>${showCount&&t.category!=='artists'?`<span class="usage">${t.postCount==null?'暂无使用量':t.postCount.toLocaleString('zh-CN')+' 篇收录'}</span>`:''}</button>`;}
// Recommendation model: stable candidate pools and selected tags are separate.
const RecommendationModel={
 groups(c){return {used:eligible(c).filter(t=>isSelected(t.en)),candidates:recommendations[c.id].filter(n=>!blacklist.has(n)&&!isSelected(n)).map(n=>lookup.get(n))};},
 replace(id,rand){const c=DATA.find(c=>c.id===id),prev=new Set(recommendations[id]),pool=eligible(c).filter(t=>!isSelected(t.en));recommendations[id]=[...shuffle(pool.filter(t=>!prev.has(t.en)),rand),...shuffle(pool.filter(t=>prev.has(t.en)),rand)].slice(0,10).map(t=>t.en);}
};
// Card view: overflow is hidden by complete tag, never by changing card height.
function cardGroup(title,tags,id,used=false){return '<section class="recommend-group"><div class="group-heading"><span>'+title+'</span><span data-group-count data-used="'+used+'" data-total="'+tags.length+'">'+tags.length+' 个</span></div><div class="preview-tags" data-preview-tags>'+ (tags.map(t=>tagButton(t)).join('')||'<p class="group-empty">'+(used?'尚未选择':'暂无其他候选，可换一批或查看全部。')+'</p>')+'</div></section>';}
function fitCardTags(){for(const area of $('cards').querySelectorAll('[data-preview-tags]')){const buttons=[...area.querySelectorAll('[data-tag]')];for(const b of buttons)b.hidden=false;const bounds=area.getBoundingClientRect(),over=buttons.map(b=>b.getBoundingClientRect().bottom>bounds.bottom+0.5);let hidden=0;for(let i=0;i<buttons.length;i++){buttons[i].hidden=over[i];if(over[i])hidden++;}const counter=area.parentElement.querySelector('[data-group-count]');if(counter)counter.textContent=counter.dataset.total+' 个'+(counter.dataset.used==='true'?' · 隐藏 '+hidden+' 个':'');}}
let fitRequest=0;
function scheduleCardFit(){cancelAnimationFrame(fitRequest);fitRequest=requestAnimationFrame(fitCardTags);}
function renderCards(){const filter=$('category').value;let count=0;
 $('cards').innerHTML=DATA.filter(c=>!filter||c.id===filter).map(c=>{const groups=RecommendationModel.groups(c),cfg=config[c.id],pool=eligible(c),fixed=c.tags.filter(t=>retained.has(t.en)).length,stopped=cfg.enabled&&fixed>=cfg.max;count+=groups.candidates.length;
 return '<article class="card '+(cfg.enabled?'':'off')+'" data-card="'+c.id+'"><div class="card-head"><button class="card-title category-link" data-open="'+c.id+'" aria-label="查看'+c.title+'全部标签">'+c.title+'<small>'+c.id+'</small><span class="entry-arrow">↗</span></button><label class="enable"><input type="checkbox" data-enable="'+c.id+'" '+(cfg.enabled?'checked':'')+' aria-label="'+c.title+'参与随机">参与随机</label></div><div class="range"><span>抽取</span><input type="number" min="0" max="10" value="'+cfg.min+'" data-range="'+c.id+'" data-bound="min" aria-label="'+c.title+'最少数量"><span>至</span><input type="number" min="0" max="10" value="'+cfg.max+'" data-range="'+c.id+'" data-bound="max" aria-label="'+c.title+'最多数量"><span>个</span><span class="catstats">已选 '+groups.used.length+' · 词池 '+pool.length+'</span></div><div class="card-content">'+cardGroup('已用词',groups.used,c.id,true)+cardGroup('推荐候选',groups.candidates,c.id)+'</div><p class="cardnote">'+('更多已用词见「全部 '+pool.length+' 个」。')+'</p><div class="card-bottom"><button class="small shuffle" data-shuffle="'+c.id+'" '+(pool.filter(t=>!isSelected(t.en)).length===0?'disabled':'')+' aria-label="'+c.title+'换一批">↻ 换一批</button><button class="small view-all" data-open="'+c.id+'">全部 '+pool.length+' 个 →</button></div></article>';
 }).join('');
 $('browseCount').textContent='已用 '+selected().length+' 个 / 可用 '+(all().length-blacklist.size)+' 个';
 $('favoritesButton').textContent='★ 收藏夹 '+favorites.filter(n=>!blacklist.has(n)).length;$('blacklistButton').textContent='黑名单 '+blacklist.size;
 MobileUI.syncCards();scheduleCardFit();
}
function renderResult(){const tags=selected();$('output').value=tags.map(t=>t.en).join(', ');$('total').textContent=`${tags.length} 个标签`;$('breakdown').textContent=`已保留 ${retained.size} / 随机选择 ${randomSelected.size}`;
 $('chosen').innerHTML=tags.map(t=>{if(draftRetained){const checked=draftRetained.has(t.en);return `<button class="chosen-tag lock-choice ${checked?'retained':''}" data-draft="${escapeHTML(t.en)}" aria-pressed="${checked}" title="${checked?'已保留，点击取消保留':'随机选择，点击设为已保留'}">${checked?'▣':'□'} ${escapeHTML(tagDisplay(t))}<span class="en">${escapeHTML(tagSecondary(t))}</span></button>`;}
 return `<button class="chosen-tag ${retained.has(t.en)?'retained':'random'}" data-selected-tag="${escapeHTML(t.en)}" data-remove="${escapeHTML(t.en)}" title="${retained.has(t.en)?'已保留':'随机选择'} · 点击移除 · ${window.innerWidth<=720?'长按收藏或拉黑':'可拖拽拉黑或收藏'}">${retained.has(t.en)?'▣ ':'◇ '}${favorites.includes(t.en)?'★ ':''}${escapeHTML(tagDisplay(t))}<small> ×</small></button>`;}).join('')||'<p class="muted">还没有选择标签。</p>';
 const drawable=DATA.filter(c=>config[c.id].enabled&&c.tags.filter(t=>retained.has(t.en)).length<config[c.id].max&&eligible(c).some(t=>!retained.has(t.en))).map(c=>c.title);
 $('warning').textContent=drawable.length?'可能随机补抽：'+drawable.join('、')+'。':'当前没有可随机补抽的大类；可调整抽取数量或取消部分保留。';
 $('lockEditor').hidden=!draftRetained;$('lockButton').hidden=!!draftRetained;$('lockButton').disabled=!tags.length;$('catalog').inert=!!draftRetained;
 for(const id of ['generate','reroll','newSeed','seed','clearAuto','clearAll','reset'])$(id).disabled=!!draftRetained;MobileUI.syncNav();
}
function render(){renderCards();renderResult();if(modalCategory)renderModal();}
function rng(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function normalizeSeed(){let v=Number($('seed').value);if(!Number.isFinite(v))v=0;v=Math.trunc(Math.min(4294967295,Math.max(0,v)));$('seed').value=v;return v;}
function shuffle(arr,random){const p=[...arr];for(let i=p.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[p[i],p[j]]=[p[j],p[i]];}return p;}
function freshRandom(){const a=new Uint32Array(1);crypto.getRandomValues(a);return rng(a[0]);}
function changeBatch(id){RecommendationModel.replace(id,freshRandom());renderCards();saveState();message(DATA.find(c=>c.id===id).title+'候选已更新，当前搭配不变。');$('cards').querySelector('[data-shuffle="'+id+'"]')?.focus();}
// Sampling engine: retain the previous shared seeded sequence and draw order.
const SamplingEngine={
 run({seed,categories,settings,kept,blocked,candidates}){const rand=rng(seed),tags=[],limited=[];
 for(const c of categories){const cfg=settings[c.id],fixed=c.tags.filter(t=>kept.has(t.en)).length;if(!cfg.enabled||fixed>=cfg.max)continue;const target=cfg.min+Math.floor(rand()*(cfg.max-cfg.min+1));if(fixed>=target)continue;
 const source=c.tags.filter(t=>!blocked.has(t.en)&&!kept.has(t.en)),pool=shuffle(source,rand),needed=target-fixed;for(const t of pool.slice(0,needed))tags.push(t.en);if(pool.length<needed)limited.push(c.title);
 }return {tags,limited};}
};
function generate(){if(draftRetained)return;const seed=normalizeSeed(),result=SamplingEngine.run({seed,categories:DATA,settings:config,kept:retained,blocked:blacklist,candidates:recommendations});randomSelected=new Set(result.tags);generationView=true;render();saveState();message('已生成 · Seed '+seed+' · 已保留词保持不变'+(result.limited.length?' · '+result.limited.join('、')+'可用标签不足':''));}
function newSeed(){const a=new Uint32Array(1);crypto.getRandomValues(a);$('seed').value=a[0];}
function toggleTag(en){if(draftRetained||blacklist.has(en))return;if(retained.has(en)){retained.delete(en);message('已移除标签。');}else{randomSelected.delete(en);retained.add(en);message('已设为已保留，随机时保持不变。');}render();saveState();}
function beginLockEdit(){if(!selected().length)return;draftRetained=new Set(retained);renderResult();message('选择要保留的 tag，点击确认后生效；取消可放弃修改。');}
function confirmLockEdit(){if(!draftRetained)return;const names=selected().map(t=>t.en);retained=new Set(names.filter(n=>draftRetained.has(n)));randomSelected=new Set(names.filter(n=>!draftRetained.has(n)));draftRetained=null;render();saveState();message('已确认保留设置。取消保留的词将在下次随机时允许替换。');}
function cancelLockEdit(){draftRetained=null;renderResult();message('已取消编辑，保留设置未改变。');}
function addFavorite(en){if(!lookup.has(en))return;if(!favorites.includes(en))favorites.push(en);render();saveState();message('已加入收藏，收藏词仍参与推荐和随机。');}
function addBlacklist(en){if(!lookup.has(en))return;blacklist.add(en);retained.delete(en);randomSelected.delete(en);for(const c of DATA)recommendations[c.id]=recommendations[c.id].filter(n=>n!==en);render();saveState();message('已加入黑名单并从搭配移除，可在黑名单列表恢复。');}
function removeBlacklist(en){blacklist.delete(en);render();saveState();message('已移出黑名单，原有收藏关系已恢复；可换一批或查看全部。');}
function modalItems(){let items;if(modalCategory==='favorites')items=favorites.filter(n=>!blacklist.has(n)).map(n=>lookup.get(n));else if(modalCategory==='blacklist')items=[...blacklist].map(n=>lookup.get(n));else items=eligible(DATA.find(c=>c.id===modalCategory));
 const raw=$('modalSearch').value.trim().toLowerCase(),q=raw.replace(/ /g,'_');items=items.filter(t=>(!q||t.en.toLowerCase().includes(q)||t.zh.toLowerCase().includes(raw))&&(!$('onlySelected').checked||isSelected(t.en)));
 if(modalCategory==='favorites'||modalCategory==='blacklist')return items;return [...items].sort($('modalSort').value==='name'?(a,b)=>a.en.localeCompare(b.en):(a,b)=>(b.postCount??-1)-(a.postCount??-1)||a.en.localeCompare(b.en));}
function paged(items,page,size=PAGE_SIZE){const pages=Math.max(1,Math.ceil(items.length/size));page=Math.max(1,Math.min(page,pages));return {page,pages,items:items.slice((page-1)*size,page*size)};}
// Collection removal is an explicit, temporary mode; it never changes selection.
const FavoriteRemoval={
 active:false,
 toggle(){this.active=!this.active;renderModal();},
 remove(en){favorites=favorites.filter(n=>n!==en);render();saveState();message('已移除收藏，当前搭配不变。');},
 reset(){this.active=false;}
};
function managerItem(t){if(modalCategory==='blacklist')return '<div class="manager-item"><div><strong>'+escapeHTML(tagDisplay(t))+'</strong><span class="en">'+escapeHTML(tagSecondary(t))+'</span>'+(favorites.includes(t.en)?'<small>仍在收藏中</small>':'')+'</div><button class="small" data-unblock="'+escapeHTML(t.en)+'">移出黑名单</button></div>';
 if(modalCategory==='favorites'&&FavoriteRemoval.active)return '<button class="tag removal-target" data-unfavorite="'+escapeHTML(t.en)+'" aria-label="移除收藏 '+escapeHTML(tagDisplay(t))+'"><span class="zh">'+escapeHTML(tagDisplay(t))+' <span class="remove-mark">×</span></span><span class="en">'+escapeHTML(tagSecondary(t))+'</span></button>';
 return tagButton(t,true);}
// Global search: pure matching/ranking and a session-only view state.
const GlobalSearch={
 state:{query:'',category:'',onlySelected:false,onlyFavorites:false,page:1,scroll:0},
 normalize(value){return String(value).normalize('NFKC').toLowerCase().replace(/[_\s]+/gu,' ').trim();},
 rank(tag,query){const phrase=this.normalize(query),tokens=phrase.split(' ').filter(Boolean);if(!tokens.length)return null;
  const en=this.normalize(tag.en),zh=this.normalize(tag.zh),compact=phrase.replaceAll(' ','');
  if(!tokens.every(token=>en.includes(token)||zh.includes(token)))return null;
  if(en===phrase||zh===phrase||zh===compact)return 0;
  if(en.startsWith(phrase)||zh.startsWith(phrase)||zh.startsWith(compact))return 1;
  return 2;
 },
 query(tags,options){if(!this.normalize(options.query))return [];
  return tags.filter(t=>!options.blocked.has(t.en)&&(!options.category||t.category===options.category)&&(!options.onlySelected||options.selected.has(t.en))&&(!options.onlyFavorites||options.favorites.has(t.en)))
   .map(t=>({tag:t,rank:this.rank(t,options.query)})).filter(x=>x.rank!==null)
   .sort((a,b)=>a.rank-b.rank||(b.tag.postCount??-1)-(a.tag.postCount??-1)||a.tag.en.localeCompare(b.tag.en)).map(x=>x.tag);
 },
 capture(){Object.assign(this.state,{query:$('modalSearch').value,category:$('searchCategory').value,onlySelected:$('onlySelected').checked,onlyFavorites:$('searchOnlyFavorites').checked,page:modalPage,scroll:$('modalTags').scrollTop});},
 items(){return this.query(all(),{query:$('modalSearch').value,category:$('searchCategory').value,onlySelected:$('onlySelected').checked,onlyFavorites:$('searchOnlyFavorites').checked,selected:new Set([...retained,...randomSelected]),favorites:new Set(favorites),blocked:blacklist});},
 open(){if(draftRetained)return;const snapshot={...this.state};FavoriteRemoval.reset();modalCategory='search';modalPage=snapshot.page;
  $('modalSearch').value=snapshot.query;$('searchCategory').value=snapshot.category;$('onlySelected').checked=snapshot.onlySelected;$('searchOnlyFavorites').checked=snapshot.onlyFavorites;
  renderModal();if(!$('tagDialog').open)$('tagDialog').showModal();$('modalTags').scrollTop=snapshot.page===modalPage?snapshot.scroll:0;this.capture();$('modalSearch').focus();
 },
 resetFilters(){if(modalCategory!=='search')return;$('searchCategory').value='';$('onlySelected').checked=false;$('searchOnlyFavorites').checked=false;modalPage=1;renderModal();$('modalTags').scrollTop=0;this.capture();$('modalSearch').focus();}
};
const categoryTitles=new Map(DATA.map(c=>[c.id,c.title]));
function searchTagButton(t){const state=retained.has(t.en)?'已保留':randomSelected.has(t.en)?'随机选择':'未选';
 return tagButton(t,true).replace('</button>',`<span class="search-tag-meta"><span>${escapeHTML(categoryTitles.get(t.category))}</span><span>${state}</span></span></button>`);
}
function renderGlobalSearch(){const items=GlobalSearch.items(),p=paged(items,modalPage),previousPage=modalPage;modalPage=p.page;
 const hasQuery=!!GlobalSearch.normalize($('modalSearch').value),oldScroll=$('modalTags').scrollTop;
 $('modalTitle').textContent='搜索全部标签';$('modalDesc').textContent='中英搜索 · 完全匹配优先，其次前缀、包含匹配；同级按热度排序';
 $('removeFavoritesMode').hidden=true;$('clearBlacklist').hidden=true;$('modalSort').hidden=true;$('selectedFilter').hidden=false;$('onlySelected').disabled=false;
 $('searchFilters').hidden=false;$('modalSearch').placeholder='搜索中文或英文，多个关键词用空格分隔…';$('modalSearch').setAttribute('aria-label','搜索全部标签');$('modalTags').setAttribute('aria-label','全局搜索结果');
 $('modalNote').textContent='点击未选词设为已保留；随机词点击可保留；再次点击已保留词移除。黑名单词不显示。';
 $('tagDialog').classList.remove('hair-dialog');$('hairTabs').hidden=true;$('modalTags').classList.remove('hair-columns','manager-tags');$('modalTags').classList.add('search-results');
 $('modalTags').innerHTML=hasQuery?(p.items.map(searchTagButton).join('')||'<div class="empty search-empty"><p>没有匹配的标签，试试更短的关键词或清空筛选。</p><button class="small" data-clear-search-filters>清空筛选</button></div>'):'<div class="empty search-empty"><p>输入中文或英文关键词，跨类别寻找标签。</p><p>例如「蓝 眼」或「holding sword」。</p></div>';
 $('modalCount').textContent=hasQuery?`找到 ${items.length} 个 · 每页 ${PAGE_SIZE} 个`:'输入关键词后显示结果';
 $('modalPager').hidden=!hasQuery||!items.length;$('pageInfo').textContent=`第 ${p.page} / ${p.pages} 页`;$('prevPage').disabled=p.page===1;$('nextPage').disabled=p.page===p.pages;
 $('modalSelectedCount').textContent=`全部已选 ${selected().length} 个 · 已保留 ${retained.size} / 随机选择 ${randomSelected.size}`;$('modalSelected').hidden=true;
 $('modalTags').scrollTop=previousPage===p.page?oldScroll:0;GlobalSearch.capture();
}

function renderModal(){if(modalCategory==='search'){renderGlobalSearch();return;}$('modalTags').classList.remove('search-results');$('searchFilters').hidden=true;$('modalSearch').placeholder='搜索本类中文或英文 tag…';$('modalSearch').setAttribute('aria-label','搜索本类标签');const manager=['favorites','blacklist'].includes(modalCategory),blocked=modalCategory==='blacklist',c=manager?null:DATA.find(c=>c.id===modalCategory),items=modalItems(),p=paged(items,modalPage),hair=modalCategory==='hair';modalPage=p.page;
 $('removeFavoritesMode').hidden=modalCategory!=='favorites';$('removeFavoritesMode').textContent=FavoriteRemoval.active?'退出操作':'移除收藏';$('removeFavoritesMode').classList.toggle('active',FavoriteRemoval.active);
 $('modalTitle').textContent=modalCategory==='favorites'?'收藏夹':blocked?'黑名单':c.title+' · 完整列表';
 $('modalDesc').textContent=modalCategory==='favorites'?`按收藏顺序排列 · ${favorites.filter(n=>blacklist.has(n)).length} 个收藏因黑名单而隐藏`:blocked?'这里的标签不会出现在普通列表、推荐或随机结果中':`${c.desc} · 可用 ${eligible(c).length} 个标签`;
 $('modalSort').hidden=manager;$('selectedFilter').hidden=blocked;$('clearBlacklist').hidden=!blocked;$('clearBlacklist').disabled=blacklist.size===0;$('onlySelected').disabled=blocked;
 $('modalNote').textContent=blocked?'移出黑名单不会自动重新选中该词；原有收藏关系仍保留。':manager?(FavoriteRemoval.active?'点击 tag 立即移除收藏；点「退出操作」返回正常选择。':'收藏词正常参与推荐和随机；点击「移除收藏」可批量移除。'):'点击未选词设为已保留；随机词点击可保留；已保留词再次点击移除。';
 $('tagDialog').classList.toggle('hair-dialog',hair);$('hairTabs').hidden=!hair;$('modalTags').classList.toggle('hair-columns',hair);$('modalTags').classList.toggle('manager-tags',blocked);
 if(hair){$('modalTags').innerHTML=['color','style'].map(group=>{const tags=items.filter(t=>t.hairGroup===group),label=group==='color'?'头发颜色':'发型';return `<section class="hair-group" data-hair-group="${group}" aria-label="${label}标签池"><div class="hair-heading"><h3>${label}</h3><span>${tags.length} 个匹配</span></div><div class="hair-tag-grid">${tags.map(t=>tagButton(t,true)).join('')||'<p class="empty">此分区没有匹配的标签。</p>'}</div></section>`;}).join('');setHairTab(hairTab);}else $('modalTags').innerHTML=p.items.map(managerItem).join('')||`<p class="empty">${blocked?'黑名单为空，或没有匹配项。':modalCategory==='favorites'?'暂无可见的收藏，或没有匹配项。':'没有匹配的标签，试试其他关键词。'}</p>`;
 $('modalCount').textContent=`找到 ${items.length} 个${hair?' · 发色 / 发型分区':' · 每页 '+PAGE_SIZE+' 个'}`;$('modalPager').hidden=hair;$('pageInfo').textContent=`第 ${p.page} / ${p.pages} 页`;$('prevPage').disabled=p.page===1;$('nextPage').disabled=p.page===p.pages;
 const chosen=c?c.tags.filter(t=>isSelected(t.en)&&!blacklist.has(t.en)):[];$('modalSelectedCount').textContent=c?`本类已选 ${chosen.length} 个 · 全部已选 ${selected().length} 个`:`全部已选 ${selected().length} 个`;
 $('modalSelected').innerHTML=chosen.map(t=>`<button class="small ${retained.has(t.en)?'retained':'random'}" data-selected-tag="${escapeHTML(t.en)}" data-remove="${escapeHTML(t.en)}" aria-label="移除 ${escapeHTML(tagDisplay(t))}">${retained.has(t.en)?'▣ ':''}${escapeHTML(tagDisplay(t))} ×</button>`).join('');$('modalSelected').hidden=!c;
}
function setHairTab(group){hairTab=group;$('modalTags').dataset.activeHair=group;for(const v of ['color','style'])$(v==='color'?'hairColorTab':'hairStyleTab').setAttribute('aria-pressed',String(group===v));}
function openCategory(id){if(draftRetained)return;if(modalCategory==='search')GlobalSearch.capture();FavoriteRemoval.reset();modalCategory=id;modalPage=1;hairTab='color';$('modalSearch').value='';$('onlySelected').checked=false;$('modalSort').value='popular';renderModal();if(!$('tagDialog').open)$('tagDialog').showModal();$('modalTags').scrollTop=0;$('modalSearch').focus();}
function closeModal(){if(modalCategory==='search')GlobalSearch.capture();$('tagDialog').close();}
$('tagDialog').addEventListener('cancel',()=>{if(modalCategory==='search')GlobalSearch.capture();});
function removeFromEvent(e){const b=e.target.closest('[data-remove]');if(!b)return;retained.delete(b.dataset.remove);randomSelected.delete(b.dataset.remove);render();saveState();message('已移除标签。');}
for(const c of DATA){const o=document.createElement('option');o.value=c.id;o.textContent=c.title;$('category').appendChild(o);const filter=document.createElement('option');filter.value=c.id;filter.textContent=c.title;$('searchCategory').appendChild(filter);}
$('searchButton').addEventListener('click',()=>GlobalSearch.open());$('category').addEventListener('change',renderCards);$('favoritesButton').addEventListener('click',()=>openCategory('favorites'));$('blacklistButton').addEventListener('click',()=>openCategory('blacklist'));
$('cards').addEventListener('click',e=>{const open=e.target.closest('[data-open]');if(open){openCategory(open.dataset.open);return;}const batch=e.target.closest('[data-shuffle]');if(batch){changeBatch(batch.dataset.shuffle);return;}const tag=e.target.closest('[data-tag]');if(tag)toggleTag(tag.dataset.tag);});
$('cards').addEventListener('change',e=>{const el=e.target;if(el.dataset.enable){const id=el.dataset.enable;config[id].enabled=el.checked;if(!el.checked){DATA.find(c=>c.id===id).tags.forEach(t=>randomSelected.delete(t.en));}render();saveState();message(el.checked?'已启用该类随机。':'已停止该类随机，已保留词不变。');}if(el.dataset.range){const cfg=config[el.dataset.range],bound=el.dataset.bound;cfg[bound]=Math.max(0,Math.min(10,Math.trunc(Number(el.value)||0)));if(cfg.min>cfg.max)cfg[bound==='min'?'max':'min']=cfg[bound];render();saveState();message('数量已更新，下次生成时生效。');}});
$('chosen').addEventListener('click',e=>{const b=e.target.closest('[data-draft]');if(b&&draftRetained){const en=b.dataset.draft;if(draftRetained.has(en))draftRetained.delete(en);else draftRetained.add(en);renderResult();$('chosen').querySelector(`[data-draft="${CSS.escape(en)}"]`)?.focus();return;}removeFromEvent(e);});
$('lockButton').addEventListener('click',beginLockEdit);$('confirmLocks').addEventListener('click',confirmLockEdit);$('cancelLocks').addEventListener('click',cancelLockEdit);
$('modalSelected').addEventListener('click',removeFromEvent);
$('modalTags').addEventListener('click',e=>{if(e.target.closest('[data-clear-search-filters]')){GlobalSearch.resetFilters();return;}const restore=e.target.closest('[data-unblock]');if(restore){removeBlacklist(restore.dataset.unblock);return;}const unf=e.target.closest('[data-unfavorite]');if(unf){FavoriteRemoval.remove(unf.dataset.unfavorite);return;}const b=e.target.closest('[data-tag]');if(b){toggleTag(b.dataset.tag);const next=$('modalTags').querySelector(`[data-tag="${CSS.escape(b.dataset.tag)}"]`);if(next)next.focus();else if(modalCategory==='search')$('modalSearch').focus();}});
$('clearSearchFilters').addEventListener('click',()=>GlobalSearch.resetFilters());
$('removeFavoritesMode').addEventListener('click',()=>FavoriteRemoval.toggle());
$('clearBlacklist').addEventListener('click',()=>{blacklist.clear();render();saveState();message('已清空黑名单，原有收藏关系已恢复。');});
$('hairColorTab').addEventListener('click',()=>setHairTab('color'));$('hairStyleTab').addEventListener('click',()=>setHairTab('style'));
for(const [id,event]of [['modalSearch','input'],['onlySelected','change'],['modalSort','change'],['searchCategory','change'],['searchOnlyFavorites','change']])$(id).addEventListener(event,()=>{modalPage=1;renderModal();$('modalTags').scrollTop=0;});
$('prevPage').addEventListener('click',()=>{modalPage--;renderModal();$('modalTags').scrollTop=0;});$('nextPage').addEventListener('click',()=>{modalPage++;renderModal();$('modalTags').scrollTop=0;});
$('closeModal').addEventListener('click',closeModal);$('doneModal').addEventListener('click',closeModal);
$('tagDialog').addEventListener('click',e=>{if(e.target!==$('tagDialog'))return;const r=$('tagDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();});
$('tagDialog').addEventListener('close',()=>{const id=modalCategory;FavoriteRemoval.reset();modalCategory=null;const opener=id==='favorites'?$('favoritesButton'):id==='blacklist'?$('blacklistButton'):id==='search'?$('searchButton'):$('cards').querySelector(`[data-open="${id}"]`);opener?.focus();});
$('generate').addEventListener('click',generate);$('reroll').addEventListener('click',()=>{newSeed();generate();});$('newSeed').addEventListener('click',()=>{newSeed();saveState();message('种子已更新，点击“按此种子生成”使用。');});
$('seed').addEventListener('change',saveState);
$('clearAuto').addEventListener('click',()=>{randomSelected.clear();render();saveState();message('已清除随机选择，已保留词不变。');});$('clearAll').addEventListener('click',()=>{retained.clear();randomSelected.clear();render();saveState();message('已清空搭配，收藏和黑名单不变。');});
$('reset').addEventListener('click',()=>{retained.clear();randomSelected.clear();for(const c of DATA){config[c.id]={enabled:c.id!=='artists',min:1,max:c.id==='attire'?3:1};recommendations[c.id]=eligible(c).slice(0,10).map(t=>t.en);}generationView=false;$('seed').value=824877850;$('category').value='';render();saveState();message('已重置搭配、设置和推荐；收藏与黑名单保留。');});
$('copy').addEventListener('click',async()=>{const text=$('output').value;if(!text){message('先选择标签或随机生成。');return;}try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else{$('output').focus();$('output').select();if(!document.execCommand('copy'))throw Error('copy');}message(`已复制 ${selected().length} 个英文标签。`);}catch{$('output').focus();$('output').select();message('文本已全选，请按 Ctrl+C（Mac 用 ⌘C）复制。');}});
// Pointer gestures use a movement threshold; touch additionally requires a hold.
let drag=null,blockClickUntil=0;
// Shared geometry drives both hints and hit-testing. Original 1/3 strips / 3 = 1/9.
const DRAG_LAYOUT={edgeWidthRatio:1/9};
const DropTargets={
 contains(r,x,y){return r.width>0&&r.height>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;},
 hit(x,y,rects){if(this.contains(rects.blacklist,x,y))return 'blacklist';if(this.contains(rects.favorite,x,y))return 'favorite';return 'cancel';},
 rectangles(){const w=window.innerWidth,h=window.innerHeight,edge=w*DRAG_LAYOUT.edgeWidthRatio;return {blacklist:{left:0,top:0,right:edge,bottom:h,width:edge,height:h},favorite:{left:w-edge,top:0,right:w,bottom:h,width:edge,height:h}};},
 sync(){const rects=this.rectangles();for(const key of ['blacklist','favorite']){const node=$(key==='blacklist'?'dragBlackPreview':'dragFavoritePreview'),r=rects[key];Object.assign(node.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}}
};
function dragZone(x,y){return DropTargets.hit(x,y,DropTargets.rectangles());}
function beginDrag(){if(!drag||drag.active)return;drag.active=true;clearTimeout(drag.timer);const host=$('tagDialog').open?$('tagDialog'):document.body;host.appendChild($('dragZones'));$('dragZones').hidden=false;DropTargets.sync();$('dragGhost').textContent=tagDisplay(lookup.get(drag.en));document.body.classList.add('dragging');try{drag.el.setPointerCapture(drag.id);}catch{}updateDrag(drag.x,drag.y);}
function updateDrag(x,y){if(!drag?.active)return;drag.x=x;drag.y=y;const zone=dragZone(x,y);$('dragZones').dataset.zone=zone;$('dragGhost').style.left=Math.max(8,Math.min(window.innerWidth-150,x+14))+'px';$('dragGhost').style.top=Math.max(8,Math.min(window.innerHeight-45,y+14))+'px';}
function endDrag(cancelled=false){if(!drag)return;const d=drag;clearTimeout(d.timer);drag=null;$('dragZones').hidden=true;document.body.classList.remove('dragging');if(!d.active)return;blockClickUntil=Date.now()+500;try{d.el.releasePointerCapture(d.id);}catch{}if(cancelled)return;const zone=dragZone(d.x,d.y);if(zone==='blacklist')addBlacklist(d.en);else if(zone==='favorite')addFavorite(d.en);else message('已取消拖拽，标签保持不变。');}
document.addEventListener('pointerdown',e=>{if(draftRetained||FavoriteRemoval.active||e.button!==0)return;const el=e.target.closest('[data-tag],[data-selected-tag]');if(!el)return;const en=el.dataset.tag||el.dataset.selectedTag;if(blacklist.has(en))return;drag={en,el,id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false,timer:null};if(e.pointerType==='touch')drag.timer=setTimeout(()=>beginDrag(),450);});
document.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const distance=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY);drag.x=e.clientX;drag.y=e.clientY;if(!drag.active){if(drag.type==='touch'&&distance>12){clearTimeout(drag.timer);drag=null;return;}if(drag.type!=='touch'&&distance>=18)beginDrag();}if(drag?.active){e.preventDefault();updateDrag(e.clientX,e.clientY);}}, {passive:false});
document.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;endDrag();});document.addEventListener('pointercancel',()=>endDrag(true));
document.addEventListener('touchmove',e=>{if(drag?.active)e.preventDefault();},{passive:false});
document.addEventListener('click',e=>{if(Date.now()<blockClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&($('mobileTagMenu').open||$('mobileMoreMenu').open)){e.preventDefault();($('mobileTagMenu').open?$('mobileTagMenu'):$('mobileMoreMenu')).close();return;}if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k'){if(draftRetained||drag?.active)return;e.preventDefault();if(modalCategory==='search')$('modalSearch').focus();else GlobalSearch.open();return;}if(e.key==='Escape'&&drag?.active){e.preventDefault();e.stopImmediatePropagation();endDrag(true);}else if(e.key==='Escape'&&$('tagDialog').open){e.preventDefault();closeModal();}},true);
window.addEventListener('blur',()=>endDrag(true));
window.addEventListener('resize',()=>{scheduleCardFit();if(drag?.active)DropTargets.sync();});
// Responsive layout and touch controller. Selection and seeded sampling stay shared.
const MobileUI={
 page:'browse',expanded:new Set(),press:null,menuTag:null,
 compact(){return window.innerWidth<=720;},
 setPage(page){if(draftRetained&&page!=='result')return;this.page=page;document.body.dataset.mobilePage=page;this.syncNav();scheduleCardFit();},
 syncNav(){if(draftRetained&&this.compact()&&this.page!=='result'){this.page='result';document.body.dataset.mobilePage='result';}const n=selected().length;$('mobileResultCount').textContent=String(n);$('mobileBrowseTab').setAttribute('aria-selected',String(this.page==='browse'));$('mobileResultTab').setAttribute('aria-selected',String(this.page==='result'));$('mobileBrowseTab').disabled=!!draftRetained;},
 syncCards(){for(const card of $('cards').querySelectorAll('[data-card]')){const id=card.dataset.card,c=DATA.find(c=>c.id===id),open=this.expanded.has(id);card.classList.toggle('mobile-collapsed',!open);const title=card.querySelector('.card-title');title.setAttribute('aria-expanded',String(open));
  let summary=card.querySelector('.mobile-card-summary');if(!summary){summary=document.createElement('div');summary.className='mobile-card-summary';card.appendChild(summary);}summary.textContent=`已选 ${c.tags.filter(t=>isSelected(t.en)).length} 个 · 词池 ${eligible(c).length} 个 · ${open?'点击标题收起':'点击标题展开'}`;
 }},
 toggle(id){if(this.expanded.has(id))this.expanded.delete(id);else this.expanded.add(id);this.syncCards();scheduleCardFit();},
 clearPress(){if(this.press)clearTimeout(this.press.timer);this.press=null;},
 openTag(en){if(draftRetained||blacklist.has(en))return;this.menuTag=en;const t=lookup.get(en);$('mobileTagName').textContent=tagDisplay(t);$('mobileTagEnglish').textContent=en;$('mobileFavoriteAction').textContent=favorites.includes(en)?'取消收藏':'加入收藏';$('mobileTagMenu').showModal();},
 action(type){const en=this.menuTag;$('mobileTagMenu').close();this.menuTag=null;if(!en)return;if(type==='blacklist')addBlacklist(en);else if(favorites.includes(en))FavoriteRemoval.remove(en);else addFavorite(en);},
 start(e){if(draftRetained||FavoriteRemoval.active||e.pointerType!=='touch')return;const el=e.target.closest('[data-tag],[data-selected-tag]');if(!el)return;const en=el.dataset.tag||el.dataset.selectedTag;if(blacklist.has(en))return;e.stopImmediatePropagation();this.clearPress();const p={id:e.pointerId,x:e.clientX,y:e.clientY,opened:false,timer:null};this.press=p;p.timer=setTimeout(()=>{p.opened=true;blockClickUntil=Date.now()+800;this.openTag(en);},450);},
 init(){document.body.dataset.mobilePage=this.page;
  $('mobileBrowseTab').addEventListener('click',()=>this.setPage('browse'));$('mobileResultTab').addEventListener('click',()=>this.setPage('result'));
  $('mobileMoreButton').addEventListener('click',()=>$('mobileMoreMenu').showModal());$('closeMobileMore').addEventListener('click',()=>$('mobileMoreMenu').close());
  for(const [id,type] of [['mobileFavorites','favorites'],['mobileBlacklist','blacklist']])$(id).addEventListener('click',()=>{$('mobileMoreMenu').close();openCategory(type);});
  $('closeMobileTag').addEventListener('click',()=>$('mobileTagMenu').close());$('mobileFavoriteAction').addEventListener('click',()=>this.action('favorite'));$('mobileBlacklistAction').addEventListener('click',()=>this.action('blacklist'));
  $('cards').addEventListener('click',e=>{if(!this.compact())return;const title=e.target.closest('.card-title');if(!title)return;e.preventDefault();e.stopImmediatePropagation();this.toggle(title.dataset.open);},true);
  document.addEventListener('pointerdown',e=>this.start(e),true);
  document.addEventListener('pointermove',e=>{const p=this.press;if(p&&p.id===e.pointerId&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>10&&!p.opened)this.clearPress();},true);
  document.addEventListener('pointerup',e=>{if(this.press?.id===e.pointerId){if(this.press.opened)blockClickUntil=Date.now()+500;this.clearPress();}},true);
  document.addEventListener('pointercancel',()=>this.clearPress(),true);window.addEventListener('blur',()=>this.clearPress());
  document.addEventListener('contextmenu',e=>{if(!this.compact()&&e.pointerType!=='touch')return;const t=e.target.closest('[data-tag],[data-selected-tag]');if(!t)return;e.preventDefault();this.clearPress();this.openTag(t.dataset.tag||t.dataset.selectedTag);});
  window.addEventListener('resize',()=>{this.clearPress();this.syncCards();this.syncNav();});
 }
};
MobileUI.init();

// About credit entry points
// Presentation-only localization. Canonical tag IDs, search data and sampling stay unchanged.
const I18n={
 lang:'zh',manual:false,key:'simpleprompt-artist-test-language-v1',depth:0,nodes:new WeakMap(),attributes:new WeakMap(),
 categories:{
 count:['Subjects & count','Subject counts, groups, species and focus'],composition:['Composition','Framing, viewpoints, perspective and layout'],pose:['Pose','Body positions, balance and overall movement'],action:['Action','Hand gestures, interactions and other actions'],expression:['Expression','Visible facial expressions and emotions'],hair:['Hair','Hair colors, lengths, cuts and styling'],eyes:['Eyes','Eye colors, features and gaze'],attire:['Clothing','Garments, soft clothing and complete outfits'],clothing_attributes:['Clothing details','Garment construction, patterns and details'],accessories:['Accessories','Footwear, headwear, jewelry and decorative items'],background:['Background','Locations, scenery, weather and background designs'],lighting:['Lighting','Light direction, time of day and illumination'],style:['Style & effects','Art styles, textures and visual effects'],quality:['Quality & image type','Resolution, image purposes, sources and formats'],state:['Character state','Physical and mental states and relationships'],props:['Scene props','Objects in the scene or used by a character'],artists:['Artists','Artist names and prompt tags'],other:['Other','Greetings, text, speech bubbles and symbols']},
 dictionary:{'当前没有可随机补抽的大类；可调整抽取数量或取消部分保留。':'No categories can draw more tags. Adjust draw counts or release retained tags.',
 '提示词实验室':'SimplePrompt','把一点偶然，变成画面灵感。':'A little inspiration, one tag at a time.',
 '★ 收藏夹':'★ Favorites','收藏夹':'Favorites','黑名单':'Blacklist','⌕ 搜索':'⌕ Search','更多':'More','全部类别':'All categories',
 '已保留 · 随机时保持不变':'Retained · stays when generating','随机选择 · 下次可替换':'Random · may change next time',
 '我的搭配':'My prompt','先选喜欢的词，再随机补上其他灵感。':'Pick your favorites, then add some random inspiration.',
 '随机种子 Seed':'Random seed','换一个':'New seed','↻ 换种子生成':'↻ New seed & generate','按此种子生成':'Generate with seed','英文提示词':'English prompt','复制提示词':'Copy prompt','保留tag':'Retain tags',
 '点击下方 tag 切换是否保留，确认后生效。':'Tap tags below to change retention, then confirm.','确认':'Confirm','取消':'Cancel','准备好了，从一个标签开始。':'Ready. Start with a tag.',
 '清除随机选择':'Clear random tags','清空已选':'Clear selection','重置搭配与设置':'Reset prompt & settings','操作说明与词库来源':'Help & tag sources',
 '▦ 选标签':'▦ Browse tags','收藏与黑名单':'Favorites & blacklist','关于 SimplePrompt':'About SimplePrompt','加入收藏':'Add to favorites','取消收藏':'Remove favorite','加入黑名单':'Add to blacklist','关闭':'Close','参考':'Sources',
 '面向 AI 生图新手的提示词工具。':'An AI image prompt builder for beginners.',
 '本项目使用 ChatGPT 辅助编程。':'This project was developed with programming assistance from ChatGPT.',
 '代码采用 MIT 许可证，允许商用、修改和分发；分发代码时须保留版权及许可声明，无需公开修改后的源码。':'Code licensed under MIT. Commercial use, modification and redistribution are permitted; retain the copyright and permission notice when distributing the code. Publishing modifications is not required.',
 '标签数据参考 Latent Tags / Danbooru，第三方内容的权利与许可单独适用。':'Tag data references Latent Tags / Danbooru. Third-party rights and licenses apply separately.',
 '完整列表':'All tags','常用优先 · 收录篇数':'Popular first · post count','英文名称 A–Z':'English name A–Z','只看已选':'Selected only','只看收藏':'Favorites only','清空筛选':'Clear filters','移除收藏':'Remove favorites','退出操作':'Exit removal mode','清空黑名单':'Clear blacklist',
 '点击标签即可手动固定 · 自动词再次点击可转为手动 · 所有选择即时同步':'Click a tag to retain it. All selections sync immediately.',
 '发色':'Hair color','发型':'Hairstyle','头发颜色':'Hair colors','上一页':'Previous','下一页':'Next','完成选择 · 返回首页':'Done · Back to main',
 '拉黑':'Blacklist','松手确认':'Release to confirm','收藏':'Favorite','参与随机':'Include','抽取':'Draw','至':'to','个':'tags','已用词':'Selected tags','推荐候选':'Suggestions','尚未选择':'No tags selected','↻ 换一批':'↻ Refresh',
 '暂无其他候选，可换一批或查看全部。':'No more suggestions. Refresh or browse all tags.','还没有选择标签。':'No tags selected yet.','补充':'Extra','暂无使用量':'No post count available',
 '已保留，点击移除':'Retained; click to remove','随机选择，点击设为已保留':'Random; click to retain','点击选择并保留':'Click to select and retain','长按打开收藏或拉黑菜单':'Long-press for favorites or blacklist','拖到页面最左侧拉黑、最右侧收藏':'Drag to the left edge to blacklist or the right edge to favorite',
 '已保留':'Retained','随机选择':'Random','未选':'Not selected','已保留，点击取消保留':'Retained; click to release','随机选择，点击设为已保留':'Random; click to retain','点击移除':'Click to remove','长按收藏或拉黑':'Long-press to favorite or blacklist','可拖拽拉黑或收藏':'Drag to favorite or blacklist',
 '已移除标签。':'Tag removed.','已设为已保留，随机时保持不变。':'Tag retained. It will stay when generating.',
 '选择要保留的 tag，点击确认后生效；取消可放弃修改。':'Choose tags to retain, then confirm. Cancel discards these changes.',
 '已确认保留设置。取消保留的词将在下次随机时允许替换。':'Retention saved. Released tags may change on the next generation.',
 '已取消编辑，保留设置未改变。':'Edit canceled. Retention is unchanged.','已加入收藏，收藏词仍参与推荐和随机。':'Added to favorites. Favorite tags still appear in suggestions and random draws.',
 '已加入黑名单并从搭配移除，可在黑名单列表恢复。':'Blacklisted and removed from your prompt. Restore it from the blacklist.',
 '已移出黑名单，原有收藏关系已恢复；可换一批或查看全部。':'Removed from the blacklist. Any favorite status is restored; refresh suggestions or browse all tags.',
 '已移除收藏，当前搭配不变。':'Favorite removed. Your prompt is unchanged.','已清空黑名单，原有收藏关系已恢复。':'Blacklist cleared. Existing favorites are restored.',
 '已启用该类随机。':'Random draws enabled for this category.','已停止该类随机，已保留词不变。':'Random draws disabled for this category. Retained tags stay.',
 '数量已更新，下次生成时生效。':'Quantity updated for the next generation.','种子已更新，点击“按此种子生成”使用。':'Seed updated. Select “Generate with seed” to use it.',
 '已清除随机选择，已保留词不变。':'Random tags cleared. Retained tags stay.','已清空搭配，收藏和黑名单不变。':'Prompt cleared. Favorites and blacklist are unchanged.',
 '已重置搭配、设置和推荐；收藏与黑名单保留。':'Prompt, settings and suggestions reset. Favorites and blacklist are kept.',
 '先选择标签或随机生成。':'Select tags or generate a prompt first.','文本已全选，请按 Ctrl+C（Mac 用 ⌘C）复制。':'Text selected. Press Ctrl+C (⌘C on Mac) to copy.',
 '已取消拖拽，标签保持不变。':'Drag canceled. The tag is unchanged.','已恢复上次搭配、保留设置、收藏和黑名单。':'Restored your prompt, retention settings, favorites and blacklist.',
 '浏览器未允许本地保存，本次仍可正常使用':'Local saving is unavailable in this browser. You can still use the tool.',
 '搜索全部标签':'Search all tags','中英搜索 · 完全匹配优先，其次前缀、包含匹配；同级按热度排序':'Chinese & English · Exact matches first, then prefixes and partial matches; ties sorted by popularity',
 '搜索中文或英文，多个关键词用空格分隔…':'Search tags; separate keywords with spaces…','全局搜索结果':'Search results',
 '点击未选词设为已保留；随机词点击可保留；再次点击已保留词移除。黑名单词不显示。':'Click an unselected or random tag to retain it. Click a retained tag to remove it. Blacklisted tags are hidden.',
 '没有匹配的标签，试试更短的关键词或清空筛选。':'No matching tags. Try shorter keywords or clear filters.',
 '输入中文或英文关键词，跨类别寻找标签。':'Enter English or Chinese keywords to search across categories.','例如「蓝 眼」或「holding sword」。':'Try “blue eyes” or “holding sword”.','输入关键词后显示结果':'Enter keywords to see results',
 '搜索本类中文或英文 tag…':'Search this category in English or Chinese…','搜索本类标签':'Search this category',
 '这里的标签不会出现在普通列表、推荐或随机结果中':'These tags are excluded from normal lists, suggestions and random draws.',
 '移出黑名单不会自动重新选中该词；原有收藏关系仍保留。':'Restoring a tag does not select it again. Its favorite status is kept.',
 '点击 tag 立即移除收藏；点「退出操作」返回正常选择。':'Click tags to remove favorites. Select “Exit removal mode” to resume selection.',
 '收藏词正常参与推荐和随机；点击「移除收藏」可批量移除。':'Favorites remain eligible for suggestions and random draws. Use “Remove favorites” to remove several.',
 '点击未选词设为已保留；随机词点击可保留；已保留词再次点击移除。':'Click unselected or random tags to retain them; click retained tags to remove them.',
 '此分区没有匹配的标签。':'No matching tags in this section.','黑名单为空，或没有匹配项。':'The blacklist is empty, or no tags match.','暂无可见的收藏，或没有匹配项。':'No visible favorites, or no tags match.','没有匹配的标签，试试其他关键词。':'No matching tags. Try other keywords.','仍在收藏中':'Still in favorites','移出黑名单':'Restore tag',
 '点击标题收起':'Tap title to collapse','点击标题展开':'Tap title to expand',
 '标签抽选池':'Tag browser','筛选类别':'Filter categories','生成的英文提示词':'Generated English prompt','选择标签或点击随机生成，结果会显示在这里。':'Select tags or generate a prompt to see the result here.',
 '已选标签':'Selected tags','更多标签操作':'More tag options','主要功能':'Main navigation','关闭完整列表':'Close tag dialog','标签排序':'Sort tags','搜索结果类别':'Filter search results by category','切换头发分区':'Switch hair section','本类标签':'Category tags','本类已选标签':'Selected tags in this category',
 '搜索全部标签（Ctrl / ⌘ + K）':'Search all tags (Ctrl / ⌘ + K)','换一个种子，不立即生成':'Choose a new seed without generating yet',
 '选择状态只有“已保留”和“随机选择”。点击未选词设为已保留；随机词点击可保留；再次点击已保留词会移除。':'Tags are either retained or random. Click an unselected or random tag to retain it; click a retained tag again to remove it.',
 '“锁定 tag”开启保留编辑，点选后确认或取消。取消保留的词仍留在当前搭配，下次随机时允许替换。数量包含已保留词，达到目标就停止该池补抽。':'Use “Retain tags” to edit retention, then confirm or cancel. Released tags stay until the next generation. Retained tags count toward the requested quantity; a full category receives no extra draw.',
 '生成后当前已用显示全部搭配词，推荐候选保留原来的候选池并与已用词去重。“换一批”仅更换候选，不改变搭配；随机统一从完整可用词库抽取，黑名单词除外；推荐候选池只供浏览和选词。':'Selected tags and suggestions are shown separately without duplicates. Refreshing suggestions does not change your prompt. Random generation uses the full eligible library and excludes the blacklist.',
 '拖拽时页面最左侧宽度 1/9 为黑名单区，最右侧宽度 1/9 为收藏区，高度覆盖全页；中间 7/9 松手取消。提示范围与判定范围一致。鼠标需移动一定距离，触屏需长按后拖动。标签卡片及搭配中的标签都可拖拽。手机触屏使用长按菜单，可收藏或加入黑名单；移动手指滚动时会取消长按。':'With a mouse, drag a tag to the leftmost ninth of the screen to blacklist it, or the rightmost ninth to favorite it. Release in the middle to cancel. On touchscreens, long-press a tag for its menu; scrolling cancels the long press.',
 '黑名单词从搭配移除，在普通列表和收藏夹隐藏，不参与推荐或随机。移出黑名单后原收藏关系恢复。重复收藏不改变顺序。在收藏夹点击「移除收藏」进入移除模式，点击词条立即移除收藏，再点「退出操作」结束；关闭收藏夹也会退出该模式。':'Blacklisted tags are removed from your prompt and hidden from browsing, favorites and random draws. Restoring them restores any favorite status. Favorites keep their original order. Use “Remove favorites” for batch removal; close the dialog or exit removal mode when done.',
 '收藏、黑名单、搭配、保留状态、种子及抽取设置自动存到当前浏览器。换浏览器或移动文件后，可能无法读取原记录。重置搭配不会清空收藏和黑名单。':'Favorites, blacklist, prompt, retention, seed and draw settings are saved in this browser. Another browser or file location may have separate storage. Resetting your prompt keeps favorites and blacklist.',
 '词库按原站收录篇数排序，按类别定义核对后分批扩充；明确候选不足时保留实际数量，不凑数。旧版词兼容保留，质量类保留 5 个标记为“补充”的旧版模型词。':'Tags are ranked by source post count and expanded in batches after category review. Categories with fewer clear candidates are not padded. Older tags are kept for compatibility; five older model-specific quality tags are marked “Extra”.',
 '数据来自 Latent Tags 的 Danbooru 快照，中文为原站释义或旧版辅助释义。部分表情符号沿用原名。词库扩大后，同一旧种子的结果可能变化。':'Data comes from a Danbooru snapshot via Latent Tags. Chinese labels use source or earlier translations; some emoticons keep their original names. Library changes may change the result of an older seed.'
 },
 detect(languages){const first=Array.isArray(languages)?languages[0]:languages;return /^zh(?:-|$)/i.test(first||'en')?'zh':'en';},
 text(value){const s=String(value);if(this.lang!=='en')return s;const trimmed=s.trim();if(Object.hasOwn(this.dictionary,trimmed))return s.replace(trimmed,this.dictionary[trimmed]);
  const patterns=[
   [/^(\d+) 个标签$/,(_,n)=>`${n} tag${n==='1'?'':'s'}`],
   [/^(\d+) 个(?: · 隐藏 (\d+) 个)?$/,(_,n,h)=>`${n}${h===undefined?'':` · ${h} hidden`}`],
   [/^已保留 (\d+) \/ 随机选择 (\d+)$/,(_,k,r)=>`Retained ${k} / Random ${r}`],
   [/^已用 (\d+) 个 \/ 可用 (\d+) 个$/,(_,a,b)=>`Selected ${a} / Available ${b}`],
   [/^已选 (\d+) · 词池 (\d+)$/,(_,n,p)=>`Selected ${n} · Pool ${p}`],
   [/^已选 (\d+) 个 · 词池 (\d+) 个 · (.*)$/,(_,n,p,h)=>`Selected ${n} · Pool ${p} · ${this.text(h)}`],
   [/^更多已用词见「全部 (\d+) 个」。$/,(_,n)=>`More selected tags: Browse all ${n}.`],
   [/^全部 (\d+) 个 →$/,(_,n)=>`All ${n} →`],
   [/^找到 (\d+) 个 · 每页 (\d+) 个$/,(_,n,p)=>`${n} matches · ${p} per page`],
   [/^找到 (\d+) 个 · 发色 \/ 发型分区$/,(_,n)=>`${n} matches · Hair color / hairstyle`],
   [/^第 (\d+) \/ (\d+) 页$/,(_,n,p)=>`Page ${n} / ${p}`],
   [/^([\d,]+) 篇收录$/,(_,n)=>`${n} posts`],
   [/^(\d+) 个匹配$/,(_,n)=>`${n} matches`],
   [/^可用 (\d+) 个标签$/,(_,n)=>`Available ${n} tags`],[/^(.*)标签池$/,(_,n)=>`${this.text(n)} tag pool`],
   [/^本类已选 (\d+) 个 · 全部已选 (\d+) 个$/,(_,n,a)=>`Selected in category ${n} · Total ${a}`],
   [/^全部已选 (\d+) 个(?: · 已保留 (\d+) \/ 随机选择 (\d+))?$/,(_,n,k,r)=>`Total selected ${n}${k===undefined?'':` · Retained ${k} / Random ${r}`}`],
   [/^按收藏顺序排列 · (\d+) 个收藏因黑名单而隐藏$/,(_,n)=>`In favorite order · ${n} favorites hidden by blacklist`],
   [/^可能随机补抽：(.*)。$/,(_,c)=>`May draw randomly: ${c.replaceAll('、',', ')}.`],
   [/^(.*)候选已更新，当前搭配不变。$/,(_,c)=>`${c} suggestions refreshed. Your prompt is unchanged.`],
   [/^已复制 (\d+) 个英文标签。$/,(_,n)=>`Copied ${n} English tags.`],
   [/^(\d+) 个类别 · (\d+) 个双语标签 · 自由组合，保留喜欢的灵感。$/,(_,c,n)=>`${c} categories · ${n} bilingual tags · Build a prompt, keep your inspiration.`],
   [/^查看(.*)全部标签$/,(_,c)=>`View all ${c} tags`],
   [/^(.*)最少数量$/,(_,c)=>`${c} minimum quantity`],[/^(.*)最多数量$/,(_,c)=>`${c} maximum quantity`],
   [/^(.*)参与随机$/,(_,c)=>`${c} random draws`],[/^(.*)换一批$/,(_,c)=>c?`Refresh ${c} suggestions`:'Refresh suggestions'],
   [/^移除(?:收藏)? (.*)$/,(_,n)=>`Remove ${n}`],
   [/^★ 收藏夹(?: (\d+))?$/,(_,n)=>`★ Favorites${n===undefined?'':' '+n}`],[/^黑名单 (\d+)$/,(_,n)=>`Blacklist ${n}`],
   [/^搜索(.*)标签$/,(_,n)=>`Search ${n} tags`]
  ];for(const [pattern,replace] of patterns)if(pattern.test(trimmed))return s.replace(trimmed,trimmed.replace(pattern,replace));
  if(trimmed.includes(' · '))return s.split(' · ').map(part=>this.text(part)).join(' · ');
  let out=s;for(const [zh,en] of Object.entries(this.dictionary).sort((a,b)=>b[0].length-a[0].length))if(zh.length>1&&out.includes(zh))out=out.replaceAll(zh,en);
  return out.replaceAll('已生成','Generated').replaceAll('已保留词保持不变','Retained tags stay').replaceAll('可用标签不足',' has too few eligible tags').replaceAll(' · 可用 ',' · Available ').replace(/(\d+) 个标签/g,'$1 tags').replace(/(\d+) 个/g,'$1 tags').replaceAll('↻ 换一批','↻ Refresh').replaceAll(' · 完整列表',' · All tags');
 },
 apply(){if(!document.createTreeWalker)return;const root=document.body,walker=document.createTreeWalker(root,4);let node;
  while((node=walker.nextNode())){if(!node.parentElement||node.parentElement.closest('script,style,textarea,pre,.tag .zh,.tag .en,.chosen-tag,#mobileTagName,#mobileTagEnglish,.manager-item strong'))continue;
   const current=node.nodeValue;let record=this.nodes.get(node);if(!record||current!==record.last)record={source:current,last:current};const next=this.text(record.source);if(current!==next)node.nodeValue=next;record.last=next;this.nodes.set(node,record);
  }
  for(const element of root.querySelectorAll('[title],[aria-label],[placeholder]')){let records=this.attributes.get(element);if(!records)records={};for(const name of ['title','aria-label','placeholder']){if(!element.hasAttribute(name))continue;const current=element.getAttribute(name);let r=records[name];if(!r||current!==r.last)r={source:current,last:current};const next=this.text(r.source);if(current!==next)element.setAttribute(name,next);r.last=next;records[name]=r;}this.attributes.set(element,records);}
  document.documentElement.lang=this.lang==='en'?'en':'zh-CN';document.title=this.lang==='en'?'SimplePrompt | A Simple Prompt Tool for Beginners':'SimplePrompt | 提示词实验室';
  for(const id of ['languageButton','mobileLanguage']){const button=$(id);if(!button)continue;button.textContent=this.lang==='en'?'中文':'English';button.setAttribute('aria-label',this.lang==='en'?'Switch to Chinese':'切换为英文');button.title=this.lang==='en'?'Switch to Chinese':'切换为英文';}
 },
 updateCategories(){for(const c of DATA){const base=this.originalCategories.get(c.id),en=this.categories[c.id];c.title=this.lang==='en'?en[0]:base.title;c.desc=this.lang==='en'?en[1]:base.desc;categoryTitles.set(c.id,c.title);}for(const id of ['category','searchCategory'])for(const option of $(id).querySelectorAll('option'))if(option.value)option.textContent=DATA.find(c=>c.id===option.value)?.title||option.textContent;},
 set(language,persist=true){if(!['zh','en'].includes(language))return;const scrolls=[...document.querySelectorAll('#catalog,.side,#modalTags,.hair-group')].map(el=>[el,el.scrollTop]);const focus=document.activeElement,focusId=focus?.id,focusTag=focus?.dataset?.tag;const menuTag=MobileUI.menuTag;
  this.lang=language;if(persist){this.manual=true;try{localStorage.setItem(this.key,language);}catch{}}this.updateCategories();render();if(menuTag)$('mobileTagName').textContent=tagDisplay(lookup.get(menuTag));this.apply();for(const [el,top] of scrolls)if(el.isConnected)el.scrollTop=top;
  if(focusId)$(focusId)?.focus({preventScroll:true});else if(focusTag)$('modalTags').querySelector(`[data-tag="${CSS.escape(focusTag)}"]`)?.focus({preventScroll:true});scheduleCardFit();
 },
 view(fn){return function(...args){I18n.depth++;try{return fn.apply(this,args);}finally{if(--I18n.depth===0)I18n.apply();}};},
 init(){this.originalCategories=new Map(DATA.map(c=>[c.id,{title:c.title,desc:c.desc}]));let stored;try{stored=localStorage.getItem(this.key);}catch{}this.manual=['zh','en'].includes(stored);this.lang=this.manual?stored:typeof navigator==='undefined'?'zh':this.detect(navigator.languages?.length?navigator.languages:navigator.language);this.updateCategories();
  for(const id of ['languageButton','mobileLanguage'])$(id).addEventListener('click',()=>this.set(this.lang==='en'?'zh':'en'));
  window.addEventListener('languagechange',()=>{if(!this.manual)this.set(this.detect(navigator.languages?.length?navigator.languages:navigator.language),false);});
 }
};
function tagDisplay(t){return I18n.lang==='en'?t.en.replaceAll('_',' '):t.zh;}
function tagSecondary(t){return I18n.lang==='en'?t.zh:t.en;}
render=I18n.view(render);renderCards=I18n.view(renderCards);renderResult=I18n.view(renderResult);renderModal=I18n.view(renderModal);renderGlobalSearch=I18n.view(renderGlobalSearch);fitCardTags=I18n.view(fitCardTags);message=I18n.view(message);saveState=I18n.view(saveState);
MobileUI.syncCards=I18n.view(MobileUI.syncCards);MobileUI.syncNav=I18n.view(MobileUI.syncNav);MobileUI.openTag=I18n.view(MobileUI.openTag);
I18n.init();

const restored=loadState();$('intro').textContent=`${DATA.length} 个类别 · ${all().length} 个双语标签 · 自由组合，保留喜欢的灵感。`;render();saveState();if(restored)message('已恢复上次搭配、保留设置、收藏和黑名单。');

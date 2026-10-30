'use strict';
// Browsing order is independent from the prompt's seeded random generator.
const ArtistCatalog={
 key:'simpleprompt-artist-test-catalog-v1',sort:'shuffle',order:[],limit:12,query:'',searchOpen:false,
 init(){try{const data=JSON.parse(localStorage.getItem(this.key)||'{}');if(['shuffle','alpha'].includes(data.sort))this.sort=data.sort;if(Array.isArray(data.order))this.order=data.order;}catch{}const ids=ArtistSystem.artists.map(a=>a.id);this.order=[...new Set(this.order.filter(id=>ids.includes(id)))];this.order.push(...ArtistSystem.shuffle(ids.filter(id=>!this.order.includes(id))));this.save();
  $('artistSort').value=this.sort;$('artistSort').addEventListener('change',e=>{this.sort=e.target.value;this.limit=12;this.save();ArtistSystem.render();$('catalog').scrollTop=0;});
  $('artistSearchButton').addEventListener('click',()=>this.openSearch());$('artistQuery').addEventListener('input',e=>{this.query=e.target.value;this.limit=12;ArtistSystem.render();});
  $('artistReshuffle').addEventListener('click',()=>this.reshuffle());
  $('catalog').addEventListener('scroll',()=>{const host=$('catalog');if(ArtistSystem.mode==='artists'&&host.scrollHeight-host.scrollTop-host.clientHeight<350)this.more();},{passive:true});
 },
 reshuffle(){if(draftRetained)return;this.order=ArtistSystem.shuffle(ArtistSystem.artists.map(a=>a.id));for(const a of ArtistSystem.artists){const current=ArtistSystem.cover(a),others=a.images.filter(i=>i.status==='available'&&i.path!==current?.path);if(others.length)ArtistSystem.covers.set(a.id,others[Math.floor(ArtistSystem.rand()*others.length)]);}this.limit=12;this.save();ArtistSystem.render();$('catalog').scrollTop=0;},
 save(){try{localStorage.setItem(this.key,JSON.stringify({sort:this.sort,order:this.order}));}catch{}},
 openSearch(){this.searchOpen=true;$('artistSearchRow').hidden=false;$('artistSearchButton').setAttribute('aria-expanded','true');$('artistQuery').focus();},
 items(){const tokens=GlobalSearch.normalize(this.query).split(' ').filter(Boolean),rank=new Map(this.order.map((id,i)=>[id,i]));return ArtistSystem.available().filter(a=>{const text=GlobalSearch.normalize([a.name,a.tag,...a.aliases,...ArtistSystem.styles(a).flatMap(n=>[n,lookup.get(n).zh])].join(' '));return tokens.every(q=>text.includes(q));}).sort((a,b)=>this.sort==='shuffle'?rank.get(a.id)-rank.get(b.id):this.alpha(a,b));},
 alpha(a,b){return a.tag.toLowerCase().localeCompare(b.tag.toLowerCase(),'en');},
 render(){const items=this.items(),top=$('catalog').scrollTop,t=ArtistSystem.t.bind(ArtistSystem);$('artistGrid').innerHTML=items.slice(0,this.limit).map(a=>ArtistSystem.card(a)).join('')||'<p class="empty">'+t('没有匹配的画师；请清空搜索或检查黑名单。','No artists match. Clear search or review the blacklist.')+'</p>';$('artistReshuffle').hidden=this.sort!=='shuffle';$('artistSearchRow').hidden=!this.searchOpen;$('artistSort').value=this.sort;$('artistCount').textContent=t(items.length+' 位画师',items.length+' artists');this.status(items);ArtistMasonry.refresh($('artistPanel'));$('catalog').scrollTop=top;},
 status(items=this.items()){const n=Math.min(this.limit,items.length);$('artistCatalogEnd').textContent=n>=items.length?ArtistSystem.t('已显示全部 '+n+' 位画师','All '+n+' artists shown'):ArtistSystem.t('已显示 '+n+' / '+items.length+' 位 · 下滑加载更多',n+' / '+items.length+' artists · Scroll for more');},
 more(){const items=this.items();if(this.limit>=items.length||draftRetained)return;const start=this.limit;this.limit+=12;$('artistGrid').insertAdjacentHTML('beforeend',items.slice(start,this.limit).map(a=>ArtistSystem.card(a)).join(''));ArtistMasonry.refresh($('artistPanel'));this.status(items);}
};

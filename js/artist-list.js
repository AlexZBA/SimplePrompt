'use strict';
// Session-only list window. Selection renders retain the window and scroll offset.
const ArtistList={
 size:12,limit:12,key:'',items:[],card:null,loading:false,
 reset(){this.key='';this.limit=this.size;},
 render(items,card){const key=modalCategory+'|'+GlobalSearch.normalize($('modalSearch').value),changed=key!==this.key;if(changed){this.key=key;this.limit=this.size;}this.items=items;this.card=card;const host=$('modalTags'),top=host.scrollTop;host.innerHTML='<div class="artist-grid">'+(items.slice(0,this.limit).map(card).join('')||'<p class="empty">'+ArtistSystem.t('没有匹配的画师。','No artists match.')+'</p>')+'</div><p id="artistListEnd" class="artist-list-end" role="status"></p>';ArtistMasonry.refresh(host);host.scrollTop=changed?0:top;this.status();},
 status(){const count=Math.min(this.limit,this.items.length),end=$('artistListEnd');if(!end)return;end.textContent=count>=this.items.length?ArtistSystem.t('已显示全部 '+count+' 位画师','All '+count+' artists shown'):ArtistSystem.t('已显示 '+count+' / '+this.items.length+' 位 · 下滑加载更多',count+' / '+this.items.length+' artists · Scroll for more');},
 more(){if(this.loading||!modalCategory?.startsWith('artist-')||modalCategory==='artist-detail'||this.limit>=this.items.length||draftRetained)return;this.loading=true;try{const start=this.limit;this.limit+=this.size;const grid=$('modalTags').querySelector('.artist-grid');grid?.insertAdjacentHTML('beforeend',this.items.slice(start,this.limit).map(this.card).join(''));ArtistMasonry.refresh($('modalTags'));this.status();}finally{this.loading=false;}},
 init(){$('modalTags').addEventListener('scroll',()=>{const host=$('modalTags');if(host.scrollHeight-host.scrollTop-host.clientHeight<300)this.more();},{passive:true});}
};
ArtistList.init();
